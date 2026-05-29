package com.aes.enums;

/**
 * Visit time-of-day buckets the customer can pick during ticket booking.
 *
 * <p>{@code EARLY} is the "general / anytime" shift shown to the
 * customer as <em>"AES picks the best time"</em>.  Internally it doubles
 * as the priority bucket where every carried-forward ticket lands so
 * the morning team works yesterday's leftovers first, then fills the
 * remaining capacity with same-day "anytime" bookings.</p>
 *
 * <p>The order of the enum values matches the order the slots are
 * worked through during a day, which is also the order they're sorted
 * by in the CRM / Engineer dashboards.</p>
 */
public enum TimeSlot {
    EARLY,        // "Anytime" general shift + priority bucket for carry-forwards
    MORNING,      // 9 AM – 12 PM
    AFTERNOON,    // 12 PM – 4 PM
    EVENING       // 4 PM – 7 PM
}
