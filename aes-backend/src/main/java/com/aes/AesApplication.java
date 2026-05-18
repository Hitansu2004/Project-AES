package com.aes;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Application entry point.
 *
 * <p>{@link UserDetailsServiceAutoConfiguration} is excluded because we use a
 * JWT-based {@code SecurityConfig} (no in-memory {@code UserDetailsService}).
 * Without this exclusion, Spring Boot prints a noisy
 * "Using generated security password" warning at every start-up — the
 * generated password is never used by anything in this app.</p>
 */
@SpringBootApplication(exclude = { UserDetailsServiceAutoConfiguration.class })
@EnableScheduling
public class AesApplication {

    public static void main(String[] args) {
        SpringApplication.run(AesApplication.class, args);
    }
}
