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
 * Installation request response DTO.
 * Per Section 4.5, line 614.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class InstallationRequestResponse {

    private UUID id;
    private String requestNumber;
    private UUID customerId;
    private UUID propertyId;
    private String propertyLabel;
    private String propertyAddress;
    private String acType;
    private String brand;
    private String modelNumber;
    private BigDecimal tonnage;
    private Integer energyRating;
    private String roomsJson;
    private LocalDate scheduledDate;
    private String scheduledSlot;
    private String status;
    private String assignedEngineerName;
    private BigDecimal estimatedCost;
    private String notes;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
