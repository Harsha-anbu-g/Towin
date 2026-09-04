package com.towinly.common.security;

import com.towinly.auth.security.JwtUtil;
import com.towinly.common.entity.User;
import com.towinly.common.repository.UserRepository;
import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The chat polls every few seconds. Stamping lastSeenAt on every request made
 * each poll pay for a second SELECT, an UPDATE and a commit before the real
 * work began, so the stamp is written at most once a minute.
 */
class JwtAuthFilterTest {

    private final JwtUtil jwtUtil = mock(JwtUtil.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final JwtAuthFilter filter = new JwtAuthFilter(jwtUtil, userRepository);
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void aValidToken() {
        Claims claims = mock(Claims.class);
        when(claims.getSubject()).thenReturn(userId.toString());
        when(claims.get("role", String.class)).thenReturn("ELDER");
        when(jwtUtil.extractAllClaims("good")).thenReturn(claims);
        when(jwtUtil.extractTokenVersion("good")).thenReturn(0);
        SecurityContextHolder.clearContext();
    }

    private User userSeen(LocalDateTime lastSeenAt) {
        User user = User.builder().id(userId).isActive(true).tokenVersion(0).lastSeenAt(lastSeenAt).build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        return user;
    }

    private void request() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/messages/unread-count");
        request.addHeader("Authorization", "Bearer good");
        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());
    }

    @Test
    void aPollSecondsAfterTheLastOneWritesNothing() throws Exception {
        userSeen(LocalDateTime.now().minusSeconds(10));
        request();
        verify(userRepository, never()).save(any());
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
    }

    @Test
    void theFirstRequestInAMinuteStampsLastSeen() throws Exception {
        User user = userSeen(LocalDateTime.now().minusMinutes(5));
        request();
        verify(userRepository).save(user);
        assertThat(user.getLastSeenAt()).isAfter(LocalDateTime.now().minusSeconds(5));
    }

    @Test
    void aNeverSeenUserIsStampedAtOnce() throws Exception {
        User user = userSeen(null);
        request();
        verify(userRepository).save(user);
    }

    @Test
    void shouldStampOnlyPastTheInterval() {
        LocalDateTime now = LocalDateTime.now();
        assertThat(JwtAuthFilter.shouldStampLastSeen(null, now)).isTrue();
        assertThat(JwtAuthFilter.shouldStampLastSeen(now.minusSeconds(59), now)).isFalse();
        assertThat(JwtAuthFilter.shouldStampLastSeen(now.minusSeconds(61), now)).isTrue();
    }
}
