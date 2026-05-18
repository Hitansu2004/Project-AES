package com.aes.enums;

/**
 * How an {@code assignment_offers} row was sent.
 *
 * <p>Used by Ops Managers to distinguish a normal assignment from the
 * "Hey, can you take one more?" flow described in FLOW.md C10.</p>
 */
public enum OfferMode {
    /** Standard assignment — recipient is expected to accept. */
    DIRECT,
    /** Workload-overload invitation — recipient may freely decline with a reason. */
    INVITE
}
