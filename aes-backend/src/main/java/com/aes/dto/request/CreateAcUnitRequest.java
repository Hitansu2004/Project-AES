package com.aes.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Create AC unit request DTO.
 * Per Section 4.4, lines 578-581.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateAcUnitRequest {

    @NotBlank(message = "Room label is required")
    @Size(max = 100)
    private String roomLabel;

    @NotBlank(message = "AC type is required")
    private String acType;

    @NotBlank(message = "Brand is required")
    @Size(max = 50)
    private String brand;

    @Size(max = 100)
    private String modelNumber;

    @NotNull(message = "Tonnage is required")
    private BigDecimal tonnage;

    private Integer energyStarRating;

    private LocalDate installationDate;

    private LocalDate warrantyExpiry;
}
