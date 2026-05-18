package com.aes.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Body for {@code POST /api/v1/service-tickets/{ticketNumber}/cannot-attend}.
 *
 * <p>Engineer tells the system they can't show up (sick / vehicle / personal
 * emergency). Ticket reverts to {@link com.aes.enums.TicketStatus#ACKNOWLEDGED}
 * so the owning CRM (and Ops Manager) can re-dispatch — see FLOW.md C15.</p>
 */
@Data
public class CannotAttendRequest {

    @NotBlank
    @Size(max = 80)
    private String reason;

    @Size(max = 500)
    private String details;
}
