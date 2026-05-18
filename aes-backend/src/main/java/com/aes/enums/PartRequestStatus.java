package com.aes.enums;

/**
 * Lifecycle of a {@code part_requests} row (PLAN.md §7.5, FLOW.md C13).
 *
 * <pre>
 *   PENDING_APPROVAL → APPROVED → ORDERED → DELIVERED → INSTALLED
 *                    ↘ REJECTED
 * </pre>
 */
public enum PartRequestStatus {
    PENDING_APPROVAL,
    APPROVED,
    REJECTED,
    ORDERED,
    DELIVERED,
    INSTALLED
}
