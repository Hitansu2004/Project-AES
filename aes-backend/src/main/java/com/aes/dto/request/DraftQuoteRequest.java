package com.aes.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Body for {@code POST /api/v1/quotes} — create a new quote draft.
 *
 * <p>Exactly one of {@code installId} / {@code ticketId} must be set:</p>
 * <ul>
 *   <li>{@code installId} → installation quote (multi-line BOM + labour).</li>
 *   <li>{@code ticketId}  → P3 service-ticket estimate.</li>
 * </ul>
 */
@Data
public class DraftQuoteRequest {

    private UUID installId;
    private UUID ticketId;

    @NotEmpty(message = "at least one line item is required")
    @Valid
    private List<QuoteLineItemRequest> lineItems;

    @DecimalMin("0")
    private BigDecimal discount;

    private LocalDate validUntil;

    @Size(max = 2000)
    private String notes;
}
