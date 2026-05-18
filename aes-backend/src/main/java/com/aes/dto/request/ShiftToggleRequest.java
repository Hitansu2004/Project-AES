package com.aes.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Body for {@code PUT /api/v1/staff/me/shift} (FLOW.md C20 / S11).
 *
 * <p>When a CRM goes off-shift while owning active tickets, each ticket is
 * handed back to the Ops Manager triage inbox; engineers do the same for
 * their dispatched jobs (offers withdrawn, ticket bounced back to the CRM).</p>
 */
@Data
public class ShiftToggleRequest {

    @NotNull
    private Boolean onShift;

    @Size(max = 500)
    private String note;
}
