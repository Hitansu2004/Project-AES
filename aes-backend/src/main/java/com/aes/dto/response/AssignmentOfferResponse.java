package com.aes.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Single assignment offer as the recipient (CRM agent or Site Engineer)
 * sees it in their inbox.
 *
 * <p>Used by:</p>
 * <ul>
 *   <li>{@code GET /api/v1/offers/mine} — recipient's pending offers</li>
 *   <li>{@code POST /api/v1/offers/{id}/accept|decline|withdraw}</li>
 *   <li>{@code GET /api/v1/dashboard/ops} — embedded in inbox cards</li>
 * </ul>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AssignmentOfferResponse {

    private UUID id;

    /** CRM_OWNER or ENGINEER_DISPATCH. */
    private String offerType;

    /** DIRECT or INVITE. */
    private String mode;

    private String status;
    private String declineReason;
    private String note;

    /** Always populated for ticket offers, null for install offers. */
    private String ticketNumber;
    private UUID ticketId;
    private String ticketPriority;
    private String ticketProblemCategory;

    /** Always populated for install offers, null for ticket offers. */
    private String installRequestNumber;
    private UUID installId;

    private UUID customerId;
    private String customerName;

    private UUID offeredToId;
    private String offeredToName;
    private String offeredToRole;

    private UUID offeredById;
    private String offeredByName;
    private String offeredByRole;

    private OffsetDateTime expiresAt;
    private Long secondsUntilExpiry;
    private OffsetDateTime respondedAt;
    private OffsetDateTime createdAt;
}
