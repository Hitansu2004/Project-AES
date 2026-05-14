package com.aes.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * AC unit response DTO.
 * Per Section 4.4: AC unit with warranty/service status.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AcUnitResponse {

    private UUID id;
    private UUID propertyId;
    private String roomLabel;
    private String acType;
    private String brand;
    private String modelNumber;
    private BigDecimal tonnage;
    private Integer energyStarRating;
    private LocalDate installationDate;
    private LocalDate warrantyExpiry;
    private String warrantyStatus;
    private String serviceStatus;
    private OffsetDateTime createdAt;
}
