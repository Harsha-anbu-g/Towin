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
import com.towin.report.repository.ReportRepository;
import com.towin.review.entity.Review;
import com.towin.review.repository.ReviewRepository;
import com.towin.streak.entity.UserStreak;
import com.towin.streak.repository.UserStreakRepository;
import com.towin.trust.repository.TrustProgressionLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Idempotent, additive demo content so the demo accounts show every feature
 * alive: connections at several trust stages, open/assigned needs, messages,
 * reviews, streaks, and an emergency contact. Never deletes or overwrites
 * non-demo data; existing rows are left untouched. Safe to run on every boot.
 *
 * <h3>Self-healing demo (event-driven)</h3>
 * This class is the single source of truth for what the public demo looks like.
 * It seeds at boot, and {@link #resetDemo()} re-applies this exact baseline on
 * demand — wiping whatever visitors changed (profiles, account settings,
 * password, messages, needs, connections) and restoring it. The reset is NOT on
 * a timer: {@link DemoResetCoordinator} fires it a short, debounced delay after
 * someone actually changes a demo account, so with few visitors nothing runs
 * until a change happens, and an active visitor keeps their changes until they
 * go quiet.
 *
 * <h3>Adding your own demo content (e.g. from VS Code)</h3>
 * Anything you change by clicking around inside the live app on a demo account
 * is temporary — the next reset reverts it. To make something a PERMANENT part
 * of the demo, add it here and push (Railway redeploys and re-seeds):
 * <ul>
 *   <li>a new request → add an {@code ensureNeed(...)} line in {@link #seed()}</li>
 *   <li>a new connection/chat → {@code ensureConnection(...)} + {@code seedMessagesIfEmpty(...)}</li>
 *   <li>a new persona → {@code ensureUser(...)} + {@code ensureElder/HelperProfile(...)}</li>
 *   <li>change a persona's name/bio/interests → edit the values in {@link #seed()}</li>
 * </ul>
 * The {@code ensure*} helpers are idempotent, so re-running is always safe.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "app.demo", name = "seed-enabled", havingValue = "true", matchIfMissing = true)
public class DemoDataSeeder implements ApplicationRunner {

    public static final String ELDER_DEMO_EMAIL  = "elder@gmail.com";
    public static final String HELPER_DEMO_EMAIL = "helper@gmail.com";

    // Every demo account, so DemoResetCoordinator can tell when a write targets
    // one. Keep in sync with the ensureUser(...) calls in seed().
    public static final List<String> DEMO_EMAILS = List.of(
            ELDER_DEMO_EMAIL, HELPER_DEMO_EMAIL,
            "demo.priya@towin.app", "demo.tom@towin.app", "demo.david@towin.app",
            "demo.grace@towin.app", "demo.nina@towin.app", "demo.rose@towin.app",
            "demo.helen@towin.app", "demo.arthur@towin.app", "demo.sofia@towin.app");

    // All demo personas (elders and helpers) are pinned to Montreal, Canada so
    // they cluster together and "near me" discovery matches across both roles.
    private static final BigDecimal ELDER_LAT  = new BigDecimal("45.5019");
    private static final BigDecimal ELDER_LNG  = new BigDecimal("-73.5674");
    private static final String     ELDER_CITY = "Montreal";
    private static final BigDecimal HELPER_LAT  = ELDER_LAT;
    private static final BigDecimal HELPER_LNG  = ELDER_LNG;
    private static final String     HELPER_CITY = ELDER_CITY;

    private BigDecimal baseLat(UserRole role)  { return role == UserRole.ELDER ? ELDER_LAT  : HELPER_LAT;  }
    private BigDecimal baseLng(UserRole role)  { return role == UserRole.ELDER ? ELDER_LNG  : HELPER_LNG;  }
    private String     baseCity(UserRole role) { return role == UserRole.ELDER ? ELDER_CITY : HELPER_CITY; }

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
    private final ReportRepository reportRepository;
    private final TrustProgressionLogRepository trustProgressionLogRepository;
    private final PasswordEncoder passwordEncoder;
    private final TrustScoreService trustScoreService;
    private final PlatformTransactionManager transactionManager;

    // When true (default), wipe content accumulated on the public demo accounts
    // on each boot before re-seeding, so the demo always shows a clean, minimal
    // set. Set APP_DEMO_RESET_ENABLED=false to keep whatever visitors leave.
    @Value("${app.demo.reset-enabled:true}")
    private boolean resetEnabled;

    @Override
    public void run(ApplicationArguments args) {
        // The transaction lives INSIDE this try via TransactionTemplate, not on
        // run() itself. If run() were @Transactional, a caught seeding error would
        // still leave the transaction rollback-only and the commit at the proxy
        // boundary would throw UnexpectedRollbackException — failing app startup.
        // Containing it here keeps the promise that demo seeding never takes the
        // app down: on error we roll back and continue serving existing data.
        try {
            new TransactionTemplate(transactionManager).executeWithoutResult(status -> seed());
        } catch (Exception e) {
            log.error("Demo data seeding failed (app continues normally)", e);
        }
    }

    /**
     * Re-apply the demo baseline, wiping whatever visitors changed on the demo
     * accounts. Triggered by {@link DemoResetCoordinator} a short, debounced
     * delay after a demo account is changed — never on a fixed timer. No-op when
     * reset is disabled (APP_DEMO_RESET_ENABLED=false keeps visitor data). Runs
     * in its own transaction; exceptions propagate to the caller, which logs and
     * swallows them so a failed reset never disrupts the running app.
     */
    public void resetDemo() {
        if (!resetEnabled) return;
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> seed());
    }

    /** Whether {@link #resetDemo()} will actually restore the baseline, or
     *  silently keep visitor data (APP_DEMO_RESET_ENABLED=false). Lets callers
     *  like the admin reset endpoint fail loudly instead of pretending success. */
    public boolean isResetEnabled() {
        return resetEnabled;
    }

    private void seed() {
        User margaret = ensureUser(ELDER_DEMO_EMAIL, "+14165550101", UserRole.ELDER, "12345678");
        User james    = ensureUser(HELPER_DEMO_EMAIL, "+14385355782", UserRole.HELPER, "123456789");
        User priya    = ensureUser("demo.priya@towin.app", "+14165550103", UserRole.HELPER, "DemoPriya!2026");
        User tom      = ensureUser("demo.tom@towin.app",   "+14165550104", UserRole.HELPER, "DemoTom!2026");
        User david    = ensureUser("demo.david@towin.app", "+14165550105", UserRole.ELDER,  "DemoDavid!2026");
        User grace    = ensureUser("demo.grace@towin.app", "+14165550106", UserRole.ELDER,  "DemoGrace!2026");
        User nina     = ensureUser("demo.nina@towin.app",  "+14165550107", UserRole.HELPER, "DemoNina!2026");
        User rose     = ensureUser("demo.rose@towin.app",  "+14165550108", UserRole.ELDER,  "DemoRose!2026");
        User helen    = ensureUser("demo.helen@towin.app", "+14165550109", UserRole.ELDER,  "DemoHelen!2026");
        User arthur   = ensureUser("demo.arthur@towin.app","+14165550110", UserRole.ELDER,  "DemoArthur!2026");
        User sofia    = ensureUser("demo.sofia@towin.app", "+14165550111", UserRole.HELPER, "DemoSofia!2026");

        List<User> demoUsers = List.of(margaret, james, priya, tom, david, grace, nina, rose, helen, arthur, sofia);

        // Clear anything visitors left on the public demo accounts so the rest of
        // this method re-seeds a clean, minimal showcase (one of each type).
        if (resetEnabled) {
            demoUsers.forEach(this::purgeDemoContent);
            log.info("Demo content reset: cleared accumulated data on demo accounts");
        }

        ensureElderProfile(margaret, "Margaret", 72,
                "Retired teacher. I love chess, gardening, and a good cup of tea.",
                new String[]{"Chess", "Gardening", "Reading"}, "Retired teacher", Gender.FEMALE,
                "https://towin-uploads.s3.us-east-1.amazonaws.com/demo/margaret.jpg",
                "https://facebook.com/margaret.tw");
        ensureElderProfile(david, "David Chen", 76,
                "Former engineer, enjoys cooking and music.",
                new String[]{"Cooking", "Music", "Technology"}, "Retired engineer", Gender.MALE, null,
                "https://facebook.com/davidchen.tw");
        ensureElderProfile(grace, "Grace Liu", 70,
                "I paint watercolours and like quiet walks in the park.",
                new String[]{"Painting", "Walking", "Movies"}, "Retired pharmacist", Gender.FEMALE,
                "https://towin-uploads.s3.us-east-1.amazonaws.com/demo/grace.jpg",
                "https://facebook.com/graceliu.tw");
        ensureElderProfile(rose, "Rose Martin", 74,
                "Retired librarian. I love crosswords, reading, and a quiet afternoon with good company.",
                new String[]{"Reading", "Crosswords", "Gardening"}, "Retired librarian", Gender.FEMALE,
                "https://towin-uploads.s3.us-east-1.amazonaws.com/demo/rose.jpg",
                "https://facebook.com/rosemartin.tw");
        ensureElderProfile(helen, "Helen Park", 71,
                "Retired nurse who loves knitting, baking, and good conversation over tea.",
                new String[]{"Cooking", "Reading", "Companionship"}, "Retired nurse", Gender.FEMALE, null,
                "https://facebook.com/helenpark.tw");
        ensureElderProfile(arthur, "Arthur Miles", 68,
                "Former history teacher. I love chess, documentaries, and sharing a good meal.",
                new String[]{"Chess", "Cooking", "Reading"}, "Retired teacher", Gender.MALE, null,
                "https://facebook.com/arthurmiles.tw");

        ensureHelperProfile(james, "Harsha", 23,
                "I love to play chess and helping with anything tech.",
                new String[]{"Chess", "Technology", "Errands"}, new String[]{"Chess", "Cycling"},
                Gender.MALE, "Tech Support Volunteer",
                "https://towin-uploads.s3.us-east-1.amazonaws.com/demo/james.jpg",
                null,
                "https://www.instagram.com/harsha._.ag/",
                new String[]{"English", "Tamil"});
        ensureHelperProfile(priya, "Priya Sharma", 24,
                "Nursing student. Happy to help with errands, cooking, or just company.",
                new String[]{"Errands", "Cooking", "Companionship"}, new String[]{"Baking", "Yoga"},
                Gender.FEMALE, "Nursing Student", null,
                "https://facebook.com/priya.helper.tw", null,
                new String[]{"English"});
        ensureHelperProfile(tom, "Tom Walker", 31,
                "Software dev who fixes phones, tablets and wifi. Patient explainer.",
                new String[]{"Technology", "Transportation"}, new String[]{"Hiking", "Photography"},
                Gender.MALE, "Software Developer",
                "https://towin-uploads.s3.us-east-1.amazonaws.com/demo/tom.jpg",
                "https://facebook.com/tom.helper.tw", null,
                new String[]{"English"});
        ensureHelperProfile(nina, "Nina Okafor", 26,
                "Friendly driver and errand-runner who loves a good chat.",
                new String[]{"Transportation", "Errands", "Companionship"}, new String[]{"Driving", "Cooking"},
                Gender.FEMALE, "Driver", null,
                "https://facebook.com/nina.helper.tw", null,
                new String[]{"English"});
        ensureHelperProfile(sofia, "Sofia Reyes", 29,
                "Retired teacher's aide. I love reading aloud, gardening, and gentle tech help.",
                new String[]{"Companionship", "Technology", "Gardening"}, new String[]{"Reading", "Gardening"},
                Gender.FEMALE, "Community Volunteer", null,
                "https://facebook.com/sofia.helper.tw", null,
                new String[]{"English", "Spanish"});

        // Connections cover every state a viewer can act on:
        //  • TRUSTED   — top of the ladder (Grace ↔ Harsha, Margaret ↔ Tom)
        //  • PHONE_CALL with the helper already confirmed — Margaret sees a live
        //    "confirm to advance" button (the core trust step in action)
        //  • PENDING incoming/outgoing on BOTH demo accounts, so Add Friends →
        //    New Invites and Requested are populated for the elder (Margaret) and
        //    the helper (James) alike — see the four PENDING rows below.
        //
        // Margaret and Harsha (the two public demo accounts) are deliberately NOT
        // connected in the baseline: the product walkthrough is recorded live on
        // these accounts (post → offer → accept), and any baseline row between
        // them would be resurrected at its old trust level by acceptHelper().
        // confirmedByA=false (Margaret), confirmedByB=true (Priya) → confirm button live for Margaret
        Connection cAdvance = ensureConnection(margaret, priya, ConnectionStatus.ACTIVE, TrustLevel.PHONE_CALL, priya,
                "Hello Margaret! I'm Priya, happy to help with errands or cooking.", false, true);
        Connection cVideo = ensureConnection(david, james, ConnectionStatus.ACTIVE, TrustLevel.VIDEO_CALL, james,
                "Hi David, fellow engineer here. Happy to help with anything.");
        ensureConnection(grace, priya, ConnectionStatus.ACTIVE, TrustLevel.PHONE_CALL, priya,
                "Hi Grace, I'd love to keep you company on your walks.");
        Connection cMargaretTom = ensureConnection(margaret, tom, ConnectionStatus.ACTIVE, TrustLevel.TRUSTED, tom,
                "Hello Margaret! I can fix any phone or wifi problem, happy to help.");
        Connection cGraceJames = ensureConnection(grace, james, ConnectionStatus.ACTIVE, TrustLevel.TRUSTED, grace,
                "Hi Harsha, I'd love a hand learning to video-call my grandchildren.");
        Connection cJamesRose = ensureConnection(james, rose, ConnectionStatus.ACTIVE, TrustLevel.DISCOVERED, james,
                "Hello Rose! I saw you love reading too. I'd be happy to help with anything you need.");
        Connection cDavidNina = ensureConnection(david, nina, ConnectionStatus.ACTIVE, TrustLevel.PHONE_CALL, nina,
                "Hi David! I can help with transportation and errands whenever you need.");
        // PENDING: Helen → Harsha (shows in Harsha's New Invites tab)
        ensureConnection(helen, james, ConnectionStatus.PENDING, TrustLevel.DISCOVERED, helen,
                "Hello Harsha! I'm Helen. Your profile looks lovely — I'd love a hand with some errands and maybe a chat over tea.",
                true, false);
        // PENDING: Harsha → Arthur (shows in Harsha's Requested tab)
        ensureConnection(james, arthur, ConnectionStatus.PENDING, TrustLevel.DISCOVERED, james,
                "Hi Arthur! I saw you enjoy chess and history. I'd love to help out and maybe learn a thing or two from you!",
                true, false);
        // PENDING: Nina → Margaret (shows in Margaret's New Invites tab — she can accept/decline)
        ensureConnection(nina, margaret, ConnectionStatus.PENDING, TrustLevel.DISCOVERED, nina,
                "Hello Margaret! I'm Nina. I saw you love gardening — I'd be happy to help with errands or a lift, and a good chat.",
                true, false);
        // PENDING: Margaret → Sofia (shows in Margaret's Requested tab — waiting on Sofia)
        ensureConnection(margaret, sofia, ConnectionStatus.PENDING, TrustLevel.DISCOVERED, margaret,
                "Hi Sofia! Your profile looked wonderful — I'd love a hand getting the hang of my new tablet.",
                true, false);

        // One-time repair for DBs seeded before the default changed: earlier seeds
        // set both confirm flags true on active connections, an impossible state
        // (both-confirmed advances the level instantly and resets the flags). Left
        // stuck, those cards showed "trust is advancing" that never advanced. Reset
        // them to the realistic "waiting for the elder to advance" state.
        normalizeStuckTrustFlags();

        // Grace + Harsha are TRUSTED — the top of the ladder — so their thread
        // walks the full trust journey in order, spread across ~3 weeks so the
        // Messages screen draws natural date separators between stages. The last
        // message lands 95 min ago, keeping Grace top of Harsha's inbox (David
        // ~2 days). This replaces generic chatter with the real arc:
        // introduce → phone → video → social media → meet → trusted friends.
        seedJourneyIfEmpty(cGraceJames, List.of(
                // Just Connected → Messaging: they introduce themselves
                tmsg(james, 28800, "Hello Grace, I'm Harsha. I saw you'd like help video-calling your grandchildren. I'd be glad to help — it's easier than it looks."),
                tmsg(grace, 28793, "Hello Harsha! That would be wonderful. I have a tablet full of buttons and no idea which one rings."),
                tmsg(james, 28786, "We'll take it slowly, one step at a time. Where are the grandchildren calling from?"),
                tmsg(grace, 28779, "Melbourne, the other side of the world. Seeing their faces would mean everything."),
                // Phone Ready: they share phone numbers
                tmsg(james, 23040, "We'll get you there. Shall we share phone numbers, so I can talk you through it while you press the buttons?"),
                tmsg(grace, 23034, "Good idea. I've just added mine to my profile."),
                tmsg(james, 23028, "Got it, thank you. I'll give you a ring after lunch for the first lesson."),
                // Video Ready: their first video call
                tmsg(james, 17280, "You did brilliantly on the phone. Ready to try a video call next? Once you've done one, the rest is easy."),
                tmsg(grace, 17274, "Yes please. Let me tidy my hair first!"),
                tmsg(grace, 17150, "We did it! I could see your face clear as day. Melbourne, here I come."),
                // Social Media Exchange: they share their profiles
                tmsg(james, 11520, "You're a natural. If you'd like, we can share our social media too — I'd love to see your watercolours."),
                tmsg(grace, 11514, "Oh I'd enjoy that. My daughter set up a page for my paintings."),
                tmsg(james, 11508, "Followed you, thank you. Your park scenes are beautiful — you must show me that bench by the pond."),
                // Ready to Meet: they plan a first meet in a public place
                tmsg(james,  5760, "I think it's time for a proper hello. Would a walk in the park suit you? It's nice and busy this time of year."),
                tmsg(grace,  5754, "Perfect. Thursday afternoon? A public spot puts my mind at ease — and I'll bring my lemon cake."),
                tmsg(james,  5748, "Thursday it is. I never say no to cake."),
                // Fully Trusted: after meeting, true friends
                tmsg(grace,   240, "Thank you for a lovely afternoon, Harsha. The grandchildren say the video calls work perfectly now — you're their favourite person."),
                tmsg(james,   150, "It was my pleasure, Grace. Same walk next week? Bring the sketchbook."),
                tmsg(grace,    95, "Absolutely. And there will be cake.")));
        seedMessagesIfEmpty(cAdvance, 1450, List.of(
                msg(priya,    "Hello Margaret! Thanks for accepting my request."),
                msg(margaret, "Hello Priya. Your profile says you like baking?"),
                msg(priya,    "I do! I make a mean banana bread — I'll bring some by once we know each other a little better.")));
        seedMessagesIfEmpty(cVideo, 2900, List.of(
                msg(james, "David, our video call was great! Same time next week?"),
                msg(david, "Yes! And bring that pasta recipe you mentioned.")));
        seedMessagesIfEmpty(cMargaretTom, 350, List.of(
                msg(tom, "Hello Margaret! Happy to help with any tech or wifi troubles."),
                msg(margaret, "Thank you Tom, that's very kind. My wifi has been a bit slow lately.")));
        seedMessagesIfEmpty(cJamesRose, 900, List.of(
                msg(james, "Hello Rose! I'd be glad to help with anything you need."),
                msg(rose, "Hello Harsha! So kind of you. I could use a hand with a few things.")));
        seedMessagesIfEmpty(cDavidNina, 1800, List.of(
                msg(nina, "Hi David! I can drive you to appointments or help with errands."),
                msg(david, "Wonderful, Nina. I have a medical appointment next week."),
                msg(nina, "I'll drive you — just send me the details.")));

        // Requests cover every status AND every category, so each action shows:
        //  • OPEN (no offers)         — Company for my morning walk      [COMPANIONSHIP]
        //  • OPEN + a pending offer   — Ride to my doctor appointment    [TRANSPORTATION]  → accept applicant
        //  • ASSIGNED (helper agreed) — Weekly grocery shopping          [ERRANDS]         → mark complete / cancel
        //  • COMPLETED (+ review)     — Help setting up my new tablet    [OTHER]
        //  • CANCELLED                — Fix the dripping kitchen tap      [CLEANING]
        ensureNeed(margaret, "Company for my morning walk",
                "I walk in Riverdale Park most mornings and would enjoy company.",
                NeedCategory.COMPANIONSHIP, NeedUrgency.NORMAL, NeedStatus.OPEN);
        Need ride = ensureNeed(margaret, "Ride to my doctor appointment",
                "Appointment on Tuesday at 10am, clinic is 15 minutes away.",
                NeedCategory.TRANSPORTATION, NeedUrgency.URGENT, NeedStatus.OPEN);
        Need shopping = ensureNeed(margaret, "Weekly grocery shopping",
                "A hand carrying groceries home from the market on Saturday mornings.",
                NeedCategory.ERRANDS, NeedUrgency.NORMAL, NeedStatus.ASSIGNED);
        Need tablet = ensureNeed(margaret, "Help setting up my new tablet",
                "My daughter sent me a tablet and I would love help setting it up for video calls.",
                NeedCategory.OTHER, NeedUrgency.NORMAL, NeedStatus.COMPLETED);
        ensureNeed(margaret, "Fix the dripping kitchen tap",
                "The kitchen tap drips through the night — I'd love help getting it sorted.",
                NeedCategory.CLEANING, NeedUrgency.NORMAL, NeedStatus.CANCELLED);
        Need chess = ensureNeed(david, "Weekly chess and tea company",
                "Looking for someone to play chess with on weekend afternoons.",
                NeedCategory.COMPANIONSHIP, NeedUrgency.NORMAL, NeedStatus.OPEN);
        ensureNeed(grace, "Light apartment cleaning",
                "A hand with vacuuming and dusting once a week.",
                NeedCategory.CLEANING, NeedUrgency.NORMAL, NeedStatus.OPEN);
        // These two exist so the HELPER demo account (Harsha) has every Browse
        // Needs segment filled: Applied needs an ACCEPTED offer on an ASSIGNED
        // need, Completed needs an ACCEPTED offer on a COMPLETED one. Margaret's
        // needs are off-limits for Harsha (the live walkthrough is recorded on
        // those two accounts), so Rose and David own them.
        Need rosePhone = ensureNeed(rose, "Help setting up my new phone",
                "My son gave me his old phone and I can't make heads or tails of it.",
                NeedCategory.OTHER, NeedUrgency.NORMAL, NeedStatus.ASSIGNED);
        Need davidLaptop = ensureNeed(david, "Sort out my slow laptop",
                "My laptop takes ten minutes to start up. I'd love someone to give it a tune-up.",
                NeedCategory.OTHER, NeedUrgency.NORMAL, NeedStatus.COMPLETED);

        // A pending offer Margaret can accept, and the accepted offer behind the assigned need
        ensureApplication(ride, nina, "Hi Margaret, I drive and would gladly take you on Tuesday.");
        ensureApplication(shopping, priya, "Happy to carry your groceries every Saturday!", ApplicationStatus.ACCEPTED);
        ensureApplication(chess, priya, "I'd love to learn chess while keeping you company!");
        // Harsha's offers, filling his Applied (pending + accepted) and Completed tabs
        ensureApplication(chess, james, "I'd love a weekly chess game — fair warning, I play to win!");
        ensureApplication(rosePhone, james, "Happy to help, Rose! Phones are my thing — we'll have it set up in no time.", ApplicationStatus.ACCEPTED);
        ensureApplication(davidLaptop, james, "I can definitely speed that up for you, David.", ApplicationStatus.ACCEPTED);

        ensureReview(david, james, davidLaptop, 4,
                "Very reliable and great company. Always on time.",
                List.of("Reliable", "Punctual"));
        ensureReview(priya, margaret, null, 5,
                "Margaret is warm and full of wonderful stories. A joy to visit.",
                List.of("Friendly", "Welcoming"));
        ensureReview(tom, margaret, null, 4,
                "Margaret was patient and made me feel very welcome.",
                List.of("Patient", "Welcoming"));
        ensureReview(nina, margaret, null, 4,
                "Margaret made everything feel easy and comfortable.",
                List.of("Welcoming", "Friendly"));
        ensureReview(margaret, priya, null, 5,
                "Priya is efficient, warm, and so cheerful. A joy to have around.",
                List.of("Reliable", "Friendly"));
        ensureReview(grace, priya, null, 5,
                "Priya is always on time and treats me with such genuine care.",
                List.of("Reliable", "Punctual"));
        ensureReview(priya, grace, null, 5,
                "Grace is a delight — full of stories and so easy to spend time with.",
                List.of("Friendly", "Welcoming"));
        ensureReview(james, david, null, 5,
                "David is sharp, engaging, and great company every visit.",
                List.of("Friendly", "Reliable"));
        ensureReview(nina, david, null, 4,
                "David is gracious and always prepared — a lovely person to help.",
                List.of("Friendly", "Punctual"));
        ensureReview(grace, james, null, 5,
                "Harsha is patient, knowledgeable, and genuinely kind.",
                List.of("Patient", "Reliable"));
        ensureReview(james, grace, null, 5,
                "Grace has a wonderful spirit and such a warm home.",
                List.of("Friendly", "Welcoming"));
        ensureReview(rose, james, null, 4,
                "Harsha is warm and never makes me feel rushed. Very helpful.",
                List.of("Patient", "Friendly"));
        ensureReview(margaret, tom, tablet, 4,
                "Tom set up my new tablet and explained it all so clearly.",
                List.of("Reliable", "Patient"));
        ensureReview(david, nina, null, 4,
                "Nina is cheerful, punctual, and makes every trip a pleasure.",
                List.of("Punctual", "Friendly"));

        ensureStreak(margaret, 6, 14);
        ensureStreak(david, 3, 9);

        ensureEmergencyContact(margaret, "Sarah (daughter)", "+14165550199", "Family");

        for (User u : demoUsers) {
            try {
                trustScoreService.recalculate(u.getId());
            } catch (Exception e) {
                log.warn("Trust recalculation failed for {}: {}", u.getEmail(), e.getMessage());
            }
        }
        log.info("Demo data seeding complete");
    }

    /**
     * Delete all content owned by or involving a demo user, while keeping the
     * account and profile so the persona stays stable across resets. Deletion
     * order respects foreign keys: messages → (per owned need) applications +
     * reviews → applications/reviews/reports by user → needs → trust logs →
     * connections → emergency contacts → streak. Reviews and applications that
     * reference the user's needs are cleared by need_id first — a review can
     * point at a need without either party being this user — otherwise the
     * needs delete trips reviews_need_id_fkey. Only demo accounts are passed in.
     */
    private void purgeDemoContent(User u) {
        UUID id = u.getId();
        messageRepository.deleteByConnectionUserIdOrSenderId(id);
        needRepository.findByElderIdOrderByCreatedAtDesc(id, Pageable.unpaged())
                .forEach(n -> {
                    needApplicationRepository.deleteByNeedId(n.getId());
                    reviewRepository.deleteByNeedId(n.getId());
                });
        needApplicationRepository.deleteByHelperId(id);
        reviewRepository.deleteByReviewerIdOrRevieweeId(id, id);
        reportRepository.deleteByReporterIdOrReportedUserId(id, id);
        needRepository.deleteByElderId(id);
        trustProgressionLogRepository.deleteByUserId(id);
        connectionRepository.deleteByUserId(id);
        emergencyContactRepository.deleteByElderId(id);
        userStreakRepository.findByUserId(id).ifPresent(userStreakRepository::delete);
    }

    // ── helpers ──────────────────────────────────────────────────────────

    /** Reset any ACTIVE connection stuck with both confirm flags true back to
     *  false. Both-true never persists in production (it advances the level and
     *  resets), so this only ever touches the old seed artifact — real one-sided
     *  confirmations (true/false) and pending requests are left untouched. */
    private void normalizeStuckTrustFlags() {
        for (Connection c : connectionRepository.findAll()) {
            if (c.getStatus() == ConnectionStatus.ACTIVE
                    && Boolean.TRUE.equals(c.getConfirmedByA())
                    && Boolean.TRUE.equals(c.getConfirmedByB())) {
                c.setConfirmedByA(false);
                c.setConfirmedByB(false);
                connectionRepository.save(c);
            }
        }
    }

    private User ensureUser(String email, String phone, UserRole role, String rawPassword) {
        Optional<User> existing = userRepository.findByEmail(email);
        if (existing.isPresent()) {
            User u = existing.get();
            boolean dirty = false;
            // Demo accounts must be discoverable: pin them to the demo cluster if unset
            if (u.getLocationLat() == null || u.getLocationLng() == null) {
                u.setLocationLat(baseLat(role)); u.setLocationLng(baseLng(role)); dirty = true;
            }
            if (u.getVerificationStatus() != VerificationStatus.VERIFIED) {
                u.setVerificationStatus(VerificationStatus.VERIFIED); dirty = true;
            }
            if (!u.isPhoneVerified()) { u.setPhoneVerified(true); dirty = true; }
            // Full reset: snap account settings a visitor may have changed (their
            // location, date of birth, city, phone, verification) back to baseline.
            if (resetEnabled) {
                u.setLocationLat(baseLat(role).add(jitter(email)));
                u.setLocationLng(baseLng(role).add(jitter(email + "lng")));
                u.setCity(baseCity(role));
                u.setDateOfBirth(role == UserRole.ELDER ? LocalDate.of(1953, 5, 14) : LocalDate.of(2003, 3, 14));
                u.setVerificationStatus(VerificationStatus.VERIFIED);
                u.setPhoneVerified(true);
                u.setIsActive(true);
                restorePhone(u, phone);
                // Restore the demo password so a visitor can't lock everyone out of
                // the shared public account by changing it. Rewrite only when it has
                // actually drifted, to avoid a needless bcrypt hash on every reset.
                if (u.getPasswordHash() == null || !passwordEncoder.matches(rawPassword, u.getPasswordHash())) {
                    u.setPasswordHash(passwordEncoder.encode(rawPassword));
                }
                dirty = true;
            }
            return dirty ? userRepository.save(u) : u;
        }
        String username = email.split("@")[0].toLowerCase().replaceAll("[^a-z0-9]", "_");
        // Ensure uniqueness in the unlikely case of collision
        if (userRepository.existsByUsername(username)) {
            username = username + "_" + (System.currentTimeMillis() % 1000);
        }
        User u = User.builder()
                .username(username)
                .email(email)
                .phone(uniquePhone(phone))
                .passwordHash(passwordEncoder.encode(rawPassword))
                .role(role)
                .verificationStatus(VerificationStatus.VERIFIED)
                .emailVerified(true)
                .locationLat(baseLat(role).add(jitter(email)))
                .locationLng(baseLng(role).add(jitter(email + "lng")))
                .city(baseCity(role))
                .isActive(true)
                .dateOfBirth(role == UserRole.ELDER ? LocalDate.of(1953, 5, 14) : LocalDate.of(2003, 3, 14))
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

    /**
     * Restore a demo account's phone to its baseline number after a visitor
     * changed it. Skips the write when another account already holds the number,
     * so reverting never trips the unique-phone constraint and fails the reset.
     */
    private void restorePhone(User u, String preferred) {
        if (preferred.equals(u.getPhone())) return;
        if (!userRepository.existsByPhone(preferred)) u.setPhone(preferred);
    }

    /** Small deterministic offset (≤ ~0.6 km) so personas aren't stacked on one point. */
    private BigDecimal jitter(String key) {
        return new BigDecimal(Math.abs(key.hashCode()) % 60).movePointLeft(4);
    }

    /**
     * Create the elder profile, or — when reset is enabled — overwrite every
     * field back to this baseline so a visitor's edits (name, bio, interests,
     * uploaded photo, social links, gender) all revert. Without reset, an
     * existing profile is left untouched (additive mode).
     */
    private void ensureElderProfile(User user, String name, int age, String bio,
                                    String[] interests, String occupation, Gender gender, String photoUrl,
                                    String facebookUrl) {
        ElderProfile p = elderProfileRepository.findByUserId(user.getId()).orElse(null);
        if (p != null && !resetEnabled) return;
        if (p == null) p = ElderProfile.builder().user(user).build();
        p.setName(name);
        p.setAge(age);
        p.setBio(bio);
        p.setInterests(interests);
        p.setLanguages(new String[]{"English"});
        p.setOccupation(occupation);
        p.setLookingFor(LookingForType.BOTH);
        p.setGender(gender);
        p.setPhotoUrl(photoUrl);
        p.setFacebookUrl(facebookUrl);
        p.setInstagramUrl(null);
        elderProfileRepository.save(p);
    }

    /** Helper counterpart of {@link #ensureElderProfile}: create, or overwrite
     *  back to baseline on reset so visitor edits to the helper profile revert. */
    private void ensureHelperProfile(User user, String name, int age, String bio,
                                     String[] skills, String[] hobbies,
                                     Gender gender, String occupation, String photoUrl,
                                     String facebookUrl, String instagramUrl, String[] languages) {
        HelperProfile p = helperProfileRepository.findByUserId(user.getId()).orElse(null);
        if (p != null && !resetEnabled) return;
        if (p == null) p = HelperProfile.builder().user(user).build();
        p.setName(name);
        p.setAge(age);
        p.setBio(bio);
        p.setSkillsOffered(skills);
        p.setLanguages(languages != null ? languages : new String[]{"English"});
        p.setAvailabilityDays(new String[]{"Saturday", "Sunday", "Wednesday"});
        p.setAvailabilityTimes(new String[]{"Afternoon", "Evening"});
        p.setHobbies(hobbies);
        p.setBackgroundCheckStatus(BackgroundCheckStatus.VERIFIED);
        p.setGender(gender);
        p.setOccupation(occupation);
        p.setPhotoUrl(photoUrl);
        p.setFacebookUrl(facebookUrl);
        p.setInstagramUrl(instagramUrl);
        p.setDateOfBirth(user.getDateOfBirth());
        helperProfileRepository.save(p);
    }

    private Connection ensureConnection(User a, User b, ConnectionStatus status,
                                        TrustLevel level, User initiator, String requestMessage) {
        // Default to nobody having confirmed the *current* level yet. Both-confirmed
        // is an impossible production state — the moment both sides confirm, the level
        // advances and both flags reset (see TrustService.confirmTrustLevel). Seeding
        // both-true left connections stuck showing "trust is advancing" forever; false,
        // false gives the realistic "elder must advance next, helper waits to accept".
        return ensureConnection(a, b, status, level, initiator, requestMessage, false, false);
    }

    /** Variant with explicit per-side confirm flags — used to stage a connection
     *  where the helper has confirmed the next trust step but the elder hasn't,
     *  so the elder sees a live "confirm to advance" button. */
    private Connection ensureConnection(User a, User b, ConnectionStatus status,
                                        TrustLevel level, User initiator, String requestMessage,
                                        boolean confirmedByA, boolean confirmedByB) {
        Optional<Connection> existing = connectionRepository.findBetweenUsers(a.getId(), b.getId());
        if (existing.isPresent()) return existing.get();
        return connectionRepository.save(Connection.builder()
                .userA(a).userB(b)
                .status(status)
                .currentTrustLevel(level)
                .initiatedBy(initiator)
                .requestMessage(requestMessage)
                .confirmedByA(confirmedByA)
                .confirmedByB(confirmedByB)
                .build());
    }

    private record Draft(User sender, String content) {}
    private Draft msg(User sender, String content) { return new Draft(sender, content); }

    private record TimedDraft(User sender, String content, long minutesAgo) {}
    private TimedDraft tmsg(User sender, long minutesAgo, String content) {
        return new TimedDraft(sender, content, minutesAgo);
    }

    /**
     * Seed a conversation whose drafts each carry their own "minutes ago" offset,
     * so a single thread can span days or weeks. The Messages screen draws a date
     * separator whenever consecutive messages fall on different days, so a thread
     * that walks the trust journey reads as a believable arc rather than one
     * compressed burst. Idempotent: only seeds when the thread is empty.
     */
    private void seedJourneyIfEmpty(Connection conn, List<TimedDraft> drafts) {
        if (messageRepository.countByConnectionId(conn.getId()) > 0) return;
        LocalDateTime now = LocalDateTime.now();
        for (TimedDraft d : drafts) {
            messageRepository.save(Message.builder()
                    .connection(conn)
                    .sender(d.sender())
                    .content(d.content())
                    .type(MessageType.TEXT)
                    .createdAt(now.minusMinutes(d.minutesAgo()))
                    .build());
        }
    }

    /**
     * Seed a conversation with realistic, strictly-increasing timestamps so the
     * thread reads in order and looks lived-in. The last message lands
     * {@code endedMinutesAgo} before now; earlier ones step back ~9 minutes
     * each. Without explicit times every message shares one createdAt and the
     * client's timestamp sort scrambles the order.
     */
    private void seedMessagesIfEmpty(Connection conn, long endedMinutesAgo, List<Draft> drafts) {
        if (messageRepository.countByConnectionId(conn.getId()) > 0) return;
        int n = drafts.size();
        LocalDateTime end = LocalDateTime.now().minusMinutes(endedMinutesAgo);
        for (int i = 0; i < n; i++) {
            Draft d = drafts.get(i);
            LocalDateTime ts = end.minusMinutes((long) (n - 1 - i) * 9L);
            messageRepository.save(Message.builder()
                    .connection(conn)
                    .sender(d.sender())
                    .content(d.content())
                    .type(MessageType.TEXT)
                    .createdAt(ts)
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
        ensureApplication(need, helper, message, ApplicationStatus.PENDING);
    }

    private void ensureApplication(Need need, User helper, String message, ApplicationStatus status) {
        if (needApplicationRepository.findByNeedIdAndHelperId(need.getId(), helper.getId()).isPresent()) return;
        needApplicationRepository.save(NeedApplication.builder()
                .need(need).helper(helper).message(message)
                .status(status)
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
