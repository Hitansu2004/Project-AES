package com.aes.dto.request;

import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.UUID;

/**
 * Body for {@code POST /api/v1/ops/triage/tickets/{ticketNumber}/bypass-l2}.
 *
 * <p>Ops Manager skips the CRM layer and pushes the ticket straight to an
 * on-shift Service Manager. The SM still has to accept the offer; rejection
 * bounces back to Ops just like a CRM decline. See FLOW.md C11.</p>
 */
@Data
public class BypassToL2Request {

    /**
     * Optional explicit SM target. When {@code null} the service picks the
     * next available on-shift SM (round-robin fallback to admin if none).
     */
    private UUID serviceManagerId;

    @Size(max = 500)
    private String note;
}
