package com.towin.common.seed;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Wires {@link DemoActivityInterceptor} onto the API so demo-account changes are
 * noticed and the demo can self-heal. Only active when demo seeding is enabled.
 */
@Configuration
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "app.demo", name = "seed-enabled", havingValue = "true", matchIfMissing = true)
public class DemoWebConfig implements WebMvcConfigurer {

    private final DemoActivityInterceptor demoActivityInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(demoActivityInterceptor).addPathPatterns("/api/**");
    }
}
