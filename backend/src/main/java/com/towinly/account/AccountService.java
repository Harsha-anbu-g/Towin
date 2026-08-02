package com.towinly.account;

import com.towinly.common.entity.User;
import com.towinly.common.repository.UserRepository;
import com.towinly.connection.entity.Connection;
import com.towinly.connection.repository.ConnectionRepository;
import com.towinly.emergency.entity.EmergencyContact;
import com.towinly.emergency.repository.EmergencyContactRepository;
import com.towinly.family.entity.FamilyAlert;
import com.towinly.family.entity.FamilyLink;
import com.towinly.family.repository.FamilyAlertRepository;
import com.towinly.family.repository.FamilyLinkRepository;
import com.towinly.messaging.repository.MessageRepository;
import com.towinly.need.entity.Need;
import com.towinly.need.repository.NeedApplicationRepository;
import com.towinly.need.repository.NeedRepository;
import com.towinly.common.enums.KeyholderStatus;
import com.towinly.common.enums.PassOnKind;
import com.towinly.passon.entity.Keyholder;
import com.towinly.passon.entity.PassOnItem;
import com.towinly.passon.entity.PassOnOpen;
import com.towinly.passon.entity.PassOnSettings;
import com.towinly.passon.entity.SealedItem;
import com.towinly.passon.repository.KeyholderRepository;
import com.towinly.passon.repository.PassOnItemRepository;
import com.towinly.passon.repository.PassOnOpenRepository;
import com.towinly.passon.repository.PassOnSettingsRepository;
import com.towinly.passon.repository.SealedItemRepository;
import com.towinly.profile.entity.ElderProfile;
import com.towinly.profile.entity.HelperProfile;
import com.towinly.profile.repository.ElderProfileRepository;
import com.towinly.profile.repository.HelperProfileRepository;
import com.towinly.report.repository.ReportRepository;
import com.towinly.review.entity.Review;
import com.towinly.review.repository.ReviewRepository;
import com.towinly.trust.repository.TrustProgressionLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Self-service account operations for the authenticated user: GDPR data export
 * (right of access) and account deletion (right to erasure). The cascade purge
 * lives here and is reused by the admin delete path so the two never drift.
 */
@Service
@RequiredArgsConstructor
public class AccountService {

    private final UserRepository userRepository;
    private final ElderProfileRepository elderProfileRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final ReviewRepository reviewRepository;
    private final ReportRepository reportRepository;
    private final ConnectionRepository connectionRepository;
    private final NeedRepository needRepository;
    private final NeedApplicationRepository needApplicationRepository;
    private final MessageRepository messageRepository;
    private final EmergencyContactRepository emergencyContactRepository;
    private final TrustProgressionLogRepository trustProgressionLogRepository;
    private final FamilyLinkRepository familyLinkRepository;
    private final FamilyAlertRepository familyAlertRepository;
    private final com.towinly.family.repository.FamilyDelegatedPowerRepository familyDelegatedPowerRepository;
    private final com.towinly.family.repository.FamilyPowerRequestRepository familyPowerRequestRepository;
    private final PassOnItemRepository passOnItemRepository;
    private final SealedItemRepository sealedItemRepository;
    private final KeyholderRepository keyholderRepository;
    private final PassOnSettingsRepository passOnSettingsRepository;
    private final PassOnOpenRepository passOnOpenRepository;
    /** Whether a person has released this account's owner. Nothing here ever sets it. */
    private final com.towinly.passon.service.ReleaseGate releaseGate;
    /** Where a bereaved family writes. Null until a deployment sets it. */
    private final com.towinly.passon.service.ReleaseContact releaseContact;

    private final com.towinly.common.service.S3Service s3Service;

    /**
     * Removes a user and every record that references them. Shared by the
     * self-service delete and the admin delete so both clean up identically.
     */
    @Transactional
    public void purgeUserData(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        String photoUrl = photoUrlFor(userId);
        if (photoUrl != null) s3Service.deleteFile(photoUrl);
        if (user.getIdDocumentUrl() != null) s3Service.deleteFile(user.getIdDocumentUrl());

        messageRepository.deleteByConnectionUserIdOrSenderId(userId);
        reviewRepository.deleteByReviewerIdOrRevieweeId(userId, userId);
        reportRepository.deleteByReporterIdOrReportedUserId(userId, userId);
        needApplicationRepository.deleteByHelperId(userId);
        needRepository.findByElderIdOrderByCreatedAtDesc(userId, Pageable.unpaged())
                .forEach(need -> needApplicationRepository.deleteByNeedId(need.getId()));
        needRepository.deleteByElderId(userId);
        emergencyContactRepository.deleteByElderId(userId);
        familyAlertRepository.deleteByElderId(userId);
        // The DB would cascade these off the user row, but the purge stays the
        // single source of truth for what leaves with an account.
        familyDelegatedPowerRepository.deleteByElderIdOrFamilyUserId(userId, userId);
        familyPowerRequestRepository.deleteByElderIdOrFamilyUserId(userId, userId);
        familyLinkRepository.deleteByElderIdOrFamilyUserId(userId, userId);
        // "What I pass on". Four of these five would cascade off the user row on their own,
        // but passon_opens.owner_id deliberately carries no foreign key — see V53 — so the
        // record of who opened this person's Sealed box outlives their right to erasure
        // unless it is named here. Keyholders go by both sides: the departing account may
        // own a box or hold somebody else's key.
        passOnOpenRepository.deleteByOwnerId(userId);
        keyholderRepository.deleteByOwnerIdOrKeyholderId(userId, userId);
        sealedItemRepository.deleteByOwnerId(userId);
        passOnSettingsRepository.deleteByOwnerId(userId);
        passOnItemRepository.deleteByOwnerId(userId);
        trustProgressionLogRepository.deleteByUserId(userId);
        connectionRepository.deleteByUserId(userId);
        elderProfileRepository.deleteByUserId(userId);
        helperProfileRepository.deleteByUserId(userId);
        userRepository.delete(user);
    }

    /**
     * The authenticated user deleting their own account — unless a person has already released
     * them, in which case there is no authenticated user, only somebody holding their account.
     *
     * <h3>Why erasure stops here</h3>
     * This endpoint takes nothing but the JWT: no password, no confirmation, no second step. One
     * call erases every story and letter, including the ones a bereaved daughter has already been
     * given and read. After a release the data subject is dead, so whoever is pressing this is by
     * definition not them, and the deceased have no erasure right left to exercise. Refusing is
     * the honest answer, and it is the cheapest attack on the whole freeze if we do not.
     *
     * <h3>Why only this door</h3>
     * {@link #purgeUserData} is deliberately untouched. It is shared with the admin delete, and
     * an operator must still be able to honour a real erasure order — including for a living
     * person released by mistake, which is a case this procedure has to be able to unwind.
     */
    @Transactional
    public void deleteOwnAccount(UUID userId) {
        if (releaseGate.isReleased(userId)) {
            throw new IllegalArgumentException(cannotDeleteAfterRelease(releaseContact.email()));
        }
        purgeUserData(userId);
    }

    /**
     * What a bereaved relative reads. It names somewhere to write, because being told "no" with
     * no next step is how a grieving family conclude the app has eaten their mother's words.
     *
     * <p>When no address is configured it says so plainly rather than leaving a blank or printing
     * a plausible-looking mailbox nobody reads — the same rule {@code ReleaseContact} follows
     * everywhere else.
     */
    static String cannotDeleteAfterRelease(String contactEmail) {
        return CANNOT_DELETE_AFTER_RELEASE
                + (contactEmail == null
                        ? "Towinly has not set an address to write to yet."
                        : "If you need to talk to somebody about it, write to " + contactEmail + ".");
    }

    /** Constant prefix so GlobalExceptionHandler can allow the sentence through by its start. */
    static final String CANNOT_DELETE_AFTER_RELEASE =
            "What was on this account has been passed on to the people it was meant for, and it "
                    + "cannot be taken back now. ";

    /**
     * Builds a plain-data snapshot of everything the platform holds about the
     * user, for a GDPR Article 15 export. Only scalar fields are included so the
     * response serialises cleanly without touching lazy associations.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> exportUserData(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        Map<String, Object> out = new LinkedHashMap<>();

        Map<String, Object> account = new LinkedHashMap<>();
        account.put("id", user.getId());
        account.put("username", user.getUsername());
        account.put("email", user.getEmail());
        account.put("phone", user.getPhone());
        account.put("role", user.getRole() != null ? user.getRole().name() : null);
        account.put("authProvider", user.getAuthProvider());
        account.put("trustScore", user.getTrustScore());
        account.put("verificationStatus", user.getVerificationStatus() != null ? user.getVerificationStatus().name() : null);
        account.put("phoneVerified", user.isPhoneVerified());
        account.put("dateOfBirth", user.getDateOfBirth());
        account.put("createdAt", user.getCreatedAt());
        out.put("account", account);

        elderProfileRepository.findByUserId(userId).ifPresent(p -> out.put("elderProfile", elderProfile(p)));
        helperProfileRepository.findByUserId(userId).ifPresent(p -> out.put("helperProfile", helperProfile(p)));

        out.put("needsPosted", needRepository.findByElderIdOrderByCreatedAtDesc(userId, Pageable.unpaged())
                .stream().map(this::needSummary).collect(Collectors.toList()));

        out.put("reviewsGiven", reviewRepository.findByReviewerIdOrderByCreatedAtDesc(userId)
                .stream().map(this::reviewSummary).collect(Collectors.toList()));
        out.put("reviewsReceived", reviewRepository.findByRevieweeIdOrderByCreatedAtDesc(userId)
                .stream().map(this::reviewSummary).collect(Collectors.toList()));

        out.put("emergencyContacts", emergencyContactRepository.findByElderId(userId)
                .stream().map(this::contactSummary).collect(Collectors.toList()));

        out.put("connections", connectionRepository.findAllByUser(userId)
                .stream().map(this::connectionSummary).collect(Collectors.toList()));

        out.put("familyLinks", familyLinkRepository.findByElderIdOrFamilyUserId(userId, userId)
                .stream().map(this::familyLinkSummary).collect(Collectors.toList()));

        // Elder-keyed: non-elders simply get an empty list here.
        out.put("familyAlerts", familyAlertRepository.findByElderIdOrderByCreatedAtDesc(userId)
                .stream().map(this::familyAlertSummary).collect(Collectors.toList()));

        // Personal data on both seats: what an elder handed out, and what a
        // family member holds or asked for.
        out.put("delegatedPowers", familyDelegatedPowerRepository.findByElderIdOrFamilyUserId(userId, userId)
                .stream().map(p -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("power", p.getPower() != null ? p.getPower().name() : null);
                    m.put("elderId", p.getElder().getId());
                    m.put("familyUserId", p.getFamilyUser().getId());
                    m.put("createdAt", p.getCreatedAt());
                    return m;
                }).collect(Collectors.toList()));
        out.put("powerRequests", familyPowerRequestRepository.findByElderIdOrFamilyUserId(userId, userId)
                .stream().map(r -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("power", r.getPower() != null ? r.getPower().name() : null);
                    m.put("status", r.getStatus() != null ? r.getStatus().name() : null);
                    m.put("elderId", r.getElder().getId());
                    m.put("familyUserId", r.getFamilyUser().getId());
                    m.put("createdAt", r.getCreatedAt());
                    m.put("respondedAt", r.getRespondedAt());
                    return m;
                }).collect(Collectors.toList()));

        addPassOnSections(out, userId);

        return out;
    }

    /**
     * "What I pass on", inside the GDPR export.
     *
     * Two boundaries are drawn here on purpose.
     *
     * <p><b>Only what this person wrote.</b> Letters other people addressed to them are not
     * included. {@code PassOnVisibilityService} is the single authority on who may read what
     * an elder passes on; an export that answered the same question for itself would become a
     * second authority, and the two would drift.
     *
     * <p><b>The Sealed box leaves as metadata and nothing else.</b> This endpoint is
     * authenticated by the JWT alone — it never asks for the password, and it is not subject
     * to the seven-day freeze that follows a credential change. If it emitted anything
     * readable from the box, whoever took over an elder's mailbox would be one download away
     * from her bank details and both defences would be decorative. Not even the ciphertext
     * goes: a base64 blob in a downloadable file is still the box leaving the building.
     */
    private void addPassOnSections(Map<String, Object> out, UUID userId) {
        out.put("passOnItems", passOnItemRepository.findByOwnerIdOrderByCreatedAtDesc(userId)
                .stream().map(this::passOnItemSummary).collect(Collectors.toList()));

        out.put("sealedBoxItems", sealedItemRepository.findByOwnerIdOrderBySortOrderAscCreatedAtAsc(userId)
                .stream().map(this::sealedItemSummary).collect(Collectors.toList()));

        // Both sides: being asked to hold somebody's key is personal data about the person
        // asked, not only about the person who asked.
        out.put("sealedBoxKeyholders", keyholderRepository.findByOwnerIdOrKeyholderId(userId, userId)
                .stream().map(this::keyholderSummary).collect(Collectors.toList()));

        passOnSettingsRepository.findById(userId)
                .ifPresent(s -> out.put("sealedBoxSettings", sealedSettingsSummary(s)));

        out.put("sealedBoxOpens", passOnOpenRepository.findByOwnerIdOrderByAtDesc(userId)
                .stream().map(this::passOnOpenSummary).collect(Collectors.toList()));
    }

    /**
     * What an account deletion would take with it, in numbers and in one plain sentence.
     *
     * Shared by the self-serve and the admin delete for the same reason {@link #purgeUserData}
     * is: the two paths destroy exactly the same rows, so they must warn about exactly the
     * same things. Without this an admin pressing Delete would erase a Sealed box, five
     * letters and three people's standing arrangement with no indication any of it existed.
     *
     * <p>The wording here is not from the design document, which supplies none for this
     * screen. It is deliberately person-neutral ("this account") because the same sentence is
     * read by an elder about herself and by an admin about somebody else.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> deletionWarning(UUID userId) {
        userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        long stories = passOnItemRepository.countByOwnerIdAndKind(userId, PassOnKind.STORY);
        long letters = passOnItemRepository.countByOwnerIdAndKind(userId, PassOnKind.LETTER);
        long sealedItems = sealedItemRepository.countByOwnerId(userId);
        long keyholders = keyholderRepository.countByOwnerIdAndStatus(userId, KeyholderStatus.ACTIVE);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("stories", stories);
        out.put("letters", letters);
        out.put("sealedItems", sealedItems);
        out.put("keyholders", keyholders);
        out.put("summary", deletionSummary(stories, letters, sealedItems));

        // Only when there is a box to hold a key to. A warning about something that is not
        // there is how people learn to stop reading warnings.
        if (sealedItems > 0 && keyholders > 0) {
            out.put("keyholderNote", (keyholders == 1
                    ? "1 person holds a key"
                    : keyholders + " people hold a key")
                    + " to that Sealed box. Nobody is told when it goes.");
        }
        return out;
    }

    /** One sentence naming only the things that are actually there. */
    private String deletionSummary(long stories, long letters, long sealedItems) {
        List<String> parts = new ArrayList<>();
        if (stories > 0) parts.add(stories + (stories == 1 ? " story" : " stories"));
        if (letters > 0) parts.add(letters + (letters == 1 ? " letter" : " letters"));
        if (sealedItems > 0) {
            parts.add(sealedItems + (sealedItems == 1 ? " thing" : " things") + " in a Sealed box");
        }
        if (parts.isEmpty()) return "Deleting this account cannot be undone.";
        return "Deleting this account also deletes " + plainList(parts)
                + ". None of it can be brought back.";
    }

    /** "a", "a and b", "a, b and c" — the way a person would say it out loud. */
    private String plainList(List<String> parts) {
        if (parts.size() == 1) return parts.get(0);
        return String.join(", ", parts.subList(0, parts.size() - 1))
                + " and " + parts.get(parts.size() - 1);
    }

    private String photoUrlFor(UUID userId) {
        ElderProfile elder = elderProfileRepository.findByUserId(userId).orElse(null);
        if (elder != null && elder.getPhotoUrl() != null) return elder.getPhotoUrl();
        HelperProfile helper = helperProfileRepository.findByUserId(userId).orElse(null);
        if (helper != null) return helper.getPhotoUrl();
        return null;
    }

    private Map<String, Object> elderProfile(ElderProfile p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", p.getName());
        m.put("age", p.getAge());
        m.put("bio", p.getBio());
        m.put("interests", p.getInterests());
        m.put("languages", p.getLanguages());
        m.put("occupation", p.getOccupation());
        m.put("gender", p.getGender() != null ? p.getGender().name() : null);
        m.put("facebookUrl", p.getFacebookUrl());
        m.put("instagramUrl", p.getInstagramUrl());
        m.put("createdAt", p.getCreatedAt());
        return m;
    }

    private Map<String, Object> helperProfile(HelperProfile p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", p.getName());
        m.put("age", p.getAge());
        m.put("bio", p.getBio());
        m.put("skillsOffered", p.getSkillsOffered());
        m.put("languages", p.getLanguages());
        m.put("availabilityDays", p.getAvailabilityDays());
        m.put("availabilityTimes", p.getAvailabilityTimes());
        m.put("hobbies", p.getHobbies());
        m.put("occupation", p.getOccupation());
        m.put("gender", p.getGender() != null ? p.getGender().name() : null);
        m.put("facebookUrl", p.getFacebookUrl());
        m.put("instagramUrl", p.getInstagramUrl());
        m.put("createdAt", p.getCreatedAt());
        return m;
    }

    private Map<String, Object> needSummary(Need n) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("title", n.getTitle());
        m.put("category", n.getCategory() != null ? n.getCategory().name() : null);
        m.put("description", n.getDescription());
        m.put("status", n.getStatus() != null ? n.getStatus().name() : null);
        m.put("createdAt", n.getCreatedAt());
        return m;
    }

    private Map<String, Object> reviewSummary(Review r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("rating", r.getRating());
        m.put("tags", r.getTags());
        m.put("comment", r.getComment());
        m.put("createdAt", r.getCreatedAt());
        return m;
    }

    private Map<String, Object> contactSummary(EmergencyContact c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", c.getName());
        m.put("phone", c.getPhone());
        m.put("relationship", c.getRelationship());
        return m;
    }

    private Map<String, Object> familyLinkSummary(FamilyLink l) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", l.getId());
        m.put("elderId", l.getElder() != null ? l.getElder().getId() : null);
        m.put("familyUserId", l.getFamilyUser() != null ? l.getFamilyUser().getId() : null);
        m.put("initiatedById", l.getInitiatedBy() != null ? l.getInitiatedBy().getId() : null);
        m.put("relationship", l.getRelationship());
        m.put("status", l.getStatus() != null ? l.getStatus().name() : null);
        m.put("isPrimary", l.getIsPrimary());
        m.put("createdAt", l.getCreatedAt());
        m.put("respondedAt", l.getRespondedAt());
        m.put("revokedAt", l.getRevokedAt());
        return m;
    }

    private Map<String, Object> familyAlertSummary(FamilyAlert a) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("type", a.getType());
        m.put("body", a.getBody());
        m.put("createdAt", a.getCreatedAt());
        return m;
    }

    /** Her own stories and letters, in full — they are her words and nobody else's. */
    private Map<String, Object> passOnItemSummary(PassOnItem i) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", i.getId());
        m.put("kind", i.getKind() != null ? i.getKind().name() : null);
        m.put("title", i.getTitle());
        m.put("body", i.getBody());
        m.put("photoUrl", i.getPhotoUrl());
        m.put("audience", i.getAudience() != null ? i.getAudience().name() : null);
        m.put("audienceUserId", i.getAudienceUser() != null ? i.getAudienceUser().getId() : null);
        m.put("releaseWhen", i.getReleaseWhen() != null ? i.getReleaseWhen().name() : null);
        m.put("firstReadAt", i.getFirstReadAt());
        m.put("createdAt", i.getCreatedAt());
        m.put("updatedAt", i.getUpdatedAt());
        return m;
    }

    /**
     * Metadata only. No label, no body, and no ciphertext for either — the label is encrypted
     * precisely because a readable "Where the cash is hidden" attached to a named elderly
     * person at a known address is a burglary list, and decrypting it here would put it back.
     * What is left is what an owner can already see without her password: what sort of thing
     * it is, how big it is, and when she put it there.
     */
    private Map<String, Object> sealedItemSummary(SealedItem s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", s.getId());
        m.put("kind", s.getKindHint() != null ? s.getKindHint().name() : null);
        m.put("byteSize", s.getByteSize());
        m.put("sortOrder", s.getSortOrder());
        m.put("createdAt", s.getCreatedAt());
        m.put("updatedAt", s.getUpdatedAt());
        return m;
    }

    private Map<String, Object> keyholderSummary(Keyholder k) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", k.getId());
        m.put("ownerId", k.getOwner() != null ? k.getOwner().getId() : null);
        m.put("keyholderId", k.getKeyholder() != null ? k.getKeyholder().getId() : null);
        m.put("status", k.getStatus() != null ? k.getStatus().name() : null);
        m.put("invitedAt", k.getInvitedAt());
        m.put("respondedAt", k.getRespondedAt());
        return m;
    }

    /**
     * The ack hashes go out with the rest. They are a digest of the exact wording she was
     * shown, kept so that a later argument about "this is not a will" can be settled by
     * something better than a bare timestamp — which makes them evidence about her, and hers
     * to have.
     */
    private Map<String, Object> sealedSettingsSummary(PassOnSettings s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("approvalsNeeded", s.getApprovalsNeeded());
        m.put("keyholderTarget", s.getKeyholderTarget());
        m.put("armedAt", s.getArmedAt());
        m.put("coolingOffUntil", s.getCoolingOffUntil());
        m.put("notAWillAckAt", s.getNotAWillAckAt());
        m.put("notAWillAckHash", s.getNotAWillAckHash());
        m.put("keyTruthAckAt", s.getKeyTruthAckAt());
        m.put("keyTruthAckHash", s.getKeyTruthAckHash());
        m.put("sheetSavedAt", s.getSheetSavedAt());
        m.put("createdAt", s.getCreatedAt());
        m.put("updatedAt", s.getUpdatedAt());
        return m;
    }

    private Map<String, Object> passOnOpenSummary(PassOnOpen o) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("kind", o.getKind() != null ? o.getKind().name() : null);
        m.put("at", o.getAt());
        m.put("actorLabel", o.getActorLabel());
        m.put("note", o.getNote());
        m.put("sealedItemId", o.getSealedItemId());
        return m;
    }

    private Map<String, Object> connectionSummary(Connection c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", c.getId());
        m.put("status", c.getStatus() != null ? c.getStatus().name() : null);
        m.put("trustLevel", c.getCurrentTrustLevel() != null ? c.getCurrentTrustLevel().name() : null);
        m.put("createdAt", c.getCreatedAt());
        return m;
    }
}
