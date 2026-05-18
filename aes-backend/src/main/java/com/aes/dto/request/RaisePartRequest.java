package com.aes.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;

/**
 * Body for {@code POST /api/v1/service-tickets/{ticketNumber}/parts}.
 *
 * <p>Engineer (or supervisor) raises a part request from the job detail.
 * The approval band is determined server-side from {@code unitCost × quantity}.</p>
 */
@Data
public class RaisePartRequest {

    @NotBlank
    @Size(max = 200)
    private String partName;

    @NotNull
    @Min(1)
    private Integer quantity;

    @NotNull
    @DecimalMin("0.00")
    private BigDecimal unitCost;

    /** LOW / NORMAL / HIGH / EMERGENCY — defaults to NORMAL. */
    @Pattern(regexp = "LOW|NORMAL|HIGH|EMERGENCY")
    private String urgency = "NORMAL";

    @Size(max = 1000)
    private String notes;
}
