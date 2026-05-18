package com.aes.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Body for {@code POST /api/v1/service-tickets/{ticketNumber}/customer-escalate}
 * (PLAN.md §8.1 T1, FLOW.md C16). Customer triggers a T1 escalation.
 */
@Data
public class CustomerEscalateRequest {

    /** SLOW_RESPONSE | WRONG_DIAGNOSIS | ENGINEER_RUDE | OTHER */
    @NotBlank
    @Size(max = 40)
    private String reason;

    @Size(max = 1000)
    private String details;
}
