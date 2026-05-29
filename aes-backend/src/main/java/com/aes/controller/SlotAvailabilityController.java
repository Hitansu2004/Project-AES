package com.aes.controller;

import com.aes.dto.response.ApiResponse;
import com.aes.enums.TimeSlot;
import com.aes.service.SlotAvailabilityService;
import com.aes.service.SlotAvailabilityService.DayAvailability;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Read-only "BookMyShow"-style slot availability feed used by the
 * ticket-booking wizard.  Customers and staff can both call it.
 *
 * <p>Example:</p>
 * <pre>{@code
 *   GET /api/v1/slots/availability?from=2026-05-29&days=14
 *
 *   {
 *     "data": {
 *       "dayCapacity": 30,
 *       "slotBudgets": { "EARLY": 8, "MORNING": 8, "AFTERNOON": 8, "EVENING": 6 },
 *       "days": [
 *         { "date": "2026-05-29", "used": 12, "available": 18,
 *           "full": false, "busyReason": null,
 *           "slots": {
 *             "EARLY":     { "used": 2, "budget": 8, "available": 6, "full": false },
 *             "MORNING":   { "used": 5, "budget": 8, "available": 3, "full": false },
 *             "AFTERNOON": { "used": 3, "budget": 8, "available": 5, "full": false },
 *             "EVENING":   { "used": 2, "budget": 6, "available": 4, "full": false }
 *           }
 *         },
 *         …
 *       ]
 *     }
 *   }
 * }</pre>
 */
@RestController
@RequestMapping("/api/v1/slots")
@RequiredArgsConstructor
public class SlotAvailabilityController {

    private final SlotAvailabilityService slotService;

    @GetMapping("/availability")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<Map<String, Object>> availability(
            @RequestParam(name = "from", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(name = "days", defaultValue = "14") int days
    ) {
        if (from == null) from = LocalDate.now();
        List<DayAvailability> window = slotService.availabilityWindow(from, days);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("dayCapacity", slotService.dayCapacity());
        payload.put("slotBudgets", slotService.slotBudgets());
        payload.put("days", window.stream().map(SlotAvailabilityController::toMap).toList());
        return ApiResponse.success(payload);
    }

    private static Map<String, Object> toMap(DayAvailability d) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("date",       d.date().toString());
        m.put("used",       d.used());
        m.put("capacity",   d.capacity());
        m.put("available",  d.available());
        m.put("full",       d.full());
        m.put("busyReason", d.busyReason());
        Map<String, Object> slots = new LinkedHashMap<>();
        for (TimeSlot s : TimeSlot.values()) {
            var u = d.slots().get(s);
            slots.put(s.name(), Map.of(
                    "used", u.used(),
                    "budget", u.budget(),
                    "available", u.available(),
                    "full", u.full()
            ));
        }
        m.put("slots", slots);
        return m;
    }
}
