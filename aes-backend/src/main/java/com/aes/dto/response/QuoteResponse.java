package com.aes.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Full quote payload for staff (builder) and customer (viewer).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuoteResponse {

    private UUID id;
    private String quoteNumber;
    private Integer version;

    private UUID installId;
    private String installNumber;
    private UUID ticketId;
    private String ticketNumber;

    private UUID customerId;
    private String customerName;

    private String lineItemsJson;
    private BigDecimal subtotal;
    private BigDecimal tax;
    private BigDecimal discount;
    private BigDecimal total;
    private LocalDate validUntil;

    private String status;
    private String requiredApprovalBand;

    private String preparedByName;
    private String approvedByName;
    private OffsetDateTime approvedAt;
    private OffsetDateTime sentAt;

    private String customerDecision;
    private OffsetDateTime customerDecidedAt;
    private String customerResponse;

    private String notes;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
