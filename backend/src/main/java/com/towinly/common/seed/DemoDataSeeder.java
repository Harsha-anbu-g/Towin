package com.towinly.common.seed;

import com.towinly.common.entity.User;
import com.towinly.common.enums.*;
import com.towinly.common.repository.UserRepository;
import com.towinly.common.service.TrustScoreService;
import com.towinly.connection.entity.Connection;
import com.towinly.connection.repository.ConnectionRepository;
import com.towinly.emergency.entity.EmergencyContact;
import com.towinly.emergency.repository.EmergencyContactRepository;
import com.towinly.family.entity.FamilyDelegatedPower;
import com.towinly.family.entity.FamilyLink;
import com.towinly.family.repository.FamilyAlertRepository;
import com.towinly.family.repository.FamilyDelegatedPowerRepository;
import com.towinly.family.repository.FamilyLinkRepository;
import com.towinly.messaging.entity.Message;
import com.towinly.messaging.repository.MessageRepository;
import com.towinly.need.entity.Need;
import com.towinly.need.entity.NeedApplication;
import com.towinly.need.repository.NeedApplicationRepository;
import com.towinly.need.repository.NeedRepository;
import com.towinly.passon.dto.PassOnArmRequest;
import com.towinly.passon.dto.SealedItemRequest;
import com.towinly.passon.entity.Keyholder;
import com.towinly.passon.entity.PassOnItem;
import com.towinly.passon.repository.KeyholderRepository;
import com.towinly.passon.repository.PassOnItemRepository;
import com.towinly.passon.repository.PassOnOpenRepository;
import com.towinly.passon.repository.PassOnSettingsRepository;
import com.towinly.passon.repository.SealedItemRepository;
import com.towinly.passon.service.KeyholderService;
import com.towinly.passon.service.SealedBoxService;
import com.towinly.passon.service.SealedCryptoService;
import com.towinly.profile.entity.ElderProfile;
import com.towinly.profile.entity.HelperProfile;
import com.towinly.profile.repository.ElderProfileRepository;
import com.towinly.profile.repository.HelperProfileRepository;
import com.towinly.report.repository.ReportRepository;
import com.towinly.review.entity.Review;
import com.towinly.review.repository.ReviewRepository;
import com.towinly.streak.entity.UserStreak;
import com.towinly.streak.repository.UserStreakRepository;
import com.towinly.trust.repository.TrustProgressionLogRepository;
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
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

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

    /** Served by the frontend from public/demo, not S3 — see S3Service.presignedUrl. */
    private static final String SARAH_PHOTO = "/demo/sarah.jpg";

    public static final String ELDER_DEMO_EMAIL  = "elder@gmail.com";
    public static final String HELPER_DEMO_EMAIL = "helper@gmail.com";

    /**
     * The elder demo password, printed on the login screen for anyone to use. Named because
     * the Sealed box is guarded by it: this is the password a visitor types to open Margaret's
     * box, and {@code DemoSealedBoxOpensDbTest} proves that it really does.
     */
    static final String ELDER_DEMO_PASSWORD = "12345678";

    // Every demo account, so DemoResetCoordinator can tell when a write targets
    // one. Keep in sync with the ensureUser(...) calls in seed().
    public static final List<String> DEMO_EMAILS = List.of(
            ELDER_DEMO_EMAIL, HELPER_DEMO_EMAIL,
            "demo.priya@towin.app", "demo.tom@towin.app", "demo.david@towin.app",
            "demo.grace@towin.app", "demo.nina@towin.app", "demo.rose@towin.app",
            "demo.helen@towin.app", "demo.arthur@towin.app", "demo.sofia@towin.app",
            "demo.claire@towin.app", "demo.ethan@towin.app",
            "demo.lakshmi@towin.app", "demo.karthik@towin.app",
            "demo.meena@towin.app", "demo.arjun@towin.app",
            "demo.sarah@towin.app", "demo.davidson@towin.app", "demo.ruth@towin.app");

    // Most demo personas (elders and helpers) are pinned to Montreal, Canada so
    // they cluster together and "near me" discovery matches across both roles.
    // A smaller cluster lives in Tamil Nadu, India — Chennai, Coimbatore and
    // Salem — so discovery has people to find there too.
    private record CityPin(BigDecimal lat, BigDecimal lng, String city) {}

    private static final CityPin MONTREAL   = new CityPin(new BigDecimal("45.5019"), new BigDecimal("-73.5674"), "Montreal");
    private static final CityPin CHENNAI    = new CityPin(new BigDecimal("13.0827"), new BigDecimal("80.2707"),  "Chennai");
    private static final CityPin COIMBATORE = new CityPin(new BigDecimal("11.0168"), new BigDecimal("76.9558"),  "Coimbatore");
    private static final CityPin SALEM      = new CityPin(new BigDecimal("11.6643"), new BigDecimal("78.1460"),  "Salem");

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
    private final FamilyLinkRepository familyLinkRepository;
    private final FamilyAlertRepository familyAlertRepository;
    private final FamilyDelegatedPowerRepository familyDelegatedPowerRepository;
    private final com.towinly.family.repository.FamilyPowerRequestRepository familyPowerRequestRepository;
    private final ReportRepository reportRepository;
    private final TrustProgressionLogRepository trustProgressionLogRepository;
    private final PasswordEncoder passwordEncoder;
    private final TrustScoreService trustScoreService;
    private final PlatformTransactionManager transactionManager;
    // What an elder passes on. The two services are here rather than the repositories alone
    // because the Sealed box must be sealed by the same code that seals a real elder's — see
    // seedWhatMargaretPassesOn.
    private final PassOnItemRepository passOnItemRepository;
    private final SealedItemRepository sealedItemRepository;
    private final KeyholderRepository keyholderRepository;
    private final PassOnSettingsRepository passOnSettingsRepository;
    private final PassOnOpenRepository passOnOpenRepository;
    private final SealedBoxService sealedBoxService;
    private final KeyholderService keyholderService;
    private final SealedCryptoService sealedCryptoService;

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
        User margaret = ensureUser(ELDER_DEMO_EMAIL, "+14165550101", UserRole.ELDER, ELDER_DEMO_PASSWORD);
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
        User claire   = ensureUser("demo.claire@towin.app","+14165550113", UserRole.HELPER, "DemoClaire!2026");
        User ethan    = ensureUser("demo.ethan@towin.app", "+14165550114", UserRole.HELPER, "DemoEthan!2026");

        // Tamil Nadu cluster — Chennai has both roles so "near me" matches there;
        // Coimbatore and Salem each hold one persona.
        User lakshmi  = ensureUser("demo.lakshmi@towin.app", "+919840001112", UserRole.ELDER,  "DemoLakshmi!2026", CHENNAI);
        User karthik  = ensureUser("demo.karthik@towin.app", "+919840001113", UserRole.HELPER, "DemoKarthik!2026", CHENNAI);
        User meena    = ensureUser("demo.meena@towin.app",   "+919442001114", UserRole.ELDER,  "DemoMeena!2026",   COIMBATORE);
        User arjun    = ensureUser("demo.arjun@towin.app",   "+919442001115", UserRole.HELPER, "DemoArjun!2026",   SALEM);

        // Family story: Sarah is Margaret's daughter — the same person as the
        // long-standing "Sarah (daughter)" emergency contact, now with her own
        // FAMILY-role account linked in-app (see the family seed below).
        User sarah    = ensureUser("demo.sarah@towin.app",   "+14165550112", UserRole.FAMILY, "DemoSarah!2026");
        // FAMILY accounts have no elder/helper profile, so the updates thread renders
        // User.fullName — keep Sarah's a warm first name, not "demo_sarah".
        // Her face as well as her name. The photo ships with the frontend rather
        // than living in S3, so it survives the demo reset that runs a few minutes
        // after every visitor — a photo uploaded once by hand would not.
        if (!"Sarah".equals(sarah.getFullName()) || !SARAH_PHOTO.equals(sarah.getPhotoUrl())) {
            sarah.setFullName("Sarah");
            sarah.setPhotoUrl(SARAH_PHOTO);
            sarah = userRepository.save(sarah);
        }

        // Margaret's son and her sister. Keyholders are drawn from the family list and
        // nowhere else, so a Sealed box needing three of them needs three family members —
        // Sarah alone could never be a quorum. Both are FAMILY accounts like Sarah's, with a
        // real login, because the person a key is asked of has to be able to answer.
        //
        // The name is deliberate and slightly awkward: the demo already has a "David Chen",
        // an unrelated 76-year-old elder in Montreal. The design names Margaret's Keyholders
        // Sarah, David and Ruth throughout, and the setup screen renders that trio from these
        // rows, so the name was kept and the login handle made unique instead. Rename him if
        // the two Davids read as a mistake rather than a coincidence.
        User davidSon = ensureUser("demo.davidson@towin.app", "+14165550116", UserRole.FAMILY, "DemoDavidson!2026");
        User ruth     = ensureUser("demo.ruth@towin.app",     "+14165550115", UserRole.FAMILY, "DemoRuth!2026");
        davidSon = ensureFullName(davidSon, "David");
        ruth = ensureFullName(ruth, "Ruth");
        // FAMILY alerts and SOS messages name the elder through her account rather than her
        // profile, so without this the whole family reads "elder has asked Sarah to hold a
        // key". Her profile already says Margaret; this makes the account agree with it.
        margaret = ensureFullName(margaret, "Margaret");

        List<User> demoUsers = List.of(margaret, james, priya, tom, david, grace, nina, rose, helen, arthur, sofia,
                claire, ethan, lakshmi, karthik, meena, arjun, sarah, davidSon, ruth);

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
        ensureElderProfile(lakshmi, "Lakshmi Raman", 70,
                "Retired schoolteacher in Chennai. I love Carnatic music, cooking, and my morning walk on the beach.",
                new String[]{"Music", "Cooking", "Walking"}, "Retired teacher", Gender.FEMALE, null,
                null, new String[]{"Tamil", "English"});
        ensureElderProfile(meena, "Meena Krishnan", 73,
                "Retired bank clerk in Coimbatore. I enjoy my garden, temple visits, and sharing my recipes.",
                new String[]{"Gardening", "Cooking", "Reading"}, "Retired bank clerk", Gender.FEMALE, null,
                null, new String[]{"Tamil", "English"});

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
        ensureHelperProfile(claire, "Claire Dubois", 28,
                "Landscape gardener. I grew up helping my grand-maman with her roses — green thumbs, patient hands, and always time for tea.",
                new String[]{"Gardening", "Errands", "Companionship"}, new String[]{"Gardening", "Baking"},
                Gender.FEMALE, "Landscape Gardener", null,
                "https://facebook.com/claire.helper.tw", null,
                new String[]{"English", "French"});
        ensureHelperProfile(ethan, "Ethan Cole", 25,
                "Computer science student. I love a good game of chess and can untangle any wifi or gadget trouble.",
                new String[]{"Chess", "Technology", "Errands"}, new String[]{"Chess", "Board games"},
                Gender.MALE, "Computer Science Student", null,
                "https://facebook.com/ethan.helper.tw", null,
                new String[]{"English"});
        ensureHelperProfile(karthik, "Karthik Subramanian", 24,
                "Engineering student in Chennai. Happy to help with phones, errands, or a chat over filter coffee.",
                new String[]{"Technology", "Errands", "Companionship"}, new String[]{"Cricket", "Chess"},
                Gender.MALE, "Engineering Student", null,
                null, null,
                new String[]{"Tamil", "English"});
        ensureHelperProfile(arjun, "Arjun Devaraj", 26,
                "Delivery rider in Salem — I know every street. Glad to help with rides, errands, and heavy bags.",
                new String[]{"Transportation", "Errands"}, new String[]{"Cycling", "Movies"},
                Gender.MALE, "Delivery Rider", null,
                null, null,
                new String[]{"Tamil", "English"});

        // Connections cover every state a viewer can act on:
        //  • TRUSTED   — top of the ladder (Grace ↔ Harsha, Grace ↔ Priya,
        //    David ↔ Nina, Margaret ↔ Claire, Margaret ↔ Tom). Only these pairs
        //    may exchange connection reviews — the Review button unlocks at
        //    TRUSTED and ReviewService enforces the same gate. Margaret ↔ Claire
        //    and Margaret ↔ Tom carry NO seeded review on purpose so the Review
        //    button is live to press on the elder demo login.
        //  • FIRST_MEET — Margaret ↔ Ethan, the friendship Margaret shares with
        //    her family, so the Sarah demo shows the "getting ready to meet in
        //    person" highlight on the Family Home journey from day one — and the
        //    whole family story (shared journey, family notes thread, Sarah's
        //    labeled request) plays out on the demo logins.
        //  • PHONE_CALL with the helper already confirmed — Margaret sees a live
        //    "confirm to advance" button (the core trust step in action)
        //  • PENDING incoming/outgoing on BOTH demo accounts, so Add Friends →
        //    New Invites and Requested are populated for the elder (Margaret) and
        //    the helper (James) alike — see the four PENDING rows below.
        //
        // Margaret and Harsha (the two public demo accounts) hold NO connection
        // to each other (user decision 2026-08-02: Harsha must stay free of
        // Margaret so a live demo can walk the full connect flow between the two
        // public logins). This supersedes the 2026-07-19 rule that linked them
        // for the family story — that story now lives on Ethan, a helper who
        // exists for exactly this role.
        // confirmedByA=false (Margaret), confirmedByB=true (Priya) → confirm button live for Margaret
        Connection cAdvance = ensureConnection(margaret, priya, ConnectionStatus.ACTIVE, TrustLevel.PHONE_CALL, priya,
                "Hello Margaret! I'm Priya, happy to help with errands or cooking.", false, true);
        Connection cVideo = ensureConnection(david, james, ConnectionStatus.ACTIVE, TrustLevel.VIDEO_CALL, james,
                "Hi David, fellow engineer here. Happy to help with anything.");
        ensureConnection(grace, priya, ConnectionStatus.ACTIVE, TrustLevel.TRUSTED, priya,
                "Hi Grace, I'd love to keep you company on your walks.");
        Connection cMargaretTom = ensureConnection(margaret, tom, ConnectionStatus.ACTIVE, TrustLevel.TRUSTED, tom,
                "Hello Margaret! I can fix any phone or wifi problem, happy to help.");
        Connection cMargaretClaire = ensureConnection(margaret, claire, ConnectionStatus.ACTIVE, TrustLevel.TRUSTED, claire,
                "Hi Margaret! I hear you keep a lovely garden. I'd be glad to help with the heavy digging, and I never say no to a cup of tea.");
        Connection cMargaretEthan = ensureConnection(margaret, ethan, ConnectionStatus.ACTIVE, TrustLevel.FIRST_MEET, ethan,
                "Hello Margaret! I saw you love chess — so do I. Happy to help with anything tech, and maybe a game too.");
        Connection cGraceJames = ensureConnection(grace, james, ConnectionStatus.ACTIVE, TrustLevel.TRUSTED, grace,
                "Hi Harsha, I'd love a hand learning to video-call my grandchildren.");
        Connection cJamesRose = ensureConnection(james, rose, ConnectionStatus.ACTIVE, TrustLevel.DISCOVERED, james,
                "Hello Rose! I saw you love reading too. I'd be happy to help with anything you need.");
        Connection cDavidNina = ensureConnection(david, nina, ConnectionStatus.ACTIVE, TrustLevel.TRUSTED, nina,
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

        // One-time repair for DBs seeded before Harsha was unlinked from Margaret
        // (2026-08-02, matters in additive mode only — reset-enabled DBs purge
        // and rebuild): drop the old Margaret ↔ Harsha friendship with its chat
        // and family notes, the derived Sarah ↔ Harsha family chat, and the
        // stale first-meeting alert naming Harsha. Runs BEFORE the family block
        // below so the ensure* guards re-seed the Ethan story in the same boot.
        retireHarshaFamilyStory(margaret, james, sarah);

        // Family in the trust system: Sarah (daughter) holds an ACTIVE link to
        // Margaret, so the demo shows a linked family member, the elder's +1
        // family trust point, and the Family Home screen with a real elder card.
        ensureFamilyLink(margaret, sarah, "Daughter");
        // Her other two, added for the Sealed box. They carry no delegated powers: the point
        // of them is that a key can be held by somebody who does nothing else for you.
        //
        // Her trust score does not move. An elder earns one flat family point the moment any
        // link is active and never a second one (TrustScoreService.familyPoints), and Sarah
        // already earned it — so these two are worth zero, not +1 each. The design document
        // says +2; the code says otherwise, and the code is what runs.
        ensureFamilyLink(margaret, davidSon, "Son");
        ensureFamilyLink(margaret, ruth, "Sister");
        // Guardian mode on display: Margaret has said yes to Sarah handling two
        // things for her, so a visitor signing in as Sarah finds the feature
        // already working rather than a screen of switches nobody has touched.
        ensureDelegatedPowers(margaret, sarah, Set.of(
                DelegatedPower.MANAGE_HELP_REQUESTS,
                DelegatedPower.ADVANCE_TRUST));
        // Consent flow on display: LEAVE_REVIEWS is not granted — Sarah has
        // ASKED for it and Margaret hasn't decided, so a visitor signing in as
        // Margaret finds a real approval card waiting on her My family tab.
        // Reviews stay unusable in the demo either way (they unlock at Fully
        // Trusted; Margaret ↔ Ethan sit at Ready to Meet), so the card itself
        // is the payoff — and a review is a public word about a helper, which
        // makes it exactly the ask a parent would think over rather than wave
        // through.
        ensureFamilyPowerRequest(margaret, sarah, DelegatedPower.LEAVE_REVIEWS);
        // The elder's choice on display: Margaret shares her friendship with
        // Ethan (at Ready to Meet, so family sees the meeting highlight) while
        // her other connections — Tom, Claire, Priya — stay private
        // (shared_with_family keeps its FALSE default).
        markSharedWithFamily(cMargaretEthan);
        // One piece of family news so Sarah's News tab is never empty: the
        // shared friendship sits at Ready to Meet, so the first-meeting alert
        // is the true story (same wording SosService writes in production).
        ensureFamilyAlert(margaret, FamilyAlertType.FIRST_MEET,
                "Planned a first in-person meeting with Ethan.");

        // One-time repair for DBs seeded before the default changed: earlier seeds
        // set both confirm flags true on active connections, an impossible state
        // (both-confirmed advances the level instantly and resets the flags). Left
        // stuck, those cards showed "trust is advancing" that never advanced. Reset
        // them to the realistic "waiting for the elder to advance" state.
        normalizeStuckTrustFlags();
        // One-time repair for DBs seeded before the family story moved from Tom
        // to Harsha (matters in additive mode only — reset-enabled DBs purge and
        // rebuild): un-share the old Margaret ↔ Tom friendship, retire its family
        // notes thread, and drop the stale Sarah → Tom request so the family
        // story lives only on Harsha.
        retireTomFamilyStory(margaret, tom, sarah);

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
        seedMessagesIfEmpty(cMargaretTom, 2200, List.of(
                msg(tom, "Margaret, your tablet is all updated — the photos app should stop freezing now."),
                msg(margaret, "You're a marvel, Tom. Thank you for being so patient with me and my gadgets.")));
        seedMessagesIfEmpty(cMargaretClaire, 480, List.of(
                msg(claire, "Margaret, the tulips we planted are finally up!"),
                msg(margaret, "I saw them this morning, a lovely little row of red. Will you come by Saturday for the herb bed?"),
                msg(claire, "Saturday it is. I'll bring my good trowel, you put the kettle on.")));
        seedMessagesIfEmpty(cMargaretEthan, 360, List.of(
                msg(ethan,    "Hello Margaret! Shall we plan that first game of chess?"),
                msg(margaret, "How lovely! Saturday at the community centre? It's nice and busy in the afternoons."),
                msg(ethan,    "Saturday it is. I'll bring my board, you bring your best opening.")));
        // The family updates thread (Step 3): a living exchange on the one SHARED
        // friendship, so all three demo logins show the thread on day one.
        seedFamilyNotesIfEmpty(cMargaretEthan, 320, List.of(
                msg(ethan,    "We sorted the wifi today over a video call — the new password is in Margaret's blue notebook. She was in great spirits."),
                msg(sarah,    "Thank you so much, Ethan. That router has been defeating us for months!"),
                msg(margaret, "It's true. Ethan fixed it in ten minutes. We play chess on Saturday.")));
        // Trust inheritance demo (2026-07-19): Sarah automatically holds
        // Margaret's trust with Ethan — the shared friendship sits at Ready to
        // Meet (≥ Messaging), so the standing derives on its own; there is no
        // request and no accept any more. The chat is seeded already open so no
        // screen is empty: Sarah's card says "Message Ethan", Ethan's card
        // shows the trust bridge, Margaret's card shows the transparency line.
        Connection sarahEthan = ensureConnection(sarah, ethan, ConnectionStatus.ACTIVE,
                TrustLevel.DISCOVERED, sarah, "Family of Margaret");
        if (sarahEthan.getType() != ConnectionType.FAMILY) {
            sarahEthan.setType(ConnectionType.FAMILY);
            connectionRepository.save(sarahEthan);
        }
        seedMessagesIfEmpty(sarahEthan, 280, List.of(
                msg(sarah, "Hi Ethan! Mum says you're the chess player. Thank you for the wifi rescue."),
                msg(ethan, "Happy to help, Sarah. She's already promised to beat me on Saturday."),
                msg(sarah, "She will. Text me if she needs anything for the visit.")));
        // Parent↔family private chat (2026-07-21): Margaret and her daughter Sarah
        // message each other directly, gated only by their family link. No "Family
        // of …" note, so no helper-style label. Seeded open so the new "Family"
        // inbox section shows on both their screens on day one.
        Connection margaretSarah = ensureConnection(margaret, sarah, ConnectionStatus.ACTIVE,
                TrustLevel.DISCOVERED, sarah, null);
        if (margaretSarah.getType() != ConnectionType.FAMILY) {
            margaretSarah.setType(ConnectionType.FAMILY);
            connectionRepository.save(margaretSarah);
        }
        seedMessagesIfEmpty(margaretSarah, 200, List.of(
                msg(sarah, "Morning Mum! Did Ethan get the chess board sorted for Saturday?"),
                msg(margaret, "He did, love. I'm going to win this time. Are you coming for lunch?"),
                msg(sarah, "Wouldn't miss it. I'll bring the cake.")));
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
        //  • COMPLETED                — Help setting up my new tablet    [OTHER]
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
        ensureNeed(margaret, "Help setting up my new tablet",
                "My daughter sent me a tablet and I would love help setting it up for video calls.",
                NeedCategory.OTHER, NeedUrgency.NORMAL, NeedStatus.COMPLETED);
        ensureNeed(margaret, "Fix the dripping kitchen tap",
                "The kitchen tap drips through the night — I'd love help getting it sorted.",
                NeedCategory.CLEANING, NeedUrgency.NORMAL, NeedStatus.CANCELLED);
        // Guardian mode, written down: Sarah posted this one FOR her mother, so
        // it carries her name. It's OPEN and sits in Browse Requests, which
        // means a helper sees "Asked by Sarah, for Margaret" the moment they
        // look — nobody has to go hunting for the feature. Written in Sarah's
        // own voice, because she is the one who typed it.
        ensureNeed(margaret, sarah, "A lift to Mum's hearing test",
                "Mum has an appointment on Thursday morning and I can't drive her that day. "
                        + "A lift there and back would be a great help — she'll be about an hour.",
                NeedCategory.TRANSPORTATION, NeedUrgency.NORMAL, NeedStatus.OPEN);
        Need chess = ensureNeed(david, "Weekly chess and tea company",
                "Looking for someone to play chess with on weekend afternoons.",
                NeedCategory.COMPANIONSHIP, NeedUrgency.NORMAL, NeedStatus.OPEN);
        ensureNeed(grace, "Light apartment cleaning",
                "A hand with vacuuming and dusting once a week.",
                NeedCategory.CLEANING, NeedUrgency.NORMAL, NeedStatus.OPEN);
        // Tamil Nadu cluster: one open request per elder city, so a helper
        // browsing near Chennai or Coimbatore finds something right away.
        ensureNeed(lakshmi, "Help with video calls to my son",
                "My son lives in Singapore and I'd love help learning video calls on my phone.",
                NeedCategory.OTHER, NeedUrgency.NORMAL, NeedStatus.OPEN);
        ensureNeed(meena, "Company for my evening walk",
                "I walk near the race course every evening and would enjoy some company.",
                NeedCategory.COMPANIONSHIP, NeedUrgency.NORMAL, NeedStatus.OPEN);
        // These two exist so the HELPER demo account (Harsha) has every Browse
        // Needs segment filled: Applied needs an ACCEPTED offer on an ASSIGNED
        // need, Completed needs an ACCEPTED offer on a COMPLETED one. Rose and
        // David own them so Margaret's needs stay untouched — free for live
        // demos of the post → offer → accept flow.
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

        // One-time repair for DBs seeded before reviews were gated by the trust
        // ladder: earlier baselines planted reviews between pairs that never reached
        // TRUSTED — some on a still-pending invite, some hanging off a finished need
        // (David ↔ Harsha, who stop at VIDEO_CALL). The app can no longer create any
        // of those — ReviewService gates every review on the ladder — so retire the
        // leftovers between demo personas before re-seeding.
        retireUntrustedDemoReviews(demoUsers);

        // Reviews only exist where the app could truly create them: between the two
        // sides of an ACTIVE + TRUSTED connection. Finishing a job together is not a
        // shortcut past the ladder. Pairs still climbing (Margaret ↔ Priya at
        // PHONE_CALL, Margaret ↔ Ethan at FIRST_MEET, David ↔ Harsha at VIDEO_CALL,
        // Harsha ↔ Rose just connected) carry no reviews — that's the product
        // rule on display.
        ensureReview(grace, priya, null, 5,
                "Priya is always on time and treats me with such genuine care.",
                List.of("Reliable", "Punctual"));
        ensureReview(priya, grace, null, 5,
                "Grace is a delight — full of stories and so easy to spend time with.",
                List.of("Friendly", "Welcoming"));
        ensureReview(grace, james, null, 5,
                "Harsha is patient, knowledgeable, and genuinely kind.",
                List.of("Patient", "Reliable"));
        ensureReview(james, grace, null, 5,
                "Grace has a wonderful spirit and such a warm home.",
                List.of("Friendly", "Welcoming"));
        ensureReview(nina, david, null, 4,
                "David is gracious and always prepared — a lovely person to help.",
                List.of("Friendly", "Punctual"));
        ensureReview(david, nina, null, 4,
                "Nina is cheerful, punctual, and makes every trip a pleasure.",
                List.of("Punctual", "Friendly"));

        // Margaret has already checked in today, so the family journey's
        // "Checked in today" chip is green the moment Sarah's demo loads.
        // David's last check-in stays yesterday so a visitor on an elder
        // account can still press the check-in button and grow a streak.
        ensureStreak(margaret, 7, 14, LocalDate.now());
        ensureStreak(david, 3, 9, LocalDate.now().minusDays(1));

        ensureEmergencyContact(margaret, "Sarah (daughter)", "+14165550199", "Family");

        seedWhatMargaretPassesOn(margaret, sarah, davidSon, ruth);

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
     * family alerts/delegated powers/links → connections → emergency contacts →
     * streak. Reviews and applications that
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
        // What this account passed on, in the same order AccountService.purgeUserData uses:
        // the record first, then the keys (by both sides — a visitor may hold one for
        // somebody else), then the box, its rules, and finally the writing.
        passOnOpenRepository.deleteByOwnerId(id);
        keyholderRepository.deleteByOwnerIdOrKeyholderId(id, id);
        sealedItemRepository.deleteByOwnerId(id);
        passOnSettingsRepository.deleteByOwnerId(id);
        passOnItemRepository.deleteByOwnerId(id);
        familyAlertRepository.deleteByElderId(id);
        familyDelegatedPowerRepository.deleteByElderIdOrFamilyUserId(id, id);
        familyPowerRequestRepository.deleteByElderIdOrFamilyUserId(id, id);
        familyLinkRepository.deleteByElderIdOrFamilyUserId(id, id);
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

    /** Delete connection-based (no-need) reviews between demo personas whose
     *  connection never reached TRUSTED. The app can't create these any more —
     *  ReviewService gates reviews at the top of the trust ladder — so they only
     *  exist in DBs seeded from the older, looser baseline. Need-linked reviews
     *  and any review touching a real user are left untouched. */
    private void retireUntrustedDemoReviews(List<User> demoUsers) {
        Set<UUID> demoIds = demoUsers.stream().map(User::getId).collect(Collectors.toSet());
        for (Review r : reviewRepository.findAll()) {
            // Need-based reviews are checked too: a finished job never exempted a pair
            // from the trust ladder, and the seeder used to plant reviews that way.
            if (!demoIds.contains(r.getReviewer().getId()) || !demoIds.contains(r.getReviewee().getId())) continue;
            boolean fullyTrusted = connectionRepository
                    .findBetweenUsers(r.getReviewer().getId(), r.getReviewee().getId())
                    .filter(c -> c.getStatus() == ConnectionStatus.ACTIVE
                            && c.getCurrentTrustLevel() == TrustLevel.TRUSTED)
                    .isPresent();
            if (!fullyTrusted) {
                log.info("Retiring pre-gate demo review {} → {}",
                        r.getReviewer().getEmail(), r.getReviewee().getEmail());
                reviewRepository.delete(r);
            }
        }
    }

    /**
     * Ensure an ACTIVE family link between the demo elder and their family
     * member, as if the request was sent by the family member and accepted
     * in-app. On reset the row was just purged, so this recreates the accepted
     * baseline; in additive mode an existing link (any status) is restored to
     * ACTIVE only if a visitor revoked/declined it. The elder's +1 family trust
     * point follows from the recalculate loop at the end of {@link #seed()}.
     */
    private void ensureFamilyLink(User elder, User familyUser, String relationship) {
        FamilyLink link = familyLinkRepository
                .findByElderIdAndFamilyUserId(elder.getId(), familyUser.getId())
                .orElse(null);
        if (link == null) {
            link = FamilyLink.builder()
                    .elder(elder).familyUser(familyUser).initiatedBy(familyUser)
                    .build();
        } else if (link.getStatus() == FamilyLinkStatus.ACTIVE) {
            return;
        }
        link.setRelationship(relationship);
        link.setStatus(FamilyLinkStatus.ACTIVE);
        link.setRespondedAt(LocalDateTime.now());
        link.setRevokedAt(null);
        familyLinkRepository.save(link);
    }

    /** Flip the elder's per-connection family switch ON for one baseline
     *  connection, so the demo shows a shared friendship next to private ones
     *  (every other connection keeps the FALSE default). */
    /** See the call site: clears the pre-swap Tom family story out of additive-mode
     *  DBs (old shared flag, old family notes, stale Sarah → Tom request). */
    private void retireTomFamilyStory(User margaret, User tom, User sarah) {
        connectionRepository.findBetweenUsers(margaret.getId(), tom.getId()).ifPresent(c -> {
            if (Boolean.TRUE.equals(c.getSharedWithFamily())) {
                c.setSharedWithFamily(false);
                connectionRepository.save(c);
            }
            messageRepository.deleteByConnectionIdAndChannel(c.getId(), MessageChannel.FAMILY_UPDATES);
        });
        connectionRepository.findBetweenUsers(sarah.getId(), tom.getId())
                .filter(c -> c.getType() == ConnectionType.FAMILY && c.getStatus() == ConnectionStatus.PENDING)
                .ifPresent(connectionRepository::delete);
    }

    /** See the call site: clears the pre-swap Harsha family story out of
     *  additive-mode DBs. Unlike the Tom repair, the whole Margaret ↔ Harsha
     *  connection goes — Harsha (the public helper demo login) must hold no
     *  connection to Margaret at all, so a live demo can walk the connect flow
     *  between the two public accounts. The derived Sarah ↔ Harsha family chat
     *  and the stale first-meeting alert naming Harsha go with it. */
    private void retireHarshaFamilyStory(User margaret, User harsha, User sarah) {
        connectionRepository.findBetweenUsers(margaret.getId(), harsha.getId()).ifPresent(c -> {
            messageRepository.deleteByConnectionId(c.getId());
            connectionRepository.delete(c);
        });
        connectionRepository.findBetweenUsers(sarah.getId(), harsha.getId())
                .filter(c -> c.getType() == ConnectionType.FAMILY)
                .ifPresent(c -> {
                    messageRepository.deleteByConnectionId(c.getId());
                    connectionRepository.delete(c);
                });
        familyAlertRepository.findByElderIdOrderByCreatedAtDesc(margaret.getId()).stream()
                .filter(a -> FamilyAlertType.FIRST_MEET.name().equals(a.getType())
                        && a.getBody() != null && a.getBody().contains("Harsha"))
                .forEach(familyAlertRepository::delete);
    }

    private void markSharedWithFamily(Connection c) {
        if (Boolean.TRUE.equals(c.getSharedWithFamily())) return;
        c.setSharedWithFamily(true);
        connectionRepository.save(c);
    }

    // ── What I pass on ───────────────────────────────────────────────────

    /** How long ago Margaret set her box up. Comfortably past her seven days. */
    private static final int ARMED_DAYS_AGO = 40;
    /** When Sarah opened the letter written to her — the "Sarah read this on …" line. */
    private static final int LETTER_READ_DAYS_AGO = 12;
    /** Two of the three. Never one, and never all of them. */
    private static final int APPROVALS_NEEDED = 2;

    /**
     * Everything Margaret passes on: her stories, her letters, her Sealed box and the three
     * people who would one day be asked to open it.
     *
     * <h3>The box is really encrypted</h3>
     * Every sealed item goes through {@link SealedBoxService#add}, which is the same call the
     * elder's own screen makes, so the demo rows are sealed by the production crypto under the
     * production key. A seeder that wrote its own rows would prove nothing and would diverge
     * from the real thing at exactly the point where divergence is most dangerous — a demo box
     * that opens while a real one does not, or the reverse.
     *
     * <h3>Nothing here simulates a death</h3>
     * No release is in flight, no certificate exists and no row sits in a state a scheduled
     * job could advance. A public demo that regenerated "someone says you have died" every few
     * minutes would be a defect, not completeness. The only backdating is her own setup date.
     *
     * <p>She holds one letter until after she is gone, and she is not gone: her
     * {@code released_at} stays null, which is the only switch that would open it. That is the
     * state a real elder who chooses "only after I'm gone" is in for years, and it is the one
     * the demo shows. Releasing her would instead show a letter nobody can change and a page
     * she can no longer write on — a permanent frozen account, five minutes after every reset.
     *
     * <h3>Why it can decline to run</h3>
     * With no master key configured — every local machine and CI — the crypto is unavailable
     * and the Sealed box half is skipped rather than attempted. {@code SealedBoxService} is
     * transactional, so letting it throw would mark the whole seeding transaction
     * rollback-only and cost the demo everything else in this method too.
     */
    private void seedWhatMargaretPassesOn(User margaret, User sarah, User davidSon, User ruth) {
        // Three stories, one per audience, so no filter on her page opens on an empty list.
        ensureStory(margaret, "The winter we lost the roof", PassOnAudience.EVERYONE,
                "The gale came through on a Tuesday night in 1978 and took half the roof with "
                        + "it. We slept four to a bed in the front room and your grandfather went up "
                        + "the ladder every morning for a fortnight with a tarpaulin and a hammer. I "
                        + "have never been colder or laughed more. When people tell me they are "
                        + "having a hard year, that is the winter I think of.");
        ensureStory(margaret, "What I wish I had told your father", PassOnAudience.FAMILY,
                "He asked me once, near the end, whether I had been happy. I said of course, "
                        + "the way you do when you are carrying a tray. What I should have said is "
                        + "that the happiest I ever was, was the ordinary Sunday afternoons, with the "
                        + "radio on and nobody needing anything. I am writing it here so it is said.");
        ensureStory(margaret, "How to get the boiler going", PassOnAudience.HELPERS,
                "It looks broken and it is not. The switch by the back door has to be off for "
                        + "a full minute before you press the red button, and you have to hold the "
                        + "button while it clicks three times. Anything less than three clicks and it "
                        + "will not light. Do not let anybody sell you a new one.");

        // Two letters, both readable now: one Sarah has already opened, one still waiting.
        ensureLetter(margaret, sarah, "For Sarah, whenever you need it",
                "My darling girl. You have spent so much of your life making sure everybody "
                        + "else was all right, and I want you to know that I noticed every single "
                        + "time. Be as kind to yourself as you have been to me. That is the whole "
                        + "letter, really.",
                LocalDateTime.now().minusDays(LETTER_READ_DAYS_AGO));
        ensureLetter(margaret, davidSon, "For David, about the garden",
                "You always said the apple tree at the bottom was more trouble than it was "
                        + "worth, and you were right, and I want you to keep it anyway. Your father "
                        + "planted it the spring you were born. Prune it hard in February and it will "
                        + "outlast all of us.",
                null);

        // And one she is keeping back for her sister. Without it "only after I'm gone" is a
        // choice on a form that nothing in the demo has ever made, and the held state — the one
        // a woman who picks it lives in for years — is never on screen.
        ensureHeldLetter(margaret, ruth, "For Ruth, for when I am gone",
                "You have been my sister all my life and my best friend for most of it. When "
                        + "you read this, put the kettle on first — you always did think better "
                        + "with a cup in your hand. Tell the others gently, and then sit in the "
                        + "garden a while and think of the summer we cycled to the coast. There "
                        + "is nothing left unsaid between us, and that is the finest thing I have.");

        seedMargaretsSealedBox(margaret, sarah, davidSon, ruth);
    }

    /**
     * The Sealed box, sealed for real, with three Keyholders and her seven days behind her.
     * See {@link #seedWhatMargaretPassesOn} for why this can decline to run.
     */
    private void seedMargaretsSealedBox(User margaret, User sarah, User davidSon, User ruth) {
        if (!sealedCryptoService.isAvailable()) {
            log.info("Sealed box demo skipped: no master key configured (the rest of the demo is unaffected)");
            return;
        }
        // Already set up: either an untouched baseline or a visitor's own box. Either way this
        // must not ask three people the same question a second time.
        if (passOnSettingsRepository.findById(margaret.getId())
                .filter(row -> row.getArmedAt() != null).isPresent()) {
            return;
        }

        // Locations and people, never credentials. The one readable field on a sealed row is
        // the kind, and PASSWORDS is deliberately unused here: a demo is a teacher, and no
        // elder should learn from it that her passwords belong in an app.
        if (sealedItemRepository.countByOwnerId(margaret.getId()) == 0) {
            MARGARET_SEALED_ITEMS.forEach(item -> seal(margaret, item));
        }

        // Armed through the real setup: the invitations go out, the two sentences she ticked
        // are hashed as typed, and her own record gets the line saying the box was set up.
        PassOnArmRequest arm = new PassOnArmRequest();
        arm.setPersonIds(List.of(sarah.getId(), davidSon.getId(), ruth.getId()));
        arm.setApprovalsNeeded(APPROVALS_NEEDED);
        arm.setNotAWillAck(SealedBoxService.NOT_A_WILL_ACK);
        arm.setKeyTruthAck(SealedBoxService.KEY_TRUTH_ACK);
        sealedBoxService.arm(margaret.getId(), arm);

        // Two said yes. Ruth is left exactly as the invitation found her, the same deliberate
        // half-finished state as ensureFamilyPowerRequest above: Margaret's screen shows a
        // real "asked, not answered yet", and Ruth's own screen opens on a real acceptance
        // card rather than a mock-up of one.
        acceptKey(margaret, sarah);
        acceptKey(margaret, davidSon);

        // Her seven days are behind her, so the demo opens on the settled card and not on the
        // "if this was not your idea, undo it" banner. Backdated afterwards because arming is
        // what starts the week, and the week has to start from a real arming.
        passOnSettingsRepository.findById(margaret.getId()).ifPresent(row -> {
            LocalDateTime armedAt = LocalDateTime.now().minusDays(ARMED_DAYS_AGO);
            row.setArmedAt(armedAt);
            row.setCoolingOffUntil(armedAt.plusDays(7));
            passOnSettingsRepository.save(row);
        });
    }

    /**
     * One thing in Margaret's demo Sealed box.
     *
     * <p>Locations and people, never credentials. The only readable field on a sealed row is
     * the kind, and {@code PASSWORDS} is deliberately unused: a demo teaches, and no elder
     * should learn from this one that her passwords belong in an app.
     */
    record DemoSealedItem(String label, SealedKind kind, String body) {}

    /**
     * Exactly what the demo box contains. Package-visible and shared rather than written
     * inline, so {@code DemoSealedBoxOpensDbTest} can prove that <em>these</em> rows — not a
     * copy of them written for a test — really open again with the demo password.
     */
    static final List<DemoSealedItem> MARGARET_SEALED_ITEMS = List.of(
            new DemoSealedItem("Where the house papers are", SealedKind.PAPERS,
                    "In the brown envelope in the second drawer of the writing desk, underneath "
                            + "the tablecloths. The deeds and the insurance are both in there."),
            new DemoSealedItem("The tin in the pantry", SealedKind.MONEY,
                    "There is a little money in the biscuit tin on the top shelf of the pantry, "
                            + "behind the flour. It is not much. It is for the wake."),
            new DemoSealedItem("Who to telephone about the house", SealedKind.OTHER,
                    "Mr Reid at the solicitors on Sherbrooke Street looked after everything when "
                            + "your father died and he knows where the rest of it is. His number is "
                            + "in my address book under R."));

    private void seal(User owner, DemoSealedItem item) {
        SealedItemRequest request = new SealedItemRequest();
        request.setLabel(item.label());
        request.setBody(item.body());
        request.setKindHint(item.kind());
        sealedBoxService.add(owner.getId(), request);
    }

    /** Says yes on the Keyholder's behalf, through the only method entitled to say it. */
    private void acceptKey(User owner, User person) {
        keyholderRepository.findByOwnerIdAndKeyholderId(owner.getId(), person.getId())
                .filter(row -> row.getStatus() == KeyholderStatus.INVITED)
                .map(Keyholder::getId)
                .ifPresent(rowId -> keyholderService.respond(person.getId(), rowId, true));
    }

    private void ensureStory(User owner, String title, PassOnAudience audience, String body) {
        ensurePassOnItem(owner, PassOnKind.STORY, title, body, audience, null, null,
                PassOnRelease.NOW);
    }

    private void ensureLetter(User owner, User person, String title, String body,
                              LocalDateTime firstReadAt) {
        ensurePassOnItem(owner, PassOnKind.LETTER, title, body, PassOnAudience.PERSON,
                person, firstReadAt, PassOnRelease.NOW);
    }

    /**
     * A letter held until after the writer is gone: written and addressed today, shut to the
     * person it names until a human runs the release procedure for this owner by hand.
     *
     * <p>There is no first-read date to pass and none is offered. The person it names cannot
     * have read it — {@code released_at} is null for every demo owner, and
     * {@code PassOnVisibilityService} turns every reader but the writer away until it is not.
     * A seeded read date would be the one thing here that could not have happened.
     */
    private void ensureHeldLetter(User owner, User person, String title, String body) {
        ensurePassOnItem(owner, PassOnKind.LETTER, title, body, PassOnAudience.PERSON,
                person, null, PassOnRelease.AFTER);
    }

    /** Guarded by owner + kind + title, so a re-run never writes a second copy of a story. */
    private void ensurePassOnItem(User owner, PassOnKind kind, String title, String body,
                                  PassOnAudience audience, User person, LocalDateTime firstReadAt,
                                  PassOnRelease releaseWhen) {
        boolean exists = passOnItemRepository
                .findByOwnerIdAndKindOrderByCreatedAtDesc(owner.getId(), kind)
                .stream().anyMatch(item -> title.equals(item.getTitle()));
        if (exists) return;

        passOnItemRepository.save(PassOnItem.builder()
                .owner(owner)
                .kind(kind)
                .title(title)
                .body(body)
                .audience(audience)
                .audienceUser(person)
                // NOW for the stories and for the letters she means to be read today; AFTER for
                // the one she is holding back, which this version delivers for real. What the
                // demo must never show is a RELEASED owner: her released_at stays null, so the
                // held letter sits shut exactly as a living elder's does, and nothing here waits
                // on a death that a job could then act on.
                .releaseWhen(releaseWhen)
                .firstReadAt(firstReadAt)
                .build());
    }

    /** Sets the name on the account when it is missing or has drifted, and not otherwise. */
    private User ensureFullName(User user, String fullName) {
        if (fullName.equals(user.getFullName())) return user;
        user.setFullName(fullName);
        return userRepository.save(user);
    }

    // ── helpers, continued ───────────────────────────────────────────────

    private User ensureUser(String email, String phone, UserRole role, String rawPassword) {
        return ensureUser(email, phone, role, rawPassword, MONTREAL);
    }

    private User ensureUser(String email, String phone, UserRole role, String rawPassword, CityPin home) {
        Optional<User> existing = userRepository.findByEmail(email);
        if (existing.isPresent()) {
            User u = existing.get();
            boolean dirty = false;
            // Demo accounts must be discoverable: pin them to their home cluster if unset
            if (u.getLocationLat() == null || u.getLocationLng() == null) {
                u.setLocationLat(home.lat()); u.setLocationLng(home.lng()); dirty = true;
            }
            if (u.getVerificationStatus() != VerificationStatus.VERIFIED) {
                u.setVerificationStatus(VerificationStatus.VERIFIED); dirty = true;
            }
            if (!u.isPhoneVerified()) { u.setPhoneVerified(true); dirty = true; }
            // Accounts seeded before this column existed carry false, and an unconfirmed
            // address is refused by the Sealed box setup — "one day it is how we would reach
            // you about your box". Without this the demo elder cannot arm hers at all.
            if (!u.isEmailVerified()) { u.setEmailVerified(true); dirty = true; }
            // Full reset: snap account settings a visitor may have changed (their
            // location, date of birth, city, phone, verification) back to baseline.
            if (resetEnabled) {
                u.setLocationLat(home.lat().add(jitter(email)));
                u.setLocationLng(home.lng().add(jitter(email + "lng")));
                u.setCity(home.city());
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
                .locationLat(home.lat().add(jitter(email)))
                .locationLng(home.lng().add(jitter(email + "lng")))
                .city(home.city())
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
        ensureElderProfile(user, name, age, bio, interests, occupation, gender, photoUrl,
                facebookUrl, new String[]{"English"});
    }

    private void ensureElderProfile(User user, String name, int age, String bio,
                                    String[] interests, String occupation, Gender gender, String photoUrl,
                                    String facebookUrl, String[] languages) {
        ElderProfile p = elderProfileRepository.findByUserId(user.getId()).orElse(null);
        if (p != null && !resetEnabled) return;
        if (p == null) p = ElderProfile.builder().user(user).build();
        p.setName(name);
        p.setAge(age);
        p.setBio(bio);
        p.setInterests(interests);
        p.setLanguages(languages);
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
        if (existing.isPresent()) {
            Connection c = existing.get();
            // Trust levels only ever move UP in production, so an active row sitting
            // below its seed baseline means the baseline itself was raised (e.g. the
            // review-gate rebalance promoted two pairs to TRUSTED). Lift it to match;
            // never lower a level a visitor has legitimately advanced.
            if (c.getStatus() == ConnectionStatus.ACTIVE
                    && status == ConnectionStatus.ACTIVE
                    && c.getCurrentTrustLevel().getValue() < level.getValue()) {
                c.setCurrentTrustLevel(level);
                c.setConfirmedByA(confirmedByA);
                c.setConfirmedByB(confirmedByB);
                return connectionRepository.save(c);
            }
            return c;
        }
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

    /** Family updates live beside the MAIN chat on the same connection, so they get
     *  their own channel-scoped seed gate (the MAIN gate above would block them). */
    private void seedFamilyNotesIfEmpty(Connection conn, long endedMinutesAgo, List<Draft> drafts) {
        if (messageRepository.countByConnectionIdAndChannel(conn.getId(), MessageChannel.FAMILY_UPDATES) > 0) return;
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
                    .channel(MessageChannel.FAMILY_UPDATES)
                    .createdAt(ts)
                    .build());
        }
    }

    private Need ensureNeed(User elder, String title, String description,
                            NeedCategory category, NeedUrgency urgency, NeedStatus status) {
        return ensureNeed(elder, null, title, description, category, urgency, status);
    }

    /** Same request, but written by a family member for the elder (guardian mode).
     *  The request still belongs to the elder — {@code actedBy} only records who
     *  did the typing, which is what the "Asked by Sarah, for Margaret" line reads. */
    private Need ensureNeed(User elder, User actedBy, String title, String description,
                            NeedCategory category, NeedUrgency urgency, NeedStatus status) {
        Optional<Need> existing = needRepository
                .findByElderIdOrderByCreatedAtDesc(elder.getId(), org.springframework.data.domain.Pageable.unpaged())
                .stream().filter(n -> title.equals(n.getTitle())).findFirst();
        if (existing.isPresent()) return existing.get();
        return needRepository.save(Need.builder()
                .elder(elder).actedBy(actedBy).title(title).description(description)
                .category(category).urgency(urgency).status(status)
                .schedule(NeedSchedule.ONE_TIME)
                .locationLat(elder.getLocationLat()).locationLng(elder.getLocationLng())
                .build());
    }

    /** Grant the family member exactly these powers over the elder, adding only
     *  what's missing so a re-run never duplicates a row (the table also carries
     *  a unique constraint on elder + family member + power). */
    private void ensureDelegatedPowers(User elder, User familyUser, Set<DelegatedPower> powers) {
        Set<DelegatedPower> already = familyDelegatedPowerRepository
                .findByElderIdAndFamilyUserId(elder.getId(), familyUser.getId())
                .stream().map(FamilyDelegatedPower::getPower).collect(Collectors.toSet());
        powers.stream()
                .filter(p -> !already.contains(p))
                .forEach(p -> familyDelegatedPowerRepository.save(FamilyDelegatedPower.builder()
                        .elder(elder).familyUser(familyUser).power(p)
                        .build()));
    }

    /** Consent flow: seed one PENDING ask so the elder's approval card shows.
     *  Skips when the power is already granted or ANY request row exists for
     *  the pair + power — in additive mode a visitor's answer (and the cooldown
     *  story it starts) must never be overwritten by the next boot. */
    private void ensureFamilyPowerRequest(User elder, User familyUser, DelegatedPower power) {
        if (familyDelegatedPowerRepository.existsByElderIdAndFamilyUserIdAndPower(
                elder.getId(), familyUser.getId(), power)) return;
        boolean anyRequest = familyPowerRequestRepository
                .findByElderIdOrFamilyUserId(elder.getId(), familyUser.getId())
                .stream().anyMatch(r -> r.getPower() == power
                        && r.getElder().getId().equals(elder.getId())
                        && r.getFamilyUser().getId().equals(familyUser.getId()));
        if (anyRequest) return;
        familyPowerRequestRepository.save(com.towinly.family.entity.FamilyPowerRequest.builder()
                .elder(elder).familyUser(familyUser).power(power)
                .build());
    }

    /** One family alert so the News tab is never empty. Guarded by elder + type:
     *  the News badge counts rows, so an additive re-boot must not append twins. */
    private void ensureFamilyAlert(User elder, FamilyAlertType type, String body) {
        boolean exists = familyAlertRepository.findByElderIdOrderByCreatedAtDesc(elder.getId())
                .stream().anyMatch(a -> type.name().equals(a.getType()));
        if (exists) return;
        familyAlertRepository.save(com.towinly.family.entity.FamilyAlert.builder()
                .elder(elder).type(type.name()).body(body)
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

    private void ensureStreak(User user, int current, int longest, LocalDate lastCheckin) {
        if (userStreakRepository.findByUserId(user.getId()).isPresent()) return;
        UserStreak s = new UserStreak();
        s.setUserId(user.getId());
        s.setCurrentStreak(current);
        s.setLongestStreak(longest);
        s.setLastCheckinDate(lastCheckin);
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
