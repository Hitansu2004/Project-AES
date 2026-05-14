package com.aes.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * JWT Configuration properties — binds jwt.* from application.properties.
 *
 * Per Section 7 (lines 1680-1684):
 *   Access token: 15 minutes (900 seconds)
 *   Refresh token: 7 days (604800 seconds)
 *   Algorithm: HS256
 *   Claims: sub (userId), role, iat, exp
 */
@Configuration
@ConfigurationProperties(prefix = "jwt")
@Data
public class JwtConfig {

    /**
     * Secret key for HS256 signing. Must be at least 256 bits.
     */
    private String secret;

    /**
     * Access token expiry in seconds. Default: 900 (15 minutes).
     */
    private long accessTokenExpiry = 900;

    /**
     * Refresh token expiry in seconds. Default: 604800 (7 days).
     */
    private long refreshTokenExpiry = 604800;
}
