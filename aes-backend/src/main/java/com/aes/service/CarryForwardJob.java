package com.aes.service;

import com.aes.entity.ServiceTicket;
import com.aes.enums.TimeSlot;
import com.aes.repository.ServiceTicketRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * Nightly job that rolls every unfinished service ticket whose
 * {@code scheduled_date} is in the past forward into today's
 * {@code EARLY} slot.
 *
 * <p>Why EARLY?  Carry-forwards represent a missed commitment to the
 * customer — they should be the first thing the engineer touches the
 * next morning.  The CRM / Engineer dashboards float carry-overs to
 * the top so the team works them before any newly-booked job.</p>
 *
 * <p>The job is idempotent: if it runs twice (e.g. dev hot-reload) it
 * will only flip dates that are still strictly before today, and the
 * {@code originalScheduledDate} column is preserved so SLA reports can
 * still tell when the customer originally booked.</p>
 *
 * <p>Cron expression: {@code 0 5 0 * * *}  → 00:05 every night, in
 * {@code Asia/Kolkata} (matches the customer-facing business hours).
 * Disable in dev by setting {@code app.scheduling.carry-forward.enabled=false}.</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class CarryForwardJob {

    private final ServiceTicketRepository ticketRepo;
    private final WebSocketService webSocketService;

    @Scheduled(cron = "${app.scheduling.carry-forward-cron:0 5 0 * * *}",
               zone = "Asia/Kolkata")
    @Transactional
    public void rollOverYesterdaysWork() {
        LocalDate today = LocalDate.now();
        List<ServiceTicket> candidates = ticketRepo.findCarryForwardCandidates(today);
        if (candidates.isEmpty()) {
            log.info("carry-forward: nothing to do — no open tickets predate {}", today);
            return;
        }

        int rolled = 0;
        for (ServiceTicket t : candidates) {
            // Stamp the original date once — if a ticket gets carried
            // more than one day, keep the first booking date.
            if (t.getOriginalScheduledDate() == null) {
                t.setOriginalScheduledDate(t.getScheduledDate());
            }
            t.setScheduledDate(today);
            t.setScheduledSlot(TimeSlot.EARLY.name());
            t.setCarriedForward(Boolean.TRUE);
            rolled++;
        }
        ticketRepo.saveAll(candidates);
        log.info("carry-forward: rolled {} tickets to {} EARLY", rolled, today);

        // Push a single dashboard refresh ping so any CRM / Engineer
        // browsers that happen to be open at midnight redraw without
        // a manual reload.
        try {
            webSocketService.broadcastOpsInbox("CARRY_FORWARD", null,
                    java.util.Map.of("rolled", rolled, "date", today.toString()));
        } catch (Exception e) {
            log.debug("carry-forward: websocket ping failed (non-fatal)", e);
        }
    }
}
