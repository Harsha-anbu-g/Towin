package com.towin.common.seed;

import com.towin.common.entity.User;
import com.towin.common.enums.FamilyLinkStatus;
import com.towin.common.enums.UserRole;
import com.towin.common.repository.UserRepository;
import com.towin.common.service.TrustScoreService;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.emergency.repository.EmergencyContactRepository;
import com.towin.family.entity.FamilyLink;
import com.towin.family.repository.FamilyAlertRepository;
import com.towin.family.repository.FamilyLinkRepository;
import com.towin.messaging.repository.MessageRepository;
import com.towin.need.entity.Need;
import com.towin.need.repository.NeedApplicationRepository;
import com.towin.need.repository.NeedRepository;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;
import com.towin.report.repository.ReportRepository;
import com.towin.review.repository.ReviewRepository;
import com.towin.streak.repository.UserStreakRepository;
import com.towin.trust.repository.TrustProgressionLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * US-014: the demo shows the family feature working — a demo FAMILY account
 * (Sarah, Margaret's daughter) with an ACTIVE link to the demo elder, one demo
 * elder connection shared with family and another kept private.
 */
@ExtendWith(MockitoExtension.class)
class DemoDataSeederFamilyTest {

    @Mock UserRepository userRepository;
    @Mock ElderProfileRepository elderProfileRepository;
    @Mock HelperProfileRepository helperProfileRepository;
    @Mock ConnectionRepository connectionRepository;
    @Mock MessageRepository messageRepository;
    @Mock NeedRepository needRepository;
    @Mock NeedApplicationRepository needApplicationRepository;
    @Mock ReviewRepository reviewRepository;
    @Mock UserStreakRepository userStreakRepository;
    @Mock EmergencyContactRepository emergencyContactRepository;
    @Mock ReportRepository reportRepository;
    @Mock TrustProgressionLogRepository trustProgressionLogRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock TrustScoreService trustScoreService;
    @Mock PlatformTransactionManager transactionManager;
    @Mock FamilyLinkRepository familyLinkRepository;
    @Mock FamilyAlertRepository familyAlertRepository;

    @InjectMocks DemoDataSeeder seeder;

    @BeforeEach
    void stubHappyPath() {
        // Additive mode (no purge) unless a test flips it back on.
        ReflectionTestUtils.setField(seeder, "resetEnabled", false);

        lenient().when(userRepository.findByEmail(anyString())).thenReturn(Optional.empty());
        lenient().when(passwordEncoder.encode(anyString())).thenReturn("HASH");
        lenient().when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            if (u.getId() == null) u.setId(UUID.randomUUID());
            return u;
        });
        lenient().when(connectionRepository.save(any(Connection.class))).thenAnswer(inv -> {
            Connection c = inv.getArgument(0);
            if (c.getId() == null) c.setId(UUID.randomUUID());
            return c;
        });
        lenient().when(needRepository.save(any(Need.class))).thenAnswer(inv -> {
            Need n = inv.getArgument(0);
            if (n.getId() == null) n.setId(UUID.randomUUID());
            return n;
        });
        lenient().when(needRepository.findByElderIdOrderByCreatedAtDesc(any(), any()))
                .thenReturn(Page.empty());
    }

    private User savedUser(String email) {
        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository, atLeastOnce()).save(captor.capture());
        return captor.getAllValues().stream()
                .filter(u -> email.equals(u.getEmail()))
                .findFirst().orElse(null);
    }

    @Test
    void seedsSarahAsFamilyRoleDemoAccount() {
        seeder.run(null);

        verify(transactionManager, never()).rollback(any());
        User sarah = savedUser("demo.sarah@towin.app");
        assertThat(sarah).as("demo FAMILY account seeded").isNotNull();
        assertThat(sarah.getRole()).isEqualTo(UserRole.FAMILY);
        assertThat(DemoDataSeeder.DEMO_EMAILS).contains("demo.sarah@towin.app");
    }

    @Test
    void seedsActiveDaughterLinkToDemoElder() {
        seeder.run(null);

        ArgumentCaptor<FamilyLink> captor = ArgumentCaptor.forClass(FamilyLink.class);
        verify(familyLinkRepository, atLeastOnce()).save(captor.capture());
        FamilyLink link = captor.getValue();
        assertThat(link.getElder().getEmail()).isEqualTo(DemoDataSeeder.ELDER_DEMO_EMAIL);
        assertThat(link.getFamilyUser().getEmail()).isEqualTo("demo.sarah@towin.app");
        assertThat(link.getStatus()).isEqualTo(FamilyLinkStatus.ACTIVE);
        assertThat(link.getRelationship()).isEqualTo("Daughter");
        assertThat(link.getRespondedAt()).as("accepted links carry responded_at").isNotNull();
    }

    @Test
    void sharesOneElderConnectionAndKeepsAnotherPrivate() {
        seeder.run(null);

        ArgumentCaptor<Connection> captor = ArgumentCaptor.forClass(Connection.class);
        verify(connectionRepository, atLeastOnce()).save(captor.capture());
        List<Connection> margaretConnections = captor.getAllValues().stream()
                .filter(c -> DemoDataSeeder.ELDER_DEMO_EMAIL.equals(c.getUserA().getEmail()))
                .distinct()
                .toList();

        List<Connection> shared = margaretConnections.stream()
                .filter(c -> Boolean.TRUE.equals(c.getSharedWithFamily())).toList();
        List<Connection> kept = margaretConnections.stream()
                .filter(c -> !Boolean.TRUE.equals(c.getSharedWithFamily())).toList();
        assertThat(shared).as("one elder connection is shared with family").isNotEmpty();
        assertThat(kept).as("another elder connection stays private").isNotEmpty();
    }

    @Test
    void resetPurgesFamilyRowsBeforeReseeding() {
        ReflectionTestUtils.setField(seeder, "resetEnabled", true);
        lenient().when(passwordEncoder.matches(anyString(), anyString())).thenReturn(true);

        seeder.run(null);

        verify(transactionManager, never()).rollback(any());
        verify(familyLinkRepository, atLeastOnce()).deleteByElderIdOrFamilyUserId(any(), any());
        verify(familyAlertRepository, atLeastOnce()).deleteByElderId(any());
    }
}
