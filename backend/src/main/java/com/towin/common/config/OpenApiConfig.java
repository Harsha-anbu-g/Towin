package com.towin.common.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Configures the OpenAPI (Swagger) spec that springdoc generates from the REST
 * controllers. Adds API metadata and a JWT bearer scheme so the "Authorize"
 * button in Swagger UI (/swagger-ui.html) lets you call secured endpoints.
 */
@Configuration
public class OpenApiConfig {

    private static final String BEARER_SCHEME = "bearerAuth";

    @Bean
    public OpenAPI toWinOpenAPI() {
        return new OpenAPI()
            .info(new Info()
                .title("ToWin API")
                .version("v1")
                .description("REST API for ToWin — connecting elderly people with each other "
                    + "and with young helpers. Paste a JWT via the Authorize button to try "
                    + "secured endpoints."))
            .addSecurityItem(new SecurityRequirement().addList(BEARER_SCHEME))
            .components(new Components().addSecuritySchemes(BEARER_SCHEME,
                new SecurityScheme()
                    .name(BEARER_SCHEME)
                    .type(SecurityScheme.Type.HTTP)
                    .scheme("bearer")
                    .bearerFormat("JWT")));
    }
}
