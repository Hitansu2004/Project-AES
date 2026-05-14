package com.aes.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Spring Security 6 configuration — stateless JWT-based auth.
 *
 * Per Section 2 (line 74): Spring Security 6 + JWT (jjwt 0.12.x)
 * Per Section 12 (line 2002): BCrypt hashed (strength 12)
 *
 * Route protection:
 *   - Auth endpoints: public
 *   - /api/v1/users/**: authenticated (any role)
 *   - All other /api/v1/**: authenticated
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final org.springframework.web.cors.CorsConfigurationSource corsConfigurationSource;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource))
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Public endpoints — Auth APIs (Section 4.1)
                .requestMatchers("/api/v1/auth/send-otp").permitAll()
                .requestMatchers("/api/v1/auth/verify-otp").permitAll()
                .requestMatchers("/api/v1/auth/staff-login").permitAll()
                .requestMatchers("/api/v1/auth/refresh").permitAll()
                // WebSocket endpoint
                .requestMatchers("/ws/**").permitAll()
                // Swagger/OpenAPI
                .requestMatchers("/swagger-ui/**", "/swagger-ui.html", "/api-docs/**", "/v3/api-docs/**").permitAll()
                // Health check
                .requestMatchers("/actuator/**").permitAll()
                // CRM routes — require CRM_AGENT role (lines 944-946)
                .requestMatchers("/api/v1/dashboard/crm").hasAnyRole("CRM_AGENT", "ADMIN")
                // Admin routes — require SERVICE_MANAGER or ADMIN (line 946)
                .requestMatchers("/api/v1/dashboard/escalation").hasAnyRole("SERVICE_MANAGER", "ADMIN")
                // All other API endpoints require authentication
                .requestMatchers("/api/v1/**").authenticated()
                .anyRequest().permitAll()
            )
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /**
     * BCrypt password encoder with strength 12 (Section 12, line 2002).
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}
