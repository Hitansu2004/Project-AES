package com.aes.dto.request;

import com.aes.enums.OfferMode;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.UUID;

/**
 * Body for {@code POST /api/v1/service-tickets/{ticketNumber}/dispatch-engineer}.
 *
 * <p>Used by the owner CRM (or a Service Manager / Ops Manager override) to
 * offer a site visit to a {@code SITE_ENGINEER}. The engineer has the
 * configured engineer-expiry window (default 10 min) to accept. On accept
 * the ticket flips to {@link com.aes.enums.TicketStatus#ASSIGNED}; on
 * decline / timeout / withdraw it reverts to
 * {@link com.aes.enums.TicketStatus#ACKNOWLEDGED} so the CRM can pick again.</p>
 */
@Data
public class DispatchEngineerRequest {

    /** Site engineer who should run the visit. */
    @NotNull
    private UUID engineerId;

    /** DIRECT = standard dispatch. INVITE = "extra work, optional pick-up". */
    @NotNull
    private OfferMode mode = OfferMode.DIRECT;

    /** Optional freeform note ("VIP customer", "VRF specialist needed", …). */
    @Size(max = 500)
    private String note;
}
