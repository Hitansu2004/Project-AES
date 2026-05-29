package com.aes.enums;

public enum NotificationType {
    TICKET_RAISED,
    TICKET_ASSIGNED,
    TICKET_ESCALATED,
    TICKET_RESOLVED,
    AMC_REMINDER,
    INSTALLATION_UPDATE,
    /** Quote / part-request / generic workflow notifications. */
    GENERAL,
    /** Customer-initiated AMC upgrade request lifecycle. */
    AMC_UPGRADE,
    /** Service-charge payment events (paid / failed / refunded). */
    PAYMENT,
    /** Warranty expiry heads-up (~30 days before expiry). */
    WARRANTY_EXPIRING,
    /** System / housekeeping notifications. */
    SYSTEM
}
