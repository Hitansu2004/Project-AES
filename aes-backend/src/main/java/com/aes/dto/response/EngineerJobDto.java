package com.aes.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Single row in the engineer's "My Jobs" list (PLAN.md §9.3, FLOW.md C12).
 *
 * <p>Tuned for the mobile dashboard: includes customer phone + locality so
 * the engineer can call from the card and tap the address into Maps.</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EngineerJobDto {

    private UUID ticketId;
    private String ticketNumber;
    private String status;
    private String priority;
    private String problemCategory;
    private String problemDescription;

    private UUID customerId;
    private String customerName;
    private String customerPhone;

    private String propertyLabel;
    private String locality;
    private String branch;

    private String acBrand;
    private String acModel;
    private String acRoomLabel;

    private LocalDate scheduledDate;
    private String scheduledSlot;

    private OffsetDateTime assignedAt;
    private OffsetDateTime engineerAcceptedAt;
    private OffsetDateTime enRouteAt;
    private OffsetDateTime onSiteAt;
    private OffsetDateTime resolvedAt;
}
