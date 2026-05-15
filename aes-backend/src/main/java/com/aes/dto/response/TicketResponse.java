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
 * Full ticket response DTO.
 * Per Section 4.6, line 654 and Section 8, line 1785.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class TicketResponse {

    private UUID id;
    private String ticketNumber;
    private UUID customerId;
    private String customerName;

    // AC Unit info
    private UUID acUnitId;
    private String acUnitRoom;
    private String acBrand;
    private String acModel;
    private UUID propertyId;
    private String propertyLabel;

    // Ticket details
    private String priority;
    private String serviceType;
    private String problemCategory;
    private String errorCode;
    private String problemDescription;
    private String photosJson;
    private LocalDate scheduledDate;
    private String scheduledSlot;

    // Assignment
    private Integer currentLevel;
    private UUID currentAssigneeId;
    private String currentAssigneeName;
    private OffsetDateTime assignedAt;

    // Status
    private String status;
    private OffsetDateTime acknowledgedAt;
    private OffsetDateTime resolvedAt;
    private OffsetDateTime closedAt;

    // SLA
    private OffsetDateTime slaDeadlineL1;
    private OffsetDateTime slaDeadlineL2;
    private OffsetDateTime slaDeadlineFinal;
    private Long slaRemainingSecondsL1;
    private Long slaRemainingSecondsL2;
    private Long slaRemainingSecondsFinal;
    private Boolean isL1Breached;
    private Boolean isL2Breached;
    private Boolean isFinalBreached;

    // Charges
    private BigDecimal estimatedCharge;
    private BigDecimal finalCharge;
    private Boolean chargeAccepted;

    // Rating
    private Integer customerRating;
    private String customerFeedback;

    // Timestamps
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    // Nested details (for full ticket view)
    private List<ActivityResponse> activities;
    private List<EscalationLogResponse> escalationLogs;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ActivityResponse {
        private UUID id;
        private String activityType;
        private String description;
        private String metadataJson;
        private UUID userId;
        private String userName;
        private OffsetDateTime createdAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EscalationLogResponse {
        private UUID id;
        /** Convenience for dashboards/log tables. */
        private String ticketNumber;
        private Integer fromLevel;
        private Integer toLevel;
        private UUID fromUserId;
        /** Resolved display name of the user who triggered the escalation. */
        private String fromUserName;
        private String reason;
        private String escalationType;
        private OffsetDateTime escalatedAt;
    }
}
