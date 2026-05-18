package com.aes.enums;

/**
 * Type discriminator for entries in {@code ticket_notes}.
 *
 * <p>Lets a CRM agent log <em>how</em> they interacted with the customer
 * (phone call, WhatsApp message, internal-only thought, etc.) without
 * forcing every comment to look like a generic activity.</p>
 */
public enum NoteType {
    INTERNAL,
    CUSTOMER_CALL,
    SMS,
    WHATSAPP,
    EMAIL
}
