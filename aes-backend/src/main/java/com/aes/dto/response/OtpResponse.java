package com.aes.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response payload for {@code POST /api/v1/auth/send-otp}.
 *
 * <p>Per Section 4.1 (line 504):</p>
 * <pre>
 *   { "expiresInSeconds": 600, "otpForDemo": "123456" }
 * </pre>
 *
 * <p>{@link #otpForDemo} is populated only when {@code app.demo-mode=true} so
 * the field disappears entirely from production responses (thanks to
 * {@link JsonInclude.Include#NON_NULL}).</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class OtpResponse {

    /** OTP validity window in seconds (10 minutes per Section 7, line 1678). */
    private int expiresInSeconds;

    /** Demo-only echo of the generated OTP. {@code null} in production. */
    private String otpForDemo;
}
