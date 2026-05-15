package com.aes.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

/**
 * CORS configuration — exposes the API to the configured frontend origin(s).
 *
 * <p>The {@link CorsConfigurationSource} bean is consumed by Spring Security's
 * {@code .cors(...)} DSL (see {@link SecurityConfig}). It applies to every
 * route, including the WebSocket {@code /ws} handshake.</p>
 *
 * <p>Per Section 10 (line 1955) the default frontend origin is
 * {@code http://localhost:3000}; multiple origins may be supplied as a comma
 * separated list via the {@code app.cors.allowed-origins} property or the
 * {@code CORS_ALLOWED_ORIGINS} environment variable.</p>
 */
@Configuration
public class CorsConfig {

    @Value("${app.cors.allowed-origins:http://localhost:3000}")
    private String allowedOrigins;

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(Arrays.asList(allowedOrigins.split(",")));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setExposedHeaders(List.of("Location"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
