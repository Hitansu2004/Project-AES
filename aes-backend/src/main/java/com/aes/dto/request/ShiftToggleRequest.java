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

    /**
     * Whether to also hand off the user's active work to Ops triage when
     * going off-shift.
     *
     * <ul>
     *   <li>{@code true}  — destructive hand-off (legacy): every open ticket
     *       owned by this CRM/SM/engineer is reset to NEW and bounced back
     *       to the Ops Manager queue. Use for end-of-day or long absences.</li>
     *   <li>{@code false} — soft pause (default): the user simply stops
     *       receiving new offers; their existing work pointers are preserved
     *       so picking the shift back up restores their inbox intact.</li>
     * </ul>
     *
     * <p>Ignored when {@code onShift = true} (starting a shift never hands
     * off anything).</p>
     */
    private Boolean handoffWork;
}
