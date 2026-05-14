package com.aes.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * AMC Contract response DTO.
 * Per Section 4.10, lines 840-846.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AmcContractResponse {

    private UUID id;
    private String contractNumber;
    private UUID customerId;
    private UUID propertyId;
    private String propertyLabel;
    private LocalDate startDate;
    private LocalDate endDate;
    private Integer visitsPerYear;
    private Integer visitsCompleted;
    private Boolean isActive;
    private String assignedEngineerName;
    private BigDecimal contractValue;
    private String notes;
    private OffsetDateTime createdAt;

    private List<AmcVisitResponse> visits;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AmcVisitResponse {
        private UUID id;
        private Integer visitNumber;
        private LocalDate scheduledDate;
        private String scheduledTimeSlot;
        private OffsetDateTime actualVisitDate;
        private String engineerName;
        private String status;
        private String notes;
        private OffsetDateTime createdAt;
    }
}
