package com.aes.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;

/**
 * JWT Service — generates and validates access/refresh tokens.
 * 
 * Per Section 7 (lines 1680-1684):
 *   Access token: 15 minutes
 *   Refresh token: 7 days
 *   Algorithm: HS256
 *   Claims: sub (userId), role, iat, exp
 *
 * Per Section 12 (line 2001):
 *   No PII in JWT payload beyond userId and role
 */
@Service
@Slf4j
public class JwtService {

    private final SecretKey secretKey;
    private final long accessTokenExpiry;
    private final long refreshTokenExpiry;

    public JwtService(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.access-token-expiry}") long accessTokenExpiry,
            @Value("${jwt.refresh-token-expiry}") long refreshTokenExpiry) {
        this.secretKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessTokenExpiry = accessTokenExpiry * 1000; // convert to millis
        this.refreshTokenExpiry = refreshTokenExpiry * 1000;
    }

    /**
     * Generate JWT access token with userId + role claims only (no PII).
     */
    public String generateAccessToken(UUID userId, String role) {
        return Jwts.builder()
                .subject(userId.toString())
                .claim("role", role)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + accessTokenExpiry))
                .signWith(secretKey)
                .compact();
    }

    /**
     * Generate JWT refresh token with userId only.
     */
    public String generateRefreshToken(UUID userId) {
        return Jwts.builder()
                .subject(userId.toString())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + refreshTokenExpiry))
                .signWith(secretKey)
                .compact();
    }

    /**
     * Extract all claims from a token. Returns null if invalid/expired.
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

    /**
     * Extract userId from token.
     */
    public UUID extractUserId(String token) {
        Claims claims = extractClaims(token);
        if (claims == null) return null;
        return UUID.fromString(claims.getSubject());
    }

    /**
     * Extract role from token.
     */
    public String extractRole(String token) {
        Claims claims = extractClaims(token);
        if (claims == null) return null;
        return claims.get("role", String.class);
    }

    /**
     * Validate token is not expired and structurally valid.
     */
    public boolean isTokenValid(String token) {
        return extractClaims(token) != null;
    }
}
