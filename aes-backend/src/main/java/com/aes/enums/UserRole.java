package com.aes.enums;

/**
 * Portal roles.
 *
 * <p>The two new roles {@link #OPS_MANAGER} and {@link #SITE_ENGINEER}
 * are introduced by the workflow re-design (see PLAN.md §4 + FLOW.md):</p>
 * <ul>
 *   <li>{@code OPS_MANAGER} — the human dispatcher. First to see every new
 *       ticket and installation request before they touch the CRM team.</li>
 *   <li>{@code SITE_ENGINEER} — the field technician who actually visits the
 *       customer. CRM agents dispatch them with an explicit accept/decline
 *       offer.</li>
 * </ul>
 *
 * <p>Existing roles are unchanged so the demo seed and any external code
 * keep working.</p>
 */
public enum UserRole {
    CUSTOMER,
    OPS_MANAGER,
    CRM_AGENT,
    SITE_ENGINEER,        // legacy enum name; user-facing label is "Service Engineer"
    SERVICE_MANAGER,
    ADMIN,
    /**
     * Company owner.  Sees everything ADMIN sees + the live revenue
     * dashboard, every transaction, and team / engineer status across
     * the org.  Added in V14.
     */
    SUPER_ADMIN
}
