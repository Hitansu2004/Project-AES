package com.aes.enums;

/**
 * Lifecycle states for {@code installation_requests} (PLAN.md §7.2).
 *
 * <p>Legacy values ({@code PENDING}, {@code SITE_VISIT_DONE}) are kept for
 * backward compatibility with the V4 demo seed; new code should prefer the
 * redesigned states ({@code NEW}, {@code OFFERED_CRM}, {@code SURVEY_SCHEDULED},
 * {@code SITE_VISITED}, …).</p>
 */
public enum InstallationStatus {
    /** Legacy "no owner yet" state — equivalent to {@link #NEW}. */
    PENDING,
    /** Workflow re-design: customer just submitted, sitting in Ops triage. */
    NEW,
    /** Ops triaged — offer to a CRM is pending acceptance. */
    OFFERED_CRM,
    /** CRM accepted ownership; customer call confirmed. */
    CONFIRMED,
    /** Site survey booked but not yet executed. */
    SURVEY_SCHEDULED,
    /** Legacy alias for {@link #SITE_VISITED}. */
    SITE_VISIT_DONE,
    /** Survey complete — measurements and photos captured. */
    SITE_VISITED,
    /** CRM/Designer is preparing the quote. */
    QUOTE_DRAFT,
    /** Quote awaiting SM / Admin internal approval. */
    QUOTE_PENDING_APPROVAL,
    /** Internal reviewer asked for rework. */
    QUOTE_REJECTED_INTERNAL,
    /** Approved internal quote pushed to the customer. */
    QUOTE_SENT,
    /** Customer asked for changes — quote going back to DRAFT for v2. */
    QUOTE_NEGOTIATING,
    /** Customer accepted — installation can be scheduled. */
    QUOTE_ACCEPTED,
    INSTALLATION_SCHEDULED,
    INSTALLATION_IN_PROGRESS,
    COMPLETED,
    CANCELLED
}
