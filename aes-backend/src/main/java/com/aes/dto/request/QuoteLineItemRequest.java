package com.aes.dto.request;

import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Single quote line — desc + qty + unit price + GST %.
 *
 * <p>Used for both installation quotes (BOM + labour) and P3 estimates
 * (a single line in most cases). Totals are computed server-side; the
 * client never sets {@code total}.</p>
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class QuoteLineItemRequest {

    @NotBlank
    @Size(max = 200)
    private String description;

    @NotNull
    @DecimalMin(value = "0.01", message = "qty must be > 0")
    private BigDecimal qty;

    @NotNull
    @DecimalMin(value = "0.00")
    private BigDecimal unitPrice;

    /** GST percentage (e.g. 18 for 18% GST). Defaults to 18 if null. */
    @DecimalMin("0")
    @DecimalMax("100")
    private BigDecimal gstPct;
}
