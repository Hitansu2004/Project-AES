package com.aes.service;

import com.aes.config.JwtConfig;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;

/**
 * JWT Service — generates and validates access / refresh tokens.
 *
 * <p>Per Section 7 (lines 1680-1684):</p>
 * <ul>
 *   <li>Algorithm: HS256.</li>
 *   <li>Access token: {@code jwt.access-token-expiry} seconds (default 900 / 15 min).</li>
 *   <li>Refresh token: {@code jwt.refresh-token-expiry} seconds (default 604800 / 7 days).</li>
 *   <li>Claims: {@code sub} (userId), {@code role}, {@code iat}, {@code exp}.</li>
 * </ul>
 *
 * <p>Per Section 12 (line 2001) the JWT body must contain no PII beyond
 * {@code userId} and {@code role}.</p>
 */
@Service
@Slf4j
public class JwtService {

    private static final long MILLIS_PER_SECOND = 1000L;

    private final SecretKey secretKey;
    private final long accessTokenExpiryMillis;
    private final long refreshTokenExpiryMillis;

    public JwtService(JwtConfig jwtConfig) {
        this.secretKey = Keys.hmacShaKeyFor(jwtConfig.getSecret().getBytes(StandardCharsets.UTF_8));
        this.accessTokenExpiryMillis = jwtConfig.getAccessTokenExpiry() * MILLIS_PER_SECOND;
        this.refreshTokenExpiryMillis = jwtConfig.getRefreshTokenExpiry() * MILLIS_PER_SECOND;
    }

    public String generateAccessToken(UUID userId, String role) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .subject(userId.toString())
                .claim("role", role)
                .issuedAt(new Date(now))
                .expiration(new Date(now + accessTokenExpiryMillis))
                .signWith(secretKey)
                .compact();
    }

    public String generateRefreshToken(UUID userId) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .subject(userId.toString())
                .issuedAt(new Date(now))
                .expiration(new Date(now + refreshTokenExpiryMillis))
                .signWith(secretKey)
                .compact();
    }

    /**
     * Parse and verify a JWT. Returns {@code null} for any invalid / expired token.
     */
    public Claims extractClaims(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(secretKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (ExpiredJwtException e) {
            log.debug("JWT expired: {}", e.getMessage());
            return null;
        } catch (JwtException e) {
            log.warn("Invalid JWT: {}", e.getMessage());
            return null;
        }
    }

    public UUID extractUserId(String token) {
        Claims claims = extractClaims(token);
        if (claims == null) {
            return null;
        }
        return UUID.fromString(claims.getSubject());
    }

    public String extractRole(String token) {
        Claims claims = extractClaims(token);
        if (claims == null) {
            return null;
        }
        return claims.get("role", String.class);
    }

    public boolean isTokenValid(String token) {
        return extractClaims(token) != null;
    }
}
