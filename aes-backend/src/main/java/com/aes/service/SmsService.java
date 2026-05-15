package com.aes.service;

import com.aes.config.AppProperties;
import com.twilio.Twilio;
import com.twilio.rest.api.v2010.account.Message;
import com.twilio.type.PhoneNumber;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * SMS gateway abstraction.
 *
 * <p>Per Section 4.1 (lines 502-506) and Section 14 (line 2072):</p>
 * <ul>
 *   <li>If {@code app.demo-mode=true} or Twilio credentials are missing, the
 *       OTP is logged to the server console and the API response surfaces
 *       it via {@link com.aes.dto.response.OtpResponse#getOtpForDemo()} so the
 *       client demo can be driven without a real SMS gateway.</li>
 *   <li>If Twilio credentials are present and demo mode is off, the OTP is
 *       dispatched as a real SMS via the Twilio SDK.</li>
 * </ul>
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class SmsService {

    private final AppProperties appProperties;

    @Value("${twilio.account-sid:}")
    private String accountSid;

    @Value("${twilio.auth-token:}")
    private String authToken;

    @Value("${twilio.from-number:}")
    private String fromNumber;

    private boolean twilioInitialized = false;

    @PostConstruct
    void initializeTwilio() {
        if (hasTwilioCredentials()) {
            try {
                Twilio.init(accountSid, authToken);
                twilioInitialized = true;
                log.info("Twilio SMS gateway initialized (from={})", fromNumber);
            } catch (Exception ex) {
                log.warn("Twilio initialization failed; falling back to console log: {}", ex.getMessage());
            }
        } else {
            log.info("Twilio credentials not configured — OTPs will be logged to the console only.");
        }
    }

    /**
     * Dispatch an OTP to the given phone number.
     *
     * <p>Returns silently on demo or unconfigured deployments — the OTP token
     * persists in the database regardless, so verification still works.</p>
     */
    public void sendOtpSms(String phoneNumber, String otpCode) {
        if (appProperties.isDemoMode() || !twilioInitialized) {
            log.info("==================== DEMO MODE OTP ====================");
            log.info("  Phone : {}", phoneNumber);
            log.info("  OTP   : {}", otpCode);
            log.info("=======================================================");
            return;
        }

        try {
            Message message = Message.creator(
                    new PhoneNumber(phoneNumber),
                    new PhoneNumber(fromNumber),
                    "Your Arial Engineering verification code is " + otpCode +
                            ". It expires in 10 minutes."
            ).create();
            log.info("OTP SMS dispatched to {} (sid={})", phoneNumber, message.getSid());
        } catch (Exception ex) {
            // Never surface SMS provider errors to the client — fall back to console log.
            log.error("Failed to send OTP SMS via Twilio: {}", ex.getMessage());
            log.info("OTP for {} (fallback log): {}", phoneNumber, otpCode);
        }
    }

    /**
     * Best-effort transactional SMS for a ticket event (acknowledged / engineer
     * assigned / resolved / escalated).
     *
     * <p>Always logs the message so the dev/demo console stays informative;
     * only attempts a real send when Twilio is configured and demo mode is
     * disabled. Failures never propagate.</p>
     */
    public void sendTicketSms(String phoneNumber, String message) {
        if (phoneNumber == null || phoneNumber.isBlank() || message == null) {
            return;
        }
        if (appProperties.isDemoMode() || !twilioInitialized) {
            log.info("[sms-skip] {} — \"{}\"", phoneNumber, abbreviate(message));
            return;
        }
        try {
            Message sent = Message.creator(
                    new PhoneNumber(phoneNumber),
                    new PhoneNumber(fromNumber),
                    message
            ).create();
            log.info("[sms-sent] {} sid={} \"{}\"", phoneNumber, sent.getSid(), abbreviate(message));
        } catch (Exception ex) {
            log.error("[sms-fail] {} \"{}\": {}", phoneNumber, abbreviate(message), ex.getMessage());
        }
    }

    private static String abbreviate(String s) {
        if (s == null) return "";
        return s.length() <= 80 ? s : s.substring(0, 77) + "…";
    }

    private boolean hasTwilioCredentials() {
        return accountSid != null && !accountSid.isBlank() && !accountSid.startsWith("AC" + "xxxxx")
                && authToken != null && !authToken.isBlank()
                && fromNumber != null && !fromNumber.isBlank();
    }
}
