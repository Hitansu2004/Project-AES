package com.aes.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Body for {@code POST /api/v1/service-tickets/{ticketNumber}/reopen}
 * (FLOW.md C18). Customer re-opens a CLOSED ticket within the configured
 * re-open window (default 7 days).
 */
@Data
public class ReopenTicketRequest {
    @NotBlank
    @Size(max = 1000)
    private String reason;
}
