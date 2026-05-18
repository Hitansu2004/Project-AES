package com.aes.enums;

/**
 * What an {@code assignment_offers} row is offering.
 *
 * <p>One unified table covers both Ops-Manager-to-CRM offers and
 * CRM-to-Site-Engineer dispatch offers; the {@code offer_type} discriminates.
 * See PLAN.md §7.3 and FLOW.md C7 / C10 / C12.</p>
 */
public enum OfferType {
    /** Ops Manager offers ticket ownership / install ownership to a CRM agent. */
    CRM_OWNER,
    /** CRM (or Service Manager) dispatches a site engineer to attend a job. */
    ENGINEER_DISPATCH
}
