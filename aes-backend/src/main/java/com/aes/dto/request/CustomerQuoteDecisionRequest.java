package com.aes.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Body for {@code POST /api/v1/quotes/{quoteNumber}/customer-decision}.
 *
 * <p>Customer responds to a {@code SENT_TO_CUSTOMER} quote. Choices:</p>
 * <ul>
 *   <li><strong>ACCEPTED</strong> — quote becomes
 *       {@code CUSTOMER_ACCEPTED}; install moves to
 *       {@code QUOTE_ACCEPTED} (or P3 ticket to {@code IN_PROGRESS}).</li>
 *   <li><strong>REJECTED</strong> — quote {@code CUSTOMER_REJECTED};
 *       install cancelled.</li>
 *   <li><strong>NEGOTIATE</strong> — quote {@code NEGOTIATING};
 *       sales rep prepares a v2.</li>
 * </ul>
 */
@Data
public class CustomerQuoteDecisionRequest {

    @NotBlank
    @Pattern(regexp = "ACCEPTED|REJECTED|NEGOTIATE")
    private String decision;

    @Size(max = 2000)
    private String response;
}
