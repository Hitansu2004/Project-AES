package com.aes.dto.request;

import com.aes.enums.OfferMode;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.UUID;

/**
 * Body for {@code POST /api/v1/ops/triage/tickets/{ticketNumber}/offer}.
 *
 * <p>Used by the Ops Manager dashboard to push a triaged ticket to a CRM
 * agent. The CRM has the {@code app.offer.crm-expiry-minutes} window to
 * accept; if they decline or the timer runs out the ticket bounces back to
 * the Ops inbox (see {@code AssignmentOfferService.expireOverdueOffers}).</p>
 */
@Data
public class OfferTicketRequest {

    /** CRM agent (or, in the bypass flow, Service Manager) to offer the ticket to. */
    @NotNull
    private UUID crmId;

    /**
     * DIRECT — standard assignment. INVITE — "Hey, can you take one more?"
     * Both still require the recipient to accept; the difference is only the
     * UI presentation and the freedom to decline without justification.
     */
    @NotNull
    private OfferMode mode = OfferMode.DIRECT;

    /** Optional freeform note the CRM will see ("Aarav is a VIP, please squeeze in"). */
    @Size(max = 500)
    private String note;
}
