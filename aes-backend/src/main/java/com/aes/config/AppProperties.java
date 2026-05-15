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

    @Data
    public static class Escalation {
        /** Per spec line 1951 — default 30 minutes for L1 → L2 auto-escalation. */
        private int l1TimeoutMinutes = 30;

        /** Per spec line 1952 — default 60 minutes for L2 → L3 auto-escalation. */
        private int l2TimeoutMinutes = 60;
    }
}
