package com.towinly.passon.service;

import com.towinly.common.entity.User;
import com.towinly.common.enums.PassOnOpenKind;
import com.towinly.common.enums.SealedKind;
import com.towinly.common.exception.RateLimitException;
import com.towinly.common.repository.UserRepository;
import com.towinly.passon.dto.SealedItemRequest;
import com.towinly.passon.dto.SealedItemSummary;
import com.towinly.passon.dto.SealedRevealResponse;
import com.towinly.passon.entity.PassOnOpen;
import com.towinly.passon.entity.PassOnSettings;
import com.towinly.passon.entity.SealedItem;
import com.towinly.passon.exception.SealedBoxUnavailableException;
import com.towinly.passon.repository.PassOnOpenRepository;
import com.towinly.passon.repository.PassOnSettingsRepository;
import com.towinly.passon.repository.SealedItemRepository;
import com.towinly.passon.security.SealedRevealRateLimiter;
import com.towinly.passon.service.SealedCryptoService.OpenContents;
import com.towinly.passon.service.SealedCryptoService.SealedContents;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The Sealed box is the one place in Towinly where a single wrong decision discloses
 * somebody's bank details, and the disclosure cannot be taken back. Three rules carry that
 * weight and all three are tested here.
 *
 * <p><b>The password gate.</b> Nothing opens without the account password being re-typed.
 * Being signed in is not enough: a phone left unlocked on a kitchen table is the ordinary
 * case, not the exotic one.
 *
 * <p><b>The freeze.</b> Whoever reads Margaret's email can reset her password, and would
 * otherwise be three taps from the whole box. So no reveal is allowed for seven days after
 * any credential change — long enough for the real owner to see the "your password was
 * changed" mail and raise the alarm. This is the most realistic attack in the feature and
 * the freeze is its only real defence, so it is tested on both sides of the boundary.
 *
 * <p><b>Listing never decrypts a body.</b> The elder's own list, and the account export that
 * will reuse it, show names and nothing else. The body is decrypted on exactly one path —
 * {@link SealedBoxService#reveal} — and that path is the one behind the password.
 *
 * <p>Time is injected. The freeze and the cooling-off are date arithmetic on an
 * irreversible disclosure rule, and a rule that can only be tested by waiting a week is a
 * rule that ships untested.
 */
@ExtendWith(MockitoExtension.class)
class SealedBoxServiceTest {

    /** 5 August 2026, ten in the morning. Seven days later is 12 August — the spec's own example. */
    private static final Instant TODAY = Instant.parse("2026-08-05T10:00:00Z");
    private static final String PASSWORD = "the-elders-own-password";
    private static final String HASH = "$2a$10$notarealbcrypthashbutlongenough";

    private static final String LABEL = "Where the house papers are";
    private static final String BODY = "In the brown envelope, second drawer of the writing desk.";

    @Mock SealedItemRepository sealedItems;
    @Mock PassOnSettingsRepository settings;
    @Mock PassOnOpenRepository opens;
    @Mock UserRepository users;
    @Mock SealedCryptoService crypto;
    @Mock PasswordEncoder passwordEncoder;

    private Clock clock;
    private SealedRevealRateLimiter revealLimiter;
    private SealedBoxService service;

    private User margaret;
    private SealedItem item;

    @BeforeEach
    void setUp() {
        clock = Clock.fixed(TODAY, ZoneOffset.UTC);
        revealLimiter = new SealedRevealRateLimiter(clock);
        service = new SealedBoxService(sealedItems, settings, opens, users, crypto,
                passwordEncoder, revealLimiter, clock);

        margaret = User.builder()
                .id(UUID.randomUUID())
                .fullName("Margaret")
                .username("margaret")
                .passwordHash(HASH)
                .build();
        item = sealedRow(margaret);

        lenient().when(users.findById(margaret.getId())).thenReturn(Optional.of(margaret));
        lenient().when(sealedItems.findByIdAndOwnerId(item.getId(), margaret.getId()))
                .thenReturn(Optional.of(item));
        lenient().when(crypto.isAvailable()).thenReturn(true);
    }

    // ── the password gate ──

    @Test
    void revealRequiresTheCorrectPassword() {
        when(passwordEncoder.matches("guess", HASH)).thenReturn(false);

        assertThatThrownBy(() -> service.reveal(margaret.getId(), item.getId(), "guess"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage(SealedBoxService.WRONG_PASSWORD);

        // Nothing was opened, and nothing was written down as an opening.
        verify(crypto, never()).open(any(), any(), any());
        verify(opens, never()).save(any());
    }

    @Test
    void revealWithTheRightPasswordOpensItAndWritesItDown() {
        when(passwordEncoder.matches(PASSWORD, HASH)).thenReturn(true);
        when(crypto.open(any(), any(), any())).thenReturn(new OpenContents(LABEL, BODY));

        SealedRevealResponse revealed = service.reveal(margaret.getId(), item.getId(), PASSWORD);

        assertThat(revealed.label()).isEqualTo(LABEL);
        assertThat(revealed.body()).isEqualTo(BODY);
        assertThat(revealed.kindHint()).isEqualTo(SealedKind.PAPERS);

        ArgumentCaptor<PassOnOpen> written = ArgumentCaptor.forClass(PassOnOpen.class);
        verify(opens).save(written.capture());
        assertThat(written.getValue().getKind()).isEqualTo(PassOnOpenKind.OPENED_BY_OWNER);
        assertThat(written.getValue().getOwnerId()).isEqualTo(margaret.getId());
        assertThat(written.getValue().getSealedItemId()).isEqualTo(item.getId());
        assertThat(written.getValue().getActorLabel()).isEqualTo("Margaret");
        // The record says an item was opened. It never says which one it was, in words.
        assertThat(written.getValue().getNote()).doesNotContain("papers").doesNotContain("drawer");
    }

    @Test
    void googleOnlyAccountsCannotRevealEither() {
        margaret.setPasswordHash(null);

        assertThatThrownBy(() -> service.reveal(margaret.getId(), item.getId(), PASSWORD))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage(SealedBoxService.NEEDS_A_PASSWORD);

        verify(crypto, never()).open(any(), any(), any());
    }

    @Test
    void somebodyElsesItemIsAPlainNotFound() {
        UUID stranger = UUID.randomUUID();
        when(users.findById(stranger)).thenReturn(Optional.of(User.builder()
                .id(stranger).fullName("A stranger").username("stranger").passwordHash(HASH).build()));
        when(passwordEncoder.matches(PASSWORD, HASH)).thenReturn(true);
        when(sealedItems.findByIdAndOwnerId(item.getId(), stranger)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.reveal(stranger, item.getId(), PASSWORD))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage(SealedBoxService.NOT_FOUND);

        verify(crypto, never()).open(any(), any(), any());
    }

    @Test
    void tooManyWrongPasswordsLocksTheBoxForAWhile() {
        when(passwordEncoder.matches("guess", HASH)).thenReturn(false);

        for (int attempt = 0; attempt < 5; attempt++) {
            assertThatThrownBy(() -> service.reveal(margaret.getId(), item.getId(), "guess"))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        // The sixth try is refused before the password is even looked at.
        assertThatThrownBy(() -> service.reveal(margaret.getId(), item.getId(), PASSWORD))
                .isInstanceOf(RateLimitException.class)
                .hasMessage(SealedRevealRateLimiter.TOO_MANY_TRIES);
        verify(crypto, never()).open(any(), any(), any());
    }

    // ── the freeze ──

    @Test
    void revealIsRefusedForSevenDaysAfterATokenVersionBump() {
        // She reset her password an hour ago — or somebody holding her inbox did.
        margaret.setCredentialChangedAt(LocalDateTime.ofInstant(TODAY, ZoneOffset.UTC).minusHours(1));

        assertThatThrownBy(() -> service.reveal(margaret.getId(), item.getId(), PASSWORD))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("You changed your password recently. For your safety your Sealed box "
                        + "stays shut until 12 August. If that was not you, tell us straight away.");

        // The password is never even checked during a freeze: there is nothing to gain by
        // getting it right, so there is nothing to be learned by trying.
        verify(passwordEncoder, never()).matches(any(), any());
        verify(crypto, never()).open(any(), any(), any());
    }

    @Test
    void revealIsAllowedOnTheEighthDay() {
        margaret.setCredentialChangedAt(LocalDateTime.ofInstant(TODAY, ZoneOffset.UTC).minusDays(7));
        when(passwordEncoder.matches(PASSWORD, HASH)).thenReturn(true);
        when(crypto.open(any(), any(), any())).thenReturn(new OpenContents(LABEL, BODY));

        SealedRevealResponse revealed = service.reveal(margaret.getId(), item.getId(), PASSWORD);

        assertThat(revealed.body()).isEqualTo(BODY);
    }

    @Test
    void theScreenCanAskWhenTheFreezeLifts() {
        assertThat(service.revealFrozenUntil(margaret.getId())).isNull();

        margaret.setCredentialChangedAt(LocalDateTime.of(2026, 8, 5, 9, 0));
        assertThat(service.revealFrozenUntil(margaret.getId()))
                .isEqualTo(LocalDateTime.of(2026, 8, 12, 9, 0));
    }

    // ── arming ──

    @Test
    void googleOnlyAccountsCannotArmABox() {
        margaret.setPasswordHash(null);

        assertThatThrownBy(() -> service.arm(margaret.getId(), 2, 3))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage(SealedBoxService.NEEDS_A_PASSWORD);

        verify(settings, never()).save(any());
    }

    @Test
    void armingStartsTheSevenDaysInWhichSheCanUndoIt() {
        when(settings.findById(margaret.getId())).thenReturn(Optional.empty());
        when(settings.save(any())).thenAnswer(call -> call.getArgument(0));

        service.arm(margaret.getId(), 2, 3);

        ArgumentCaptor<PassOnSettings> saved = ArgumentCaptor.forClass(PassOnSettings.class);
        verify(settings).save(saved.capture());
        assertThat(saved.getValue().getApprovalsNeeded()).isEqualTo((short) 2);
        assertThat(saved.getValue().getKeyholderTarget()).isEqualTo((short) 3);
        assertThat(saved.getValue().getArmedAt()).isEqualTo(LocalDateTime.of(2026, 8, 5, 10, 0));
        assertThat(saved.getValue().getCoolingOffUntil()).isEqualTo(LocalDateTime.of(2026, 8, 12, 10, 0));
    }

    @Test
    void aBoxIsNeverArmedWhileTheKeyIsUnavailable() {
        when(crypto.isAvailable()).thenReturn(false);

        assertThatThrownBy(() -> service.arm(margaret.getId(), 2, 3))
                .isInstanceOf(SealedBoxUnavailableException.class);

        verify(settings, never()).save(any());
    }

    // ── writing one in, taking one out ──

    @Test
    void addingAnItemSealsItBeforeItIsEverSaved() {
        when(crypto.seal(any(), any(), any(), any())).thenReturn(sealedContents());
        when(sealedItems.save(any())).thenAnswer(call -> call.getArgument(0));

        SealedItemRequest request = new SealedItemRequest();
        request.setLabel(LABEL);
        request.setBody(BODY);
        request.setKindHint(SealedKind.PAPERS);

        SealedItemSummary added = service.add(margaret.getId(), request);

        assertThat(added.label()).isEqualTo(LABEL);
        assertThat(added.kindHint()).isEqualTo(SealedKind.PAPERS);

        ArgumentCaptor<SealedItem> saved = ArgumentCaptor.forClass(SealedItem.class);
        verify(sealedItems).save(saved.capture());
        // Not one readable word of either the name or the contents reaches the row.
        assertThat(new String(saved.getValue().getLabelCipher(), StandardCharsets.UTF_8))
                .doesNotContain("papers");
        assertThat(new String(saved.getValue().getBodyCipher(), StandardCharsets.UTF_8))
                .doesNotContain("drawer");
    }

    @Test
    void deletingAnItemLeavesTheRecordThatItExisted() {
        service.delete(margaret.getId(), item.getId());

        verify(sealedItems).delete(item);
        ArgumentCaptor<PassOnOpen> written = ArgumentCaptor.forClass(PassOnOpen.class);
        verify(opens).save(written.capture());
        assertThat(written.getValue().getKind()).isEqualTo(PassOnOpenKind.DELETED);
    }

    // ── listing, and the export that reuses it ──

    @Test
    void exportNeverDecryptsSealedBodies() {
        when(sealedItems.findByOwnerIdOrderBySortOrderAscCreatedAtAsc(margaret.getId()))
                .thenReturn(List.of(item));
        when(crypto.openLabel(any(), any(), any())).thenReturn(LABEL);

        List<SealedItemSummary> listed = service.list(margaret.getId());

        assertThat(listed).singleElement().satisfies(summary -> {
            assertThat(summary.label()).isEqualTo(LABEL);
            assertThat(summary.kindHint()).isEqualTo(SealedKind.PAPERS);
            assertThat(summary.byteSize()).isEqualTo(BODY.length());
        });

        // The whole point. A body is decrypted on exactly one path in this service, and it
        // is the one behind the password — never on a list, and never on an export.
        verify(crypto, never()).open(any(), any(), any());

        // It asked for the label of this row, bound to this owner and this item — the
        // binding that stops one elder's blob being read under another elder's name.
        ArgumentCaptor<SealedContents> asked = ArgumentCaptor.forClass(SealedContents.class);
        verify(crypto).openLabel(eq(margaret.getId()), eq(item.getId()), asked.capture());
        assertThat(asked.getValue().labelCipher()).isEqualTo(item.getLabelCipher());
        assertThat(asked.getValue().keyVersion()).isEqualTo(item.getKeyVersion());

        // And the summary has nowhere to put a body even if somebody tried.
        assertThat(listed.get(0).toString()).doesNotContain("drawer");
    }

    // ── fixtures ──

    private SealedItem sealedRow(User owner) {
        SealedContents sealed = sealedContents();
        return SealedItem.builder()
                .id(UUID.randomUUID())
                .owner(owner)
                .labelCipher(sealed.labelCipher())
                .labelIv(sealed.labelIv())
                .kindHint(SealedKind.PAPERS)
                .bodyCipher(sealed.bodyCipher())
                .bodyIv(sealed.bodyIv())
                .wrappedKey(sealed.wrappedKey())
                .keyVersion(sealed.keyVersion())
                .byteSize(sealed.byteSize())
                .sortOrder(0)
                .build();
    }

    /** Stand-in ciphertext: the crypto itself has its own tests, so here it only has to be opaque. */
    private static SealedContents sealedContents() {
        return new SealedContents(
                "label-ciphertext".getBytes(StandardCharsets.UTF_8),
                "label-nonce-".getBytes(StandardCharsets.UTF_8),
                "body-ciphertext".getBytes(StandardCharsets.UTF_8),
                "body-nonce--".getBytes(StandardCharsets.UTF_8),
                "wrapped-key".getBytes(StandardCharsets.UTF_8),
                SealedCryptoService.CURRENT_KEY_VERSION,
                BODY.length());
    }
}
