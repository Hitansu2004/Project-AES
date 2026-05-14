package com.aes.dto.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotBlank;

/**
 * Escalate ticket request DTO.
 * Per Section 4.7, line 689.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EscalateTicketRequest {

    @NotBlank(message = "Escalation reason is required")
    private String reason;
}
