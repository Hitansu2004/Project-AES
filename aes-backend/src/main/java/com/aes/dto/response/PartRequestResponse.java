package com.aes.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PartRequestResponse {
    private UUID id;
    private UUID ticketId;
    private String ticketNumber;
    private UUID requestedById;
    private String requestedByName;
    private String partName;
    private Integer quantity;
    private String urgency;
    private BigDecimal unitCost;
    private BigDecimal totalCost;
    private String notes;
    private String status;
    private String requiredApprovalBand;
    private UUID approvedById;
    private String approvedByName;
    private OffsetDateTime approvedAt;
    private String rejectedReason;
    private LocalDate expectedDelivery;
    private OffsetDateTime orderedAt;
    private OffsetDateTime deliveredAt;
    private OffsetDateTime installedAt;
    private OffsetDateTime createdAt;
}
