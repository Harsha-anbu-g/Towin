package com.towin.common.seed;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Set;
import java.util.UUID;

/**
 * Notices when someone logged into a demo account changes something, so the demo
 * can revert itself afterwards. Fires on any successful (2xx) mutating request
 * by an authenticated user; {@link DemoResetCoordinator} ignores it unless the
 * user is actually a demo account. Reads-only (GET/HEAD) never trigger anything.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "app.demo", name = "seed-enabled", havingValue = "true", matchIfMissing = true)
public class DemoActivityInterceptor implements HandlerInterceptor {

    private static final Set<String> MUTATIONS = Set.of("POST", "PUT", "PATCH", "DELETE");

    private final DemoResetCoordinator coordinator;

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                Object handler, Exception ex) {
        if (ex != null || !MUTATIONS.contains(request.getMethod())) return;
        int status = response.getStatus();
        if (status < 200 || status >= 300) return;

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return;
        try {
            coordinator.onDemoWrite(UUID.fromString(auth.getName()));
        } catch (IllegalArgumentException ignored) {
            // Anonymous principal ("anonymousUser") or non-UUID name — not a demo user.
        }
    }
}
