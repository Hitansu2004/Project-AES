package com.aes.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * Single-line per-request access log — replaces Hibernate / Spring Security
 * debug spam with a focused trace that's actually useful.
 *
 * <p>Format:</p>
 * <pre>
 * → POST /api/v1/auth/verify-otp                       anon
 * ← POST /api/v1/auth/verify-otp                  200   42ms  user=8b1f… role=CUSTOMER
 * ← GET  /api/v1/dashboard/customer               200    7ms  user=8b1f… role=CUSTOMER
 * ✗ GET  /api/v1/properties/3a2c…                 404   12ms  user=8b1f… role=CUSTOMER  msg="Property not found"
 * </pre>
 *
 * <p>Static / health / docs traffic is excluded so the log stays clean.</p>
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
@Slf4j
public class RequestLoggingFilter extends OncePerRequestFilter {

    private static final int PATH_PAD = 48;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        long started = System.currentTimeMillis();
        String method = request.getMethod();
        String path   = request.getRequestURI();

        try {
            chain.doFilter(request, response);
        } finally {
            long elapsed = System.currentTimeMillis() - started;
            int  status  = response.getStatus();

            String userInfo = userSummaryFrom(request);

            String prefix = status >= 500 ? "✗"
                          : status >= 400 ? "!"
                          : status >= 300 ? "→"
                                          : "←";

            String line = String.format(
                    "%s %-6s %-" + PATH_PAD + "s %3d %5dms  %s",
                    prefix, method, truncate(path, PATH_PAD), status, elapsed, userInfo);

            if (status >= 500)       log.error(line);
            else if (status >= 400)  log.warn(line);
            else                     log.info(line);
        }
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.startsWith("/actuator/health")
                || path.startsWith("/actuator/info")
                || path.startsWith("/swagger-ui")
                || path.startsWith("/api-docs")
                || path.startsWith("/v3/api-docs")
                || path.equals("/favicon.ico");
    }

    /**
     * "user=8b1f… role=CUSTOMER" — reads attributes set by JwtAuthenticationFilter.
     * Never logs the full UUID, never logs phone/email/PII.
     */
    private static String userSummaryFrom(HttpServletRequest request) {
        Object userIdAttr = request.getAttribute(JwtAuthenticationFilter.ATTR_USER_ID);
        Object roleAttr   = request.getAttribute(JwtAuthenticationFilter.ATTR_USER_ROLE);
        if (userIdAttr == null) return "anon";

        String userTag;
        if (userIdAttr instanceof UUID id) {
            userTag = "user=" + id.toString().substring(0, 8) + "…";
        } else {
            String s = userIdAttr.toString();
            userTag = "user=" + (s.length() > 8 ? s.substring(0, 8) + "…" : s);
        }
        return roleAttr == null ? userTag : userTag + " role=" + roleAttr;
    }

    private static String truncate(String s, int max) {
        if (s == null) return "";
        if (s.length() <= max) return s;
        return s.substring(0, max - 1) + "…";
    }
}
