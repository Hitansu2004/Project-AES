package com.aes.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * Swagger / OpenAPI 3.0 configuration.
 *
 * Accessible at:
 *   - Swagger UI:  http://localhost:8080/swagger-ui.html
 *   - OpenAPI JSON: http://localhost:8080/v3/api-docs
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("AES Customer Portal API")
                        .description("Arial Engineering Services — HVAC Customer Portal Backend API.\n\n" +
                                "## Authentication\n" +
                                "Use the **Authorize** button to add your JWT token.\n" +
                                "Format: `Bearer <your-jwt-token>`\n\n" +
                                "## Roles\n" +
                                "- **CUSTOMER** — OTP login, manage properties, AC units, raise tickets\n" +
                                "- **CRM_AGENT** — L1 support, acknowledge/resolve tickets\n" +
                                "- **SERVICE_MANAGER** — L2 escalation management\n" +
                                "- **ADMIN** — Full system access\n\n" +
                                "## SLA Rules\n" +
                                "- L1 (CRM): 30 minutes to acknowledge\n" +
                                "- L2 (Manager): 60 minutes to resolve\n" +
                                "- Final: P1=4h, P2=8h, P3=24h")
                        .version("1.0.0")
                        .contact(new Contact()
                                .name("Arial Engineering Services")
                                .email("support@arialengineering.com"))
                        .license(new License()
                                .name("Proprietary")))
                .servers(List.of(
                        new Server().url("http://localhost:8080").description("Local Dev"),
                        new Server().url("https://api.arialengineering.com").description("Production")))
                .addSecurityItem(new SecurityRequirement().addList("Bearer Authentication"))
                .components(new Components()
                        .addSecuritySchemes("Bearer Authentication",
                                new SecurityScheme()
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")
                                        .description("Enter your JWT access token")));
    }
}
