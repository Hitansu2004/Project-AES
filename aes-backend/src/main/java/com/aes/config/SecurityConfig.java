package com.aes.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfigurationSource;

/**
 * Spring Security 6 configuration — stateless JWT-based auth.
 *
 * <p>Per Section 2 (line 74): Spring Security 6 + JWT (jjwt 0.12.x).
 * Passwords are not stored — every role authenticates via the OTP flow.</p>
 *
 * <h3>Route protection</h3>
 * <ul>
 *   <li>{@code /api/v1/auth/(send-otp|verify-otp|refresh)} — public. Every role
 *       authenticates via the OTP flow; there is no staff-password endpoint.</li>
 *   <li>{@code /api/v1/dashboard/crm} — CRM_AGENT or ADMIN.</li>
 *   <li>{@code /api/v1/dashboard/escalation} — SERVICE_MANAGER or ADMIN.</li>
 *   <li>{@code /ws/**} — public (STOMP handshake; topic-level auth handled separately).</li>
 *   <li>{@code /swagger-ui/**}, {@code /api-docs/**}, {@code /actuator/**} — public.</li>
 *   <li>Everything else under {@code /api/v1/**} — requires authentication; the
 *       service layer enforces ownership and any finer role check.</li>
 * </ul>
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final CorsConfigurationSource corsConfigurationSource;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource))
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Always-public endpoints
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers(
                        "/api/v1/auth/send-otp",
                        "/api/v1/auth/verify-otp",
                        "/api/v1/auth/refresh"
                ).permitAll()
                .requestMatchers("/ws/**").permitAll()
                .requestMatchers(
                        "/swagger-ui/**", "/swagger-ui.html",
                        "/api-docs/**", "/v3/api-docs/**"
                ).permitAll()
                .requestMatchers("/actuator/health", "/actuator/info").permitAll()

                // Role-based dashboards (Section 4.11, lines 868-892)
                .requestMatchers("/api/v1/dashboard/crm").hasAnyRole("CRM_AGENT", "ADMIN")
                .requestMatchers("/api/v1/dashboard/escalation").hasAnyRole("SERVICE_MANAGER", "ADMIN")

                // Workflow re-design — role-scoped surface area (PLAN.md §10).
                // Phase 2/3 will add the controllers; route guards land here now so
                // the moment they ship they are protected.
                //
                // Engineer availability board is shared with anyone who can dispatch
                // work (CRM, SM) — must be listed BEFORE the catch-all /ops/** rule.
                .requestMatchers("/api/v1/ops/workload/engineers")
                    .hasAnyRole("OPS_MANAGER", "ADMIN", "CRM_AGENT", "SERVICE_MANAGER")
                .requestMatchers("/api/v1/ops/**").hasAnyRole("OPS_MANAGER", "ADMIN")
                .requestMatchers("/api/v1/engineer/**").hasAnyRole("SITE_ENGINEER", "ADMIN")
                .requestMatchers("/api/v1/dashboard/ops").hasAnyRole("OPS_MANAGER", "ADMIN")
                .requestMatchers("/api/v1/dashboard/engineer").hasAnyRole("SITE_ENGINEER", "ADMIN")

                // Everything else requires authentication; ownership/role enforced at service layer.
                .requestMatchers("/api/v1/**").authenticated()
                .anyRequest().permitAll()
            )
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
