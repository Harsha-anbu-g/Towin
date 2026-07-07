package com.towin.common.security;

import com.towin.auth.oauth.HttpCookieOAuth2AuthorizationRequestRepository;
import com.towin.auth.oauth.OAuth2FailureHandler;
import com.towin.auth.oauth.OAuth2SuccessHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final HttpCookieOAuth2AuthorizationRequestRepository cookieAuthRequestRepo;
    private final OAuth2SuccessHandler oauthSuccessHandler;
    private final OAuth2FailureHandler oauthFailureHandler;

    @Value("${cors.allowed-origins:http://localhost:5173}")
    private String allowedOrigins;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            // CSRF disabled intentionally: all API endpoints are stateless JWT (Bearer token in
            // Authorization header). Stateless APIs are not vulnerable to CSRF because browsers
            // never auto-attach Authorization headers on cross-origin requests.
            .csrf(AbstractHttpConfigurer::disable)
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .headers(headers -> headers
                .frameOptions(frame -> frame.deny())
                .contentTypeOptions(ct -> {})
                .referrerPolicy(rp -> rp.policy(
                    org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
                .httpStrictTransportSecurity(hsts -> hsts
                    .includeSubDomains(true)
                    .maxAgeInSeconds(31536000))
                .contentSecurityPolicy(csp -> csp
                    .policyDirectives(
                        "default-src 'self'; " +
                        "img-src 'self' https://*.amazonaws.com data: blob:; " +
                        "connect-src 'self' wss: https://accounts.google.com https://*.amazonaws.com; " +
                        "style-src 'self' 'unsafe-inline'; " +
                        "font-src 'self' data:; " +
                        "frame-ancestors 'none'"
                    )
                )
            )
            .authorizeHttpRequests(auth -> auth
                // Self-service password change/set requires a valid session — must sit
                // before the broad /api/auth/** permitAll. (resend/forgot/reset are
                // public by email, so they fall under the permitAll below.)
                .requestMatchers("/api/auth/change-password", "/api/auth/set-password").authenticated()
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/oauth2/**", "/login/oauth2/**").permitAll()
                .requestMatchers("/ws/**").permitAll()
                // OpenAPI docs + Swagger UI (API explorer) — public so the spec is browsable.
                .requestMatchers("/v3/api-docs/**", "/v3/api-docs.yaml",
                    "/swagger-ui/**", "/swagger-ui.html").permitAll()
                .requestMatchers("/api/feedback").permitAll()
                // "Ask AI" help assistant: public so logged-out visitors get help too.
                // A JWT, when present, still flows through jwtAuthFilter, so signed-in
                // users are recognised and get personalized answers. Throttled per IP.
                .requestMatchers("/api/assistant/**").permitAll()
                .requestMatchers("/api/admin/**").hasAuthority("ADMIN")
                .anyRequest().authenticated()
            )
            .oauth2Login(oauth -> oauth
                .authorizationEndpoint(a -> a
                    .authorizationRequestRepository(cookieAuthRequestRepo))
                .successHandler(oauthSuccessHandler)
                .failureHandler(oauthFailureHandler)
            )
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, authException) -> {
                    org.slf4j.LoggerFactory.getLogger(SecurityConfig.class)
                        .warn("401 Unauthorized: {} {}", request.getMethod(), request.getRequestURI());
                    response.sendError(jakarta.servlet.http.HttpServletResponse.SC_UNAUTHORIZED);
                })
                .accessDeniedHandler((request, response, accessDeniedException) -> {
                    org.slf4j.LoggerFactory.getLogger(SecurityConfig.class)
                        .warn("403 Forbidden: {} {}", request.getMethod(), request.getRequestURI());
                    response.sendError(jakarta.servlet.http.HttpServletResponse.SC_FORBIDDEN);
                })
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        http.addFilterAfter(permissionsPolicyFilter(), UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        // Use origin patterns so dev can accept any localhost port and prod can
        // still use explicit hosts via CORS_ALLOWED_ORIGINS.
        config.setAllowedOriginPatterns(List.of(allowedOrigins.split(",")));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Content-Type", "Authorization", "X-Requested-With"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public jakarta.servlet.Filter permissionsPolicyFilter() {
        return (request, response, chain) -> {
            ((jakarta.servlet.http.HttpServletResponse) response)
                .setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
            chain.doFilter(request, response);
        };
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
