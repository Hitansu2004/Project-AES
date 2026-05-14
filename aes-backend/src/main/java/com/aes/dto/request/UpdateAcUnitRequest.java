package com.aes.dto.request;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Update AC unit request DTO.
 * Per Section 4.4, line 583-584.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateAcUnitRequest {

    @Size(max = 100)
    private String roomLabel;

    private String acType;

    @Size(max = 50)
    private String brand;

    @Size(max = 100)
    private String modelNumber;

    private BigDecimal tonnage;

    private Integer energyStarRating;

    private LocalDate installationDate;

    private LocalDate warrantyExpiry;

    private String warrantyStatus;

    private String serviceStatus;
}
