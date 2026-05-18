package com.aes.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

/**
 * Body for {@code POST /api/v1/service-tickets/{ticketNumber}/reschedule}
 * (FLOW.md C19). Customer asks for a new slot.
 */
@Data
public class RescheduleTicketRequest {

    @NotNull
    private LocalDate newDate;

    /** MORNING / AFTERNOON / EVENING (matches the existing scheduled_slot column). */
    @Pattern(regexp = "MORNING|AFTERNOON|EVENING")
    private String newSlot;

    @Size(max = 500)
    private String reason;
}
