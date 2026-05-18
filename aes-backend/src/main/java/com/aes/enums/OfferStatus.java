package com.aes.enums;

/**
 * Lifecycle of a single offer (PLAN.md §7.3).
 *
 * <p>Transitions:
 * {@code OFFERED → ACCEPTED} (recipient accepts in time)
 * {@code OFFERED → DECLINED} (recipient declines explicitly)
 * {@code OFFERED → EXPIRED} (timer ran out — see app.offer.* properties)
 * {@code OFFERED → WITHDRAWN} (sender cancelled before recipient responded).</p>
 */
public enum OfferStatus {
    OFFERED,
    ACCEPTED,
    DECLINED,
    EXPIRED,
    WITHDRAWN
}
