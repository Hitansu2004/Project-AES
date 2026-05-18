package com.aes.enums;

/**
 * Lifecycle of a quote document (PLAN.md §7.4 + FLOW.md C21–C24).
 *
 * <p>Used for both installation quotes (multi-line BOM + labour) and P3
 * service-ticket estimates (typically a single line).</p>
 *
 * <p>Transitions:</p>
 * <pre>
 *   DRAFT → PENDING_APPROVAL → APPROVED → SENT_TO_CUSTOMER → CUSTOMER_ACCEPTED
 *                              ↘ REJECTED_INTERNAL (back to DRAFT)
 *   SENT_TO_CUSTOMER → CUSTOMER_REJECTED
 *   SENT_TO_CUSTOMER → NEGOTIATING (customer asks for change) → DRAFT (new version)
 *   Any active → SUPERSEDED (replaced by a newer version)
 * </pre>
 */
public enum QuoteStatus {
    DRAFT,
    PENDING_APPROVAL,
    APPROVED,
    REJECTED_INTERNAL,
    SENT_TO_CUSTOMER,
    CUSTOMER_ACCEPTED,
    CUSTOMER_REJECTED,
    NEGOTIATING,
    SUPERSEDED
}
