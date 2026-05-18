package com.aes.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One card on the Ops Manager triage inbox.
 *
 * <p>Polymorphic — {@code kind} is either {@code TICKET} or {@code INSTALL}.
 * The {@code referenceNumber} field is the AES-… / INS-… string the Ops
 * Manager actually reads on the card.</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class OpsInboxItemDto {

    /** TICKET | INSTALL — drives the UI icon + click-through route. */
    private String kind;

    private UUID id;
    private String referenceNumber;

    private UUID customerId;
    private String customerName;

    /** P1/P2/P3 for tickets, null for installs. */
    private String priority;

    /** Current ticket status (NEW, OFFERED_CRM, ESCALATED_BY_CUSTOMER) or install status. */
    private String status;

    /** Free-text label so the UI can show "Untriaged" / "Awaiting CRM accept" / "Customer escalated". */
    private String stage;

    /** Short headline — problem category for tickets, AC type for installs. */
    private String headline;

    private String branch;
    private String locality;

    /** Outstanding offer recipient (if any) — for OFFERED_CRM cards. */
    private UUID offeredToId;
    private String offeredToName;
    private OffsetDateTime offerExpiresAt;
    private Long offerSecondsUntilExpiry;

    /** Customer-side escalation reason — only for ESCALATED_BY_CUSTOMER. */
    private String escalationReason;

    /** "minutes since the customer submitted" — drives sort + age chip. */
    private long ageMinutes;

    private OffsetDateTime createdAt;
}
