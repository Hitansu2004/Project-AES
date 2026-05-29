package com.aes.service;

import com.aes.enums.TimeSlot;
import com.aes.repository.ServiceTicketRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Daily booking-capacity engine.
 *
 * <p>The CRM team has a hard ceiling of {@code 30} jobs per day, made
 * up of {@code 15} two-engineer teams.  This service reads the live
 * ticket table and answers "for the next N days, how many slots are
 * left per day and per time-of-day bucket?" — the wizard uses that to
 * gray out fully-booked dates the same way BookMyShow grays out sold
 * out shows.</p>
 *
 * <p>The per-slot budget is derived from the day budget so we always
 * stay consistent:</p>
 *
 * <pre>{@code
 *   EARLY     →  8   (priority bucket for carry-forwards)
 *   MORNING   →  8
 *   AFTERNOON →  8
 *   EVENING   →  6
 * }</pre>
 *
 * <p>If a slot's count is at its budget the wizard disables that
 * tile.  When all four are full the whole day is unbookable.</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SlotAvailabilityService {

    private final ServiceTicketRepository ticketRepo;

    @Value("${app.scheduling.day-capacity:30}")
    private int dayCapacity;

    // Per-slot budget split — tuned so the morning shift can absorb a
    // big bag of carry-overs.  Values must sum to dayCapacity.
    private static final Map<TimeSlot, Integer> SLOT_BUDGET = new EnumMap<>(TimeSlot.class);
    static {
        SLOT_BUDGET.put(TimeSlot.EARLY,      8);
        SLOT_BUDGET.put(TimeSlot.MORNING,    8);
        SLOT_BUDGET.put(TimeSlot.AFTERNOON,  8);
        SLOT_BUDGET.put(TimeSlot.EVENING,    6);
    }

    /** Convenience record exposed to controllers. */
    public record SlotUsage(int used, int budget) {
        public int available() { return Math.max(0, budget - used); }
        public boolean full()  { return used >= budget; }
    }

    /** Daily roll-up exposed to controllers. */
    public record DayAvailability(LocalDate date,
                                  int used, int capacity,
                                  Map<TimeSlot, SlotUsage> slots,
                                  String busyReason) {
        public int available() { return Math.max(0, capacity - used); }
        public boolean full()  { return used >= capacity; }
    }

    /**
     * Read availability for the {@code days}-wide window starting at
     * {@code start}.  Returns one entry per day in chronological order
     * so the frontend can render the strip-picker directly.
     */
    @Transactional(readOnly = true)
    public List<DayAvailability> availabilityWindow(LocalDate start, int days) {
        if (days < 1) days = 1;
        if (days > 60) days = 60;
        LocalDate end = start.plusDays(days - 1L);

        // Pull all the live counts for the window in ONE query.
        List<Object[]> rows = ticketRepo.findSlotUsageBetween(start, end);

        // date → slot → count
        Map<LocalDate, Map<TimeSlot, Integer>> bucketed = new HashMap<>();
        for (Object[] row : rows) {
            LocalDate d = ((java.sql.Date) row[0]).toLocalDate();
            TimeSlot slot = safeSlot((String) row[1]);
            int count = ((Number) row[2]).intValue();
            bucketed.computeIfAbsent(d, k -> new EnumMap<>(TimeSlot.class))
                    .merge(slot, count, Integer::sum);
        }

        List<DayAvailability> out = new ArrayList<>(days);
        for (int i = 0; i < days; i++) {
            LocalDate d = start.plusDays(i);
            Map<TimeSlot, Integer> raw = bucketed.getOrDefault(d, Map.of());
            Map<TimeSlot, SlotUsage> slots = new EnumMap<>(TimeSlot.class);
            int total = 0;
            for (TimeSlot s : TimeSlot.values()) {
                int used = raw.getOrDefault(s, 0);
                slots.put(s, new SlotUsage(used, SLOT_BUDGET.get(s)));
                total += used;
            }
            String reason = null;
            if (total >= dayCapacity) {
                reason = "We're fully booked on this date — please pick another day.";
            } else if (total >= dayCapacity * 0.8) {
                reason = "Only a few slots left.";
            }
            out.add(new DayAvailability(d, total, dayCapacity, slots, reason));
        }
        return out;
    }

    /**
     * Read availability for a single date — used by the booking guard
     * inside {@link ServiceTicketService#createTicket} to reject any
     * over-capacity attempt with a clean 409.
     */
    @Transactional(readOnly = true)
    public DayAvailability availabilityForDate(LocalDate date) {
        return availabilityWindow(date, 1).get(0);
    }

    /**
     * Throws {@link com.aes.exception.BusinessException} when the
     * requested {@code (date, slot)} pair has no room left.  Used as
     * a server-side guard so the wizard frontend can't bypass the
     * capacity ceiling by hand-crafting a request.
     */
    public void assertSlotAvailable(LocalDate date, TimeSlot slot) {
        if (date == null) return;        // free-form ticket — capacity doesn't apply
        DayAvailability day = availabilityForDate(date);
        if (day.full()) {
            throw new com.aes.exception.BusinessException(
                    "DAY_FULL",
                    "All 30 service slots for " + date + " are booked. Please pick another day.");
        }
        if (slot != null) {
            SlotUsage s = day.slots().get(slot);
            if (s != null && s.full()) {
                throw new com.aes.exception.BusinessException(
                        "SLOT_FULL",
                        "The " + slot.name().toLowerCase() + " slot on " + date
                                + " is full. Please pick another slot or day.");
            }
        }
    }

    private static TimeSlot safeSlot(String name) {
        if (name == null) return TimeSlot.MORNING;
        try { return TimeSlot.valueOf(name.toUpperCase()); }
        catch (IllegalArgumentException e) { return TimeSlot.MORNING; }
    }

    /** Read-only view of the configured budgets — used by the controller's metadata payload. */
    public Map<TimeSlot, Integer> slotBudgets() { return Map.copyOf(SLOT_BUDGET); }
    public int dayCapacity() { return dayCapacity; }
}
