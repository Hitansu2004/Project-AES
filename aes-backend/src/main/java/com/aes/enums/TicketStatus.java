package com.aes.enums;

/**
 * Ticket lifecycle states.
 *
 * <p>Original states (kept for backward compatibility with V1–V6 demo data):
 * {@link #OPEN}, {@link #ACKNOWLEDGED}, {@link #ASSIGNED}, {@link #IN_PROGRESS},
 * {@link #RESOLVED}, {@link #CLOSED}, {@link #CANCELLED}.</p>
 *
 * <p>New states introduced by the workflow re-design (see PLAN.md §7.1
 * and FLOW.md C-series scenarios):</p>
 * <ul>
 *   <li>{@link #NEW} — created by customer, awaiting Ops Manager triage.
 *       Replaces the old "auto-assign on create" path going forward.</li>
 *   <li>{@link #OFFERED_CRM} — Ops Manager has sent the ticket to a CRM
 *       agent; waiting for them to accept (within the offer window).</li>
 *   <li>{@link #ENGINEER_OFFERED} — CRM has dispatched to a site engineer;
 *       waiting for the engineer to accept.</li>
 *   <li>{@link #EN_ROUTE}, {@link #ON_SITE} — engineer-driven sub-states
 *       between ASSIGNED and IN_PROGRESS.</li>
 *   <li>{@link #WAITING_PART} — work paused until a part request clears.</li>
 *   <li>{@link #WAITING_CUSTOMER_APPROVAL} — P3 estimate sent, waiting for
 *       the customer to accept or reject the charge.</li>
 *   <li>{@link #ESCALATED_BY_CUSTOMER} — customer pressed the Escalate button;
 *       ticket is back in the Ops Manager queue with a red flag.</li>
 *   <li>{@link #REOPENED} — customer rated 1–2 stars within the re-open
 *       window; ticket re-opens with the original CRM owner.</li>
 * </ul>
 *
 * <p><strong>Storage note:</strong> the {@code service_tickets.status}
 * column was widened to {@code VARCHAR(32)} in migration V7 so the longest
 * new value ({@code WAITING_CUSTOMER_APPROVAL}, 26 chars) fits.</p>
 */
public enum TicketStatus {
    // ── Original (kept for back-compat) ──────────────────────
    OPEN,
    ACKNOWLEDGED,
    ASSIGNED,
    IN_PROGRESS,
    RESOLVED,
    CLOSED,
    CANCELLED,

    // ── New (workflow re-design) ─────────────────────────────
    NEW,
    OFFERED_CRM,
    ENGINEER_OFFERED,
    EN_ROUTE,
    ON_SITE,
    WAITING_PART,
    WAITING_CUSTOMER_APPROVAL,
    ESCALATED_BY_CUSTOMER,
    REOPENED
}
