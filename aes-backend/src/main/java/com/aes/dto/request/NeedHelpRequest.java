package com.aes.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Body for {@code POST /api/v1/service-tickets/{ticketNumber}/need-help}.
 *
 * <p>Engineer flags a T2 escalation: skill mismatch, safety, customer
 * dispute, equipment beyond scope. Notifies the owner CRM and on-shift
 * Service Managers without taking the engineer off the ticket — see
 * FLOW.md C14.</p>
 */
@Data
public class NeedHelpRequest {

    @NotBlank
    @Size(max = 80)
    private String reason;

    @Size(max = 1000)
    private String details;
}
