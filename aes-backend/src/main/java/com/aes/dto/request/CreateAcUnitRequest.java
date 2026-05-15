package com.aes.dto.request;

import com.aes.enums.AcType;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Request body for {@code POST /api/v1/properties/{propertyId}/ac-units}.
 * Per Section 4.4 (lines 578-581).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateAcUnitRequest {

    @NotBlank(message = "Room label is required")
    @Size(max = 100, message = "Room label must be at most 100 characters")
    private String roomLabel;

    @NotNull(message = "AC type is required")
    private AcType acType;

    @NotBlank(message = "Brand is required")
    @Size(max = 50, message = "Brand must be at most 50 characters")
    private String brand;

    @Size(max = 100, message = "Model number must be at most 100 characters")
    private String modelNumber;

    @NotNull(message = "Tonnage is required")
    @DecimalMin(value = "0.5", message = "Tonnage must be at least 0.5")
    @DecimalMax(value = "20.0", message = "Tonnage must be at most 20.0")
    private BigDecimal tonnage;

    @Min(value = 1, message = "Energy star rating must be between 1 and 5")
    @Max(value = 5, message = "Energy star rating must be between 1 and 5")
    private Integer energyStarRating;

    @PastOrPresent(message = "Installation date cannot be in the future")
    private LocalDate installationDate;

    private LocalDate warrantyExpiry;
}
