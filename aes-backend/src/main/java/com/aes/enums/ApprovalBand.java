package com.aes.enums;

/**
 * Internal-approval tier required for a quote total or part-request cost
 * (PLAN.md §4 authorisation matrix, FLOW.md C13 / C21–C24).
 *
 * <p>Bands are inclusive on the upper edge:</p>
 * <ul>
 *   <li>{@link #AUTO} — auto-approved (e.g. visit charge ≤ ₹500).</li>
 *   <li>{@link #CRM} — Owner CRM can approve.</li>
 *   <li>{@link #SERVICE_MANAGER} — Branch Service Manager required.</li>
 *   <li>{@link #ADMIN} — Operations Head / Director only.</li>
 * </ul>
 */
public enum ApprovalBand {
    AUTO,
    CRM,
    SERVICE_MANAGER,
    ADMIN
}
