package com.towinly.common.security;

import com.towinly.auth.security.JwtUtil;
import com.towinly.common.entity.User;
import com.towinly.common.enums.UserRole;
import com.towinly.common.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class JwtAuthFilterTest {

    private JwtUtil jwtUtil;
    private UserRepository userRepository;
    private JwtAuthFilter filter;

    @BeforeEach
    void setUp() {
        jwtUtil = new JwtUtil();
        ReflectionTestUtils.setField(jwtUtil, "secret", "a-test-secret-that-is-long-enough-for-hmac-256");
        ReflectionTestUtils.setField(jwtUtil, "expirationMs", 60_000L);
        ReflectionTestUtils.invokeMethod(jwtUtil, "init");
        userRepository = mock(UserRepository.class);
        filter = new JwtAuthFilter(jwtUtil, userRepository);
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void theRoleComesFromTheRow_soADemotedAdminLosesAdminOnTheNextRequest() throws Exception {
        UUID id = UUID.randomUUID();
        User user = User.builder().email("a@b.com").role(UserRole.HELPER).build();
        user.setId(id);
        user.setIsActive(true);
        when(userRepository.findById(id)).thenReturn(Optional.of(user));
        String tokenMintedWhileAdmin = jwtUtil.generateToken(id.toString(), "a@b.com", "ADMIN", 0);

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/admin/users");
        request.addHeader("Authorization", "Bearer " + tokenMintedWhileAdmin);
        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertThat(auth).isNotNull();
        assertThat(auth.getAuthorities()).extracting(GrantedAuthority::getAuthority)
                .containsExactly("HELPER");
    }
}
