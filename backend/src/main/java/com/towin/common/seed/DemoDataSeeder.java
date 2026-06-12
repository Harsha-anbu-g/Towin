package com.towin.common.seed;

import com.towin.common.entity.User;
import com.towin.common.enums.*;
import com.towin.common.repository.UserRepository;
import com.towin.common.service.TrustScoreService;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.emergency.entity.EmergencyContact;
import com.towin.emergency.repository.EmergencyContactRepository;
import com.towin.messaging.entity.Message;
import com.towin.messaging.repository.MessageRepository;
import com.towin.need.entity.Need;
import com.towin.need.entity.NeedApplication;
import com.towin.need.repository.NeedApplicationRepository;
import com.towin.need.repository.NeedRepository;
import com.towin.profile.entity.ElderProfile;
import com.towin.profile.entity.HelperProfile;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;
import com.towin.review.entity.Review;
import com.towin.review.repository.ReviewRepository;
import com.towin.streak.entity.UserStreak;
import com.towin.streak.repository.UserStreakRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Idempotent, additive demo content so the demo accounts show every feature
 * alive: connections at several trust stages, open/assigned needs, messages,
 * reviews, streaks, and an emergency contact. Never deletes or overwrites
 * non-demo data; existing rows are left untouched. Safe to run on every boot.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "app.demo", name = "seed-enabled", havingValue = "true", matchIfMissing = true)
public class DemoDataSeeder implements ApplicationRunner {

    public static final String ELDER_DEMO_EMAIL  = "elder@gmail.com";
    public static final String HELPER_DEMO_EMAIL = "helper@gmail.com";

    // Demo personas live in a downtown-Toronto cluster so discovery works
    private static final BigDecimal LAT = new BigDecimal("43.6510");
    private static final BigDecimal LNG = new BigDecimal("-79.3470");

    private final UserRepository userRepository;
    private final ElderProfileRepository elderProfileRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final ConnectionRepository connectionRepository;
    private final MessageRepository messageRepository;
    private final NeedRepository needRepository;
    private final NeedApplicationRepository needApplicationRepository;
    private final ReviewRepository reviewRepository;
    private final UserStreakRepository userStreakRepository;
    private final EmergencyContactRepository emergencyContactRepository;
    private final PasswordEncoder passwordEncoder;
    private final TrustScoreService trustScoreService;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        try {
            seed();
        } catch (Exception e) {
            // Demo content must never take the app down
            log.error("Demo data seeding failed (app continues normally)", e);
        }
    }

    private void seed() {
        User margaret = ensureUser(ELDER_DEMO_EMAIL, "+14165550101", UserRole.ELDER, "12345678");
        User james    = ensureUser(HELPER_DEMO_EMAIL, "+14165550102", UserRole.HELPER, "123456789");
        User priya    = ensureUser("demo.priya@towin.app", "+14165550103", UserRole.HELPER, "DemoPriya!2026");
        User tom      = ensureUser("demo.tom@towin.app",   "+14165550104", UserRole.HELPER, "DemoTom!2026");
        User david    = ensureUser("demo.david@towin.app", "+14165550105", UserRole.ELDER,  "DemoDavid!2026");
        User grace    = ensureUser("demo.grace@towin.app", "+14165550106", UserRole.ELDER,  "DemoGrace!2026");

        ensureElderProfile(margaret, "Margaret", 72,
                "Retired teacher. I love chess, gardening, and a good cup of tea.",
                new String[]{"Chess", "Gardening", "Reading"}, "Retired teacher");
        ensureElderProfile(david, "David Chen", 76,
                "Former engineer, enjoys cooking and music.",
                new String[]{"Cooking", "Music", "Technology"}, "Retired engineer");
        ensureElderProfile(grace, "Grace Liu", 70,
                "I paint watercolours and like quiet walks in the park.",
                new String[]{"Painting", "Walking", "Movies"}, "Retired pharmacist");

        ensureHelperProfile(james, "James", 28,
                "I love to play chess and helping with anything tech.",
                new String[]{"Chess", "Technology", "Errands"}, new String[]{"Chess", "Cycling"});
        ensureHelperProfile(priya, "Priya Sharma", 24,
                "Nursing student. Happy to help with errands, cooking, or just company.",
                new String[]{"Errands", "Cooking", "Companionship"}, new String[]{"Baking", "Yoga"});
        ensureHelperProfile(tom, "Tom Walker", 31,
                "Software dev who fixes phones, tablets and wifi. Patient explainer.",
                new String[]{"Technology", "Transportation"}, new String[]{"Hiking", "Photography"});

        // Trust progression at different stages — the core differentiator
        Connection cTrusted = ensureConnection(margaret, james, ConnectionStatus.ACTIVE, TrustLevel.TRUSTED, james,
                "Hi Margaret, I'd love to help with tech or play a game of chess!");
        Connection cMessaging = ensureConnection(margaret, priya, ConnectionStatus.ACTIVE, TrustLevel.MESSAGING, priya,
                "Hello Margaret! I'm Priya — happy to help with errands or cooking.");
        Connection cVideo = ensureConnection(david, james, ConnectionStatus.ACTIVE, TrustLevel.VIDEO_CALL, james,
                "Hi David, fellow engineer here. Happy to help with anything.");
        ensureConnection(grace, priya, ConnectionStatus.ACTIVE, TrustLevel.PHONE_CALL, priya,
                "Hi Grace, I'd love to keep you company on your walks.");
        // A pending request so the accept/decline flow is visible
        ensureConnection(margaret, tom, ConnectionStatus.PENDING, TrustLevel.DISCOVERED, tom,
                "Hello Margaret! I can fix any phone or wifi problem — happy to help.");

        seedMessagesIfEmpty(cTrusted, List.of(
                msg(james,    "Hi Margaret! Ready for our chess game on Thursday?"),
                msg(margaret, "Of course! I have been practicing my openings."),
                msg(james,    "Ha! I will bring the biscuits then. 3pm as usual?"),
                msg(margaret, "Perfect. And thank you again for setting up my tablet."),
                msg(james,    "Any time. Video calling your sister works now, right?"),
                msg(margaret, "It does — we talked for an hour yesterday. Lovely.")));
        seedMessagesIfEmpty(cMessaging, List.of(
                msg(priya,    "Hello Margaret! Thanks for accepting my request."),
                msg(margaret, "Hello Priya. Your profile says you like baking?"),
                msg(priya,    "I do! I make a mean banana bread. Could bring some by once we know each other better.")));
        seedMessagesIfEmpty(cVideo, List.of(
                msg(james, "David, our video call was great — same time next week?"),
                msg(david, "Yes! And bring that pasta recipe you mentioned.")));

        Need tablet = ensureNeed(margaret, "Help setting up my new tablet",
                "My daughter sent me a tablet and I would love help setting it up for video calls.",
                NeedCategory.OTHER, NeedUrgency.NORMAL, NeedStatus.COMPLETED);
        ensureNeed(margaret, "Ride to my doctor appointment",
                "Appointment on Tuesday at 10am, clinic is 15 minutes away.",
                NeedCategory.TRANSPORTATION, NeedUrgency.URGENT, NeedStatus.OPEN);
        ensureNeed(margaret, "Company for my morning walk",
                "I walk in Riverdale Park most mornings and would enjoy company.",
                NeedCategory.COMPANIONSHIP, NeedUrgency.NORMAL, NeedStatus.OPEN);
        Need chess = ensureNeed(david, "Weekly chess and tea company",
                "Looking for someone to play chess with on weekend afternoons.",
                NeedCategory.COMPANIONSHIP, NeedUrgency.NORMAL, NeedStatus.OPEN);
        ensureNeed(grace, "Light apartment cleaning",
                "A hand with vacuuming and dusting once a week.",
                NeedCategory.CLEANING, NeedUrgency.NORMAL, NeedStatus.OPEN);

        ensureApplication(chess, priya, "I'd love to learn chess while keeping you company!");

        ensureReview(margaret, james, tablet, 5,
                "James set up my tablet and patiently taught me video calling. Wonderful young man.",
                List.of("Patient", "Friendly"));
        ensureReview(david, james, null, 4,
                "Very reliable and great company. Always on time.",
                List.of("Reliable", "Punctual"));
        ensureReview(james, margaret, null, 5,
                "Margaret is delightful — and a much better chess player than she admits.",
                List.of("Friendly", "Welcoming"));

        ensureStreak(margaret, 6, 14);
        ensureStreak(david, 3, 9);

        ensureEmergencyContact(margaret, "Sarah (daughter)", "+14165550199", "Family");

        for (User u : List.of(margaret, james, priya, tom, david, grace)) {
            try {
                trustScoreService.recalculate(u.getId());
            } catch (Exception e) {
                log.warn("Trust recalculation failed for {}: {}", u.getEmail(), e.getMessage());
            }
        }
        log.info("Demo data seeding complete");
    }

    // ── helpers ──────────────────────────────────────────────────────────

    private User ensureUser(String email, String phone, UserRole role, String rawPassword) {
        Optional<User> existing = userRepository.findByEmail(email);
        if (existing.isPresent()) {
            User u = existing.get();
            boolean dirty = false;
            // Demo accounts must be discoverable: pin them to the demo cluster if unset
            if (u.getLocationLat() == null || u.getLocationLng() == null) {
                u.setLocationLat(LAT); u.setLocationLng(LNG); dirty = true;
            }
            if (u.getVerificationStatus() != VerificationStatus.VERIFIED) {
                u.setVerificationStatus(VerificationStatus.VERIFIED); dirty = true;
            }
            if (!u.isPhoneVerified()) { u.setPhoneVerified(true); dirty = true; }
            return dirty ? userRepository.save(u) : u;
        }
        User u = User.builder()
                .email(email)
                .phone(uniquePhone(phone))
                .passwordHash(passwordEncoder.encode(rawPassword))
                .role(role)
                .verificationStatus(VerificationStatus.VERIFIED)
                .locationLat(LAT.add(jitter(email)))
                .locationLng(LNG.add(jitter(email + "lng")))
                .city("Toronto")
                .isActive(true)
                .dateOfBirth(role == UserRole.ELDER ? LocalDate.of(1953, 5, 14) : LocalDate.of(1998, 9, 2))
                .build();
        u.setPhoneVerified(true);
        log.info("Seeding demo user {}", email);
        return userRepository.save(u);
    }

    private String uniquePhone(String preferred) {
        return userRepository.existsByPhone(preferred)
                ? preferred.substring(0, preferred.length() - 4) + (1000 + (int) (Math.random() * 9000))
                : preferred;
    }

    /** Small deterministic offset (≤ ~0.6 km) so personas aren't stacked on one point. */
    private BigDecimal jitter(String key) {
        return new BigDecimal(Math.abs(key.hashCode()) % 60).movePointLeft(4);
    }

    private void ensureElderProfile(User user, String name, int age, String bio,
                                    String[] interests, String occupation) {
        if (elderProfileRepository.existsByUserId(user.getId())) return;
        elderProfileRepository.save(ElderProfile.builder()
                .user(user).name(name).age(age).bio(bio)
                .interests(interests)
                .languages(new String[]{"English"})
                .occupation(occupation)
                .lookingFor(LookingForType.BOTH)
                .build());
    }

    private void ensureHelperProfile(User user, String name, int age, String bio,
                                     String[] skills, String[] hobbies) {
        if (helperProfileRepository.existsByUserId(user.getId())) return;
        helperProfileRepository.save(HelperProfile.builder()
                .user(user).name(name).age(age).bio(bio)
                .skillsOffered(skills)
                .languages(new String[]{"English"})
                .availabilityDays(new String[]{"Saturday", "Sunday", "Wednesday"})
                .availabilityTimes(new String[]{"Afternoon", "Evening"})
                .hobbies(hobbies)
                .backgroundCheckStatus(BackgroundCheckStatus.VERIFIED)
                .build());
    }

    private Connection ensureConnection(User a, User b, ConnectionStatus status,
                                        TrustLevel level, User initiator, String requestMessage) {
        Optional<Connection> existing = connectionRepository.findBetweenUsers(a.getId(), b.getId());
        if (existing.isPresent()) return existing.get();
        boolean active = status == ConnectionStatus.ACTIVE;
        return connectionRepository.save(Connection.builder()
                .userA(a).userB(b)
                .status(status)
                .currentTrustLevel(level)
                .initiatedBy(initiator)
                .requestMessage(requestMessage)
                .confirmedByA(active)
                .confirmedByB(active)
                .build());
    }

    private record Draft(User sender, String content) {}
    private Draft msg(User sender, String content) { return new Draft(sender, content); }

    private void seedMessagesIfEmpty(Connection conn, List<Draft> drafts) {
        if (messageRepository.countByConnectionId(conn.getId()) > 0) return;
        for (Draft d : drafts) {
            messageRepository.save(Message.builder()
                    .connection(conn)
                    .sender(d.sender())
                    .content(d.content())
                    .type(MessageType.TEXT)
                    .build());
        }
    }

    private Need ensureNeed(User elder, String title, String description,
                            NeedCategory category, NeedUrgency urgency, NeedStatus status) {
        Optional<Need> existing = needRepository
                .findByElderIdOrderByCreatedAtDesc(elder.getId(), org.springframework.data.domain.Pageable.unpaged())
                .stream().filter(n -> title.equals(n.getTitle())).findFirst();
        if (existing.isPresent()) return existing.get();
        return needRepository.save(Need.builder()
                .elder(elder).title(title).description(description)
                .category(category).urgency(urgency).status(status)
                .schedule(NeedSchedule.ONE_TIME)
                .locationLat(elder.getLocationLat()).locationLng(elder.getLocationLng())
                .build());
    }

    private void ensureApplication(Need need, User helper, String message) {
        if (needApplicationRepository.findByNeedIdAndHelperId(need.getId(), helper.getId()).isPresent()) return;
        needApplicationRepository.save(NeedApplication.builder()
                .need(need).helper(helper).message(message)
                .status(ApplicationStatus.PENDING)
                .build());
    }

    private void ensureReview(User reviewer, User reviewee, Need need, int rating,
                              String comment, List<String> tags) {
        boolean exists = reviewRepository.findByRevieweeIdOrderByCreatedAtDesc(reviewee.getId())
                .stream().anyMatch(r -> r.getReviewer().getId().equals(reviewer.getId()));
        if (exists) return;
        reviewRepository.save(Review.builder()
                .reviewer(reviewer).reviewee(reviewee).need(need)
                .rating(rating).comment(comment).tags(tags)
                .safetyConcern(false)
                .build());
    }

    private void ensureStreak(User user, int current, int longest) {
        if (userStreakRepository.findByUserId(user.getId()).isPresent()) return;
        UserStreak s = new UserStreak();
        s.setUserId(user.getId());
        s.setCurrentStreak(current);
        s.setLongestStreak(longest);
        // Yesterday — so a demo visitor can check in today and grow the streak
        s.setLastCheckinDate(LocalDate.now().minusDays(1));
        userStreakRepository.save(s);
    }

    private void ensureEmergencyContact(User elder, String name, String phone, String relationship) {
        if (emergencyContactRepository.countByElderId(elder.getId()) > 0) return;
        EmergencyContact c = new EmergencyContact();
        c.setElder(elder);
        c.setName(name);
        c.setPhone(phone);
        c.setRelationship(relationship);
        c.setInactivityDays(5);
        emergencyContactRepository.save(c);
    }
}
