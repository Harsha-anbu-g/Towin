package com.towinly.auth.service;

import com.towinly.auth.dto.LoginRequest;
import com.towinly.auth.dto.RegisterRequest;
import com.towinly.auth.security.JwtUtil;
import com.towinly.auth.security.LoginRateLimiter;
import com.towinly.auth.security.PasswordPolicy;
import com.towinly.common.entity.PendingRegistration;
import com.towinly.common.entity.User;
import com.towinly.common.enums.UserRole;
import com.towinly.common.repository.PendingRegistrationRepository;
import com.towinly.common.repository.UserRepository;
import com.towinly.common.service.EmailService;
import com.towinly.common.service.PostHogService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import java.util.Optional;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock UserRepository userRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock JwtUtil jwtUtil;
    @Mock LoginRateLimiter loginRateLimiter;
    @Mock PostHogService postHogService;
    @Mock EmailService emailService;
    @Mock PendingRegistrationRepository pendingRepository;
    @Mock PasswordPolicy passwordPolicy;
    @InjectMocks AuthService authService;

    @Test
    void namesAUsernameClashPlainly_beforeAnyEmailWork() {
        // Handles are public in-app, so naming a clash tells a caller nothing they
        // could not read off a profile — and it MUST be named at signup: deferring
        // it to the emailed link walked real people into a loop the shipped apps
        // cannot explain (signup reads as accepted, the link fails generically,
        // forever). The check runs before any email work, so the answer never
        // varies with whether the address is registered.
        when(userRepository.existsByUsername(anyString())).thenReturn(true);
        RegisterRequest req = registerRequest();

        assertThatThrownBy(() -> authService.register(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Username already taken");

        verify(userRepository, never()).existsByEmail(anyString());
        verify(pendingRepository, never()).save(any(PendingRegistration.class));
    }

    @Test
    void shouldRegisterSuccessfully() {
        RegisterRequest req = registerRequest();

        // Registration no longer creates an account or returns a token — it holds the
        // signup in pending_registrations and emails a verification link. The account
        // is only created when the user clicks that link.
        authService.register(req);

        verify(pendingRepository).save(any(PendingRegistration.class));
        verify(emailService).sendVerificationEmail(any(), anyString());
    }

    @Test
    void shouldThrowOnInvalidLoginEmail() {
        LoginRequest req = new LoginRequest();
        req.setIdentifier("test@email.com");
        req.setPassword("wrongpassword");

        when(userRepository.findByEmail("test@email.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(req))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Invalid credentials");
    }

    @Test
    void shouldThrowOnWrongPassword() {
        LoginRequest req = new LoginRequest();
        req.setIdentifier("test@email.com");
        req.setPassword("wrongpassword");

        UUID userId = UUID.randomUUID();
        User user = User.builder().email("test@email.com").passwordHash("hashed").role(UserRole.ELDER).build();
        user.setId(userId);

        when(userRepository.findByEmail("test@email.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrongpassword", "hashed")).thenReturn(false);

        assertThatThrownBy(() -> authService.login(req))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Invalid credentials");
    }

    @Test
    void login_countsFailuresPerAccount_soRespellingThePhoneDoesNotResetTheLock() {
        UUID userId = UUID.randomUUID();
        User user = User.builder().phone("+14165550123").passwordHash("hashed").role(UserRole.ELDER).build();
        user.setId(userId);
        when(userRepository.findByPhone("+14165550123")).thenReturn(Optional.of(user));

        for (String spelling : new String[] {"+14165550123", "+1 416 555 0123", "+1-416-555-0123"}) {
            LoginRequest req = new LoginRequest();
            req.setIdentifier(spelling);
            req.setPassword("guess");
            assertThatThrownBy(() -> authService.login(req)).isInstanceOf(IllegalArgumentException.class);
        }

        verify(loginRateLimiter, times(3)).recordFailure("u:" + userId);
    }

    @Test
    void login_aLockedAccountRefusesEvenTheCorrectPassword() {
        UUID userId = UUID.randomUUID();
        User user = User.builder().email("a@b.com").passwordHash("hashed").role(UserRole.ELDER).build();
        user.setId(userId);
        when(userRepository.findByEmail("a@b.com")).thenReturn(Optional.of(user));
        doThrow(new com.towinly.common.exception.RateLimitException("locked"))
                .when(loginRateLimiter).checkLocked("u:" + userId);

        LoginRequest req = new LoginRequest();
        req.setIdentifier("a@b.com");
        req.setPassword("right");

        assertThatThrownBy(() -> authService.login(req))
                .isInstanceOf(com.towinly.common.exception.RateLimitException.class);
        verify(jwtUtil, never()).generateToken(any(), any(), any(), anyInt());
    }

    @Test
    void login_anUnknownIdentifierStillPaysForABcrypt() {
        when(userRepository.findByEmail("nobody@x.com")).thenReturn(Optional.empty());
        LoginRequest req = new LoginRequest();
        req.setIdentifier("nobody@x.com");
        req.setPassword("guess");

        assertThatThrownBy(() -> authService.login(req)).isInstanceOf(IllegalArgumentException.class);
        verify(passwordEncoder).matches(eq("guess"), anyString());
        verify(loginRateLimiter).recordFailure("i:nobody@x.com");
    }

    @Test
    void shouldLoginByPhoneEvenWhenNotVerified() {
        // A brand-new account hasn't done the SMS OTP yet (phoneVerified = false).
        // The password proves identity, so phone login must still work.
        LoginRequest req = new LoginRequest();
        req.setIdentifier("+14165550123");
        req.setPassword("password123");

        UUID userId = UUID.randomUUID();
        User user = User.builder().phone("+14165550123").passwordHash("hashed").role(UserRole.ELDER).build();
        user.setId(userId);
        user.setPhoneVerified(false);

        when(userRepository.findByPhone("+14165550123")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("password123", "hashed")).thenReturn(true);
        when(jwtUtil.generateToken(userId.toString(), null, "ELDER", 0)).thenReturn("mock-token");

        var response = authService.login(req);

        assertThat(response.getToken()).isEqualTo("mock-token");
        assertThat(response.getRole()).isEqualTo("ELDER");
    }

    @Test
    void shouldMatchPhoneTypedWithSpacesAndDashes() {
        // Stored as "+14165550123" at registration; user types it with separators.
        LoginRequest req = new LoginRequest();
        req.setIdentifier("+1 416-555 0123");
        req.setPassword("password123");

        UUID userId = UUID.randomUUID();
        User user = User.builder().phone("+14165550123").passwordHash("hashed").role(UserRole.ELDER).build();
        user.setId(userId);

        when(userRepository.findByPhone("+14165550123")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("password123", "hashed")).thenReturn(true);
        when(jwtUtil.generateToken(userId.toString(), null, "ELDER", 0)).thenReturn("mock-token");

        var response = authService.login(req);

        assertThat(response.getToken()).isEqualTo("mock-token");
    }

    @Test
    void shouldSetFirstPasswordOnGoogleOnlyAccount() {
        UUID userId = UUID.randomUUID();
        User user = User.builder().email("g@email.com").passwordHash(null).role(UserRole.HELPER).build();
        user.setId(userId);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(passwordEncoder.encode("newpassword1")).thenReturn("hashed-new");

        authService.setPassword(userId, "newpassword1");

        assertThat(user.getPasswordHash()).isEqualTo("hashed-new");
        verify(userRepository).save(user);
    }

    @Test
    void shouldRefuseSetPasswordWhenOneAlreadyExists() {
        // Replacing an existing password must go through change-password,
        // which verifies the current one first.
        UUID userId = UUID.randomUUID();
        User user = User.builder().email("g@email.com").passwordHash("existing").role(UserRole.HELPER).build();
        user.setId(userId);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.setPassword(userId, "newpassword1"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("already has a password");
        verify(userRepository, never()).save(any());
    }

    // SEC-08: "Email already registered" confirmed the address belonged to a real
    // Towinly account, so a list of emails could be sifted for members before anyone
    // was targeted. Login and forgot-password were already anti-enumeration; register
    // was the outlier. A username may still be named: it is public in this product.
    @Test
    void register_doesNotRevealThatAnEmailAlreadyBelongsToAMember() {
        RegisterRequest req = registerRequest();
        req.setEmail("known@member.com");
        when(userRepository.existsByEmail("known@member.com")).thenReturn(true);

        assertThatCode(() -> authService.register(req)).doesNotThrowAnyException();

        // No second account and no second pending signup. No verification mail
        // either: that would hand a stranger a working signup for someone else's
        // address. The owner does get a separate note, covered by the next test.
        verify(userRepository, never()).save(any());
        verify(pendingRepository, never()).save(any(PendingRegistration.class));
        verify(emailService, never()).sendVerificationEmail(any(), anyString());
    }

    // The caller is told nothing, so without this note a person who simply forgot
    // they had an account would wait forever for a mail that is never coming, with
    // no way to find out why. It goes only to the address that already exists, so
    // a stranger learns nothing from it, and it carries the way back in.
    @Test
    void register_tellsTheRealOwnerWhenSomeoneTriesTheirAddress() {
        RegisterRequest req = registerRequest();
        req.setEmail("known@member.com");
        when(userRepository.existsByEmail("known@member.com")).thenReturn(true);

        authService.register(req);

        verify(emailService).sendAlreadyRegisteredEmail(eq("known@member.com"), anyString());
    }

    @Test
    void register_answersANewEmailAndAKnownEmailTheSameWay() {
        RegisterRequest fresh = registerRequest();
        fresh.setEmail("nobody@nowhere.com");
        RegisterRequest known = registerRequest();
        known.setEmail("known@member.com");
        when(userRepository.existsByEmail("nobody@nowhere.com")).thenReturn(false);
        when(userRepository.existsByEmail("known@member.com")).thenReturn(true);

        assertThatCode(() -> authService.register(fresh)).doesNotThrowAnyException();
        assertThatCode(() -> authService.register(known)).doesNotThrowAnyException();
    }

    @Test
    void register_checksThePasswordPolicyBeforeTheEmail_soAWeakPasswordIsNotAnOracle() {
        // If the duplicate-email return came first, a deliberately weak password would
        // answer "no complaint" for a member and "too weak" for a stranger — the same
        // oracle by another door.
        RegisterRequest req = registerRequest();
        req.setEmail("known@member.com");
        // Once the policy runs first, this stub is never reached — hence lenient.
        lenient().when(userRepository.existsByEmail("known@member.com")).thenReturn(true);
        doThrow(new IllegalArgumentException("Password is too weak"))
                .when(passwordPolicy).validate(any(), any(), any());

        assertThatThrownBy(() -> authService.register(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("too weak");
    }

    private RegisterRequest registerRequest() {
        RegisterRequest req = new RegisterRequest();
        req.setUsername("testuser");
        req.setPassword("password123");
        req.setRole(UserRole.ELDER);
        return req;
    }
}
