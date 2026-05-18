package com.aes.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Application configuration properties — binds {@code app.*} from application.properties.
 *
 * <p>Per Section 6 (lines 1626-1665) and Section 10 (lines 1938-1957) of the
 * implementation prompt, the application exposes the following tunables:</p>
 * <ul>
 *   <li>{@code app.demo-mode} — when {@code true}, OTP is logged + returned in API
 *       response so the demo can be driven without a real SMS gateway
 *       (lines 502, 1950, 2013).</li>
 *   <li>{@code app.demo-otp-bypass} — universal OTP that always succeeds while
 *       demo mode is enabled (line 2013, "Demo mode flag makes OTP always succeed
 *       with '000000' as fallback"). Disabled in production.</li>
 *   <li>{@code app.escalation.l1-timeout-minutes} — minutes before an
 *       unacknowledged Level 1 ticket auto-escalates to Level 2 (line 1951).</li>
 *   <li>{@code app.escalation.l2-timeout-minutes} — minutes before a Level 2
 *       ticket auto-escalates to Level 3 (line 1952).</li>
 * </ul>
 */
@Configuration
@ConfigurationProperties(prefix = "app")
@Data
public class AppProperties {

    /** Demo mode — exposes OTP in API response and console log. Always {@code false} in production. */
    private boolean demoMode = false;

    /** Demo bypass OTP — only honored when {@link #demoMode} is {@code true}. Empty disables the bypass. */
    private String demoOtpBypass = "";

    /** Escalation timing — both values come from configuration so demo runs can compress them. */
    private final Escalation escalation = new Escalation();

    /** Workflow re-design knobs (PLAN.md §12 Phase 1). */
    private final Workflow workflow = new Workflow();

    /** Assignment-offer expiry windows (PLAN.md §10.1 + FLOW.md C7/C10/C12). */
    private final Offer offer = new Offer();

    /** Quote / Part-request approval bands (PLAN.md §4 matrix + FLOW.md C21-C24). */
    private final Approval approval = new Approval();

    /** Re-open window for closed tickets (PLAN.md §6 S12, FLOW.md C18). */
    private final Reopen reopen = new Reopen();

    @Data
    public static class Escalation {
        /** Per spec line 1951 — default 30 minutes for L1 → L2 auto-escalation. */
        private int l1TimeoutMinutes = 30;

        /** Per spec line 1952 — default 60 minutes for L2 → L3 auto-escalation. */
        private int l2TimeoutMinutes = 60;

        /**
         * Auto-escalation engine master switch. {@code true} in production so the
         * scheduler enforces SLAs; {@code false} in dev/demo so the seeded demo
         * tickets stay at their authored levels and the user can drive escalation
         * manually via the UI buttons. Toggle with {@code app.escalation.auto-enabled}.
         */
        private boolean autoEnabled = true;

        /**
         * Workflow re-design (PLAN.md §8.2 ladder): when this is {@code true}
         * the L2 SLA breach NO LONGER auto-bumps to L3. Instead the admin is
         * notified ("Needs Attention") and ownership stays with the L2 manager.
         * This is the new default — set to {@code false} to fall back to the
         * legacy auto-bump behaviour.
         */
        private boolean l3MonitorOnly = true;
    }

    @Data
    public static class Workflow {
        /**
         * When {@code true}, new tickets/installs are created with no owner
         * and surfaced in the Ops Manager triage inbox. When {@code false}
         * (the Phase 1 default), the legacy auto-assign-to-CRM behaviour
         * is preserved so the existing demo continues to work.
         *
         * <p>Flip to {@code true} once the Ops Manager dashboard (Phase 2)
         * is ready to handle the queue.</p>
         */
        private boolean opsTriageEnabled = false;
    }

    @Data
    public static class Offer {
        /** Minutes a CRM agent has to accept an Ops Manager offer. */
        private int crmExpiryMinutes = 15;

        /** Minutes a Site Engineer has to accept a dispatch offer. */
        private int engineerExpiryMinutes = 10;
    }

    @Data
    public static class Approval {
        // ── Part request bands (₹) ────────────────────────────────────
        /** ≤ this: CRM can approve. */
        private java.math.BigDecimal partCrmCeiling = new java.math.BigDecimal("5000");
        /** ≤ this and &gt; CRM ceiling: Service Manager can approve. */
        private java.math.BigDecimal partManagerCeiling = new java.math.BigDecimal("50000");
        /** &gt; manager ceiling: Admin only. */

        // ── Quote bands (₹) ───────────────────────────────────────────
        /** Quote total ≤ this and &gt; CRM ceiling: SM approves. */
        private java.math.BigDecimal quoteManagerCeiling = new java.math.BigDecimal("200000");
        /** Below this: auto-approves (P3 visit charge only). */
        private java.math.BigDecimal quoteAutoApproveCeiling = new java.math.BigDecimal("500");
    }

    @Data
    public static class Reopen {
        /** Days within which a customer can re-open a closed ticket. */
        private int windowDays = 7;

        /** Customer rating threshold (1..5) below which the ticket auto-reopens. */
        private int autoReopenRating = 2;
    }
}
