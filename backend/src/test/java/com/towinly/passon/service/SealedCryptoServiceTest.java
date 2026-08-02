package com.towinly.passon.service;

import com.towinly.common.dto.ErrorResponse;
import com.towinly.common.exception.GlobalExceptionHandler;
import com.towinly.passon.exception.SealedBoxUnavailableException;
import com.towinly.passon.exception.SealedItemUnreadableException;
import com.towinly.passon.service.SealedCryptoService.SealedContents;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The Sealed box is the only place in Towinly where losing the ciphertext means losing
 * somebody's last words, and the only place where a database leak would otherwise hand a
 * burglar a shopping list. These tests are the whole guarantee.
 *
 * The two transplant tests are the ones that matter. GCM's tag alone proves a blob was not
 * edited; it does not stop an attacker with database write access from moving one elder's
 * blob onto another elder's row, or one row's blob onto another row of the same elder.
 * Binding owner id, item id and key version as additional authenticated data does.
 */
class SealedCryptoServiceTest {

    // Test-only key, never used in production and safe to be public — same footing as the
    // test JWT secret in src/test/resources/application.properties. Exactly 32 bytes.
    private static final String TEST_MASTER_KEY = Base64.getEncoder()
            .encodeToString("test-only-sealed-box-key-32bytes".getBytes(StandardCharsets.UTF_8));

    private static final String LABEL = "Where the house papers are";
    private static final String BODY = "In the brown envelope, second drawer of the writing desk.";

    private final SealedCryptoService crypto = new SealedCryptoService(TEST_MASTER_KEY);

    @Test
    void encryptThenDecryptReturnsThePlaintext() {
        UUID ownerId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();

        SealedContents sealed = crypto.seal(ownerId, itemId, LABEL, BODY);

        // Nothing readable may sit in the row. Not even the label.
        assertThat(new String(sealed.labelCipher(), StandardCharsets.UTF_8)).doesNotContain("papers");
        assertThat(new String(sealed.bodyCipher(), StandardCharsets.UTF_8)).doesNotContain("drawer");

        var opened = crypto.open(ownerId, itemId, sealed);

        assertThat(opened.label()).isEqualTo(LABEL);
        assertThat(opened.body()).isEqualTo(BODY);
    }

    @Test
    void everyEncryptionUsesAFreshNonce() {
        UUID ownerId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();

        SealedContents first = crypto.seal(ownerId, itemId, LABEL, BODY);
        SealedContents second = crypto.seal(ownerId, itemId, LABEL, BODY);

        // Same owner, same item, same words — and still nothing repeats. A reused nonce
        // under the same key is the one mistake that breaks AES-GCM outright.
        assertThat(first.bodyIv()).isNotEqualTo(second.bodyIv());
        assertThat(first.labelIv()).isNotEqualTo(second.labelIv());
        assertThat(first.bodyIv()).isNotEqualTo(first.labelIv());
        assertThat(first.bodyCipher()).isNotEqualTo(second.bodyCipher());
        assertThat(first.wrappedKey()).isNotEqualTo(second.wrappedKey());
    }

    @Test
    void aBlobFromAnotherOwnerFailsToDecrypt() {
        UUID margaret = UUID.randomUUID();
        UUID thief = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();

        SealedContents margaretsItem = crypto.seal(margaret, itemId, LABEL, BODY);

        // Someone with write access to Postgres moves Margaret's row under their own
        // account. The additional authenticated data binds her id, so it stays shut.
        assertThatThrownBy(() -> crypto.open(thief, itemId, margaretsItem))
                .isInstanceOf(SealedItemUnreadableException.class);
    }

    @Test
    void aBlobFromAnotherItemFailsToDecrypt() {
        UUID ownerId = UUID.randomUUID();
        UUID realItem = UUID.randomUUID();
        UUID otherItem = UUID.randomUUID();

        SealedContents sealed = crypto.seal(ownerId, realItem, LABEL, BODY);

        // Same owner, different row: the blob cannot be shuffled between their own items
        // either, so a tampered row can never quietly answer for a different one.
        assertThatThrownBy(() -> crypto.open(ownerId, otherItem, sealed))
                .isInstanceOf(SealedItemUnreadableException.class);
    }

    @Test
    void aTamperedCipherFailsToDecrypt() {
        UUID ownerId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();

        SealedContents sealed = crypto.seal(ownerId, itemId, LABEL, BODY);
        byte[] edited = sealed.bodyCipher().clone();
        edited[0] ^= 0x01;
        SealedContents tampered = new SealedContents(sealed.labelCipher(), sealed.labelIv(),
                edited, sealed.bodyIv(), sealed.wrappedKey(), sealed.keyVersion(), sealed.byteSize());

        assertThatThrownBy(() -> crypto.open(ownerId, itemId, tampered))
                .isInstanceOf(SealedItemUnreadableException.class);
    }

    @Test
    void theStartupSelfCheckArmsTheBoxWhenTheKeyIsGood() {
        assertThat(crypto.isAvailable()).isTrue();
    }

    @Test
    void aMissingMasterKeyLeavesTheBoxUnavailableRatherThanWritingUnreadableRows() {
        SealedCryptoService withoutKey = new SealedCryptoService("");

        assertThat(withoutKey.isAvailable()).isFalse();
        assertThatThrownBy(() -> withoutKey.seal(UUID.randomUUID(), UUID.randomUUID(), LABEL, BODY))
                .isInstanceOf(SealedBoxUnavailableException.class)
                .hasMessage("The Sealed box is temporarily unavailable");
    }

    @Test
    void aWrongLengthMasterKeyLeavesTheBoxUnavailable() {
        String tooShort = Base64.getEncoder().encodeToString("only-sixteen-byte".getBytes(StandardCharsets.UTF_8));

        assertThat(new SealedCryptoService(tooShort).isAvailable()).isFalse();
        assertThat(new SealedCryptoService("not base64 at all !!").isAvailable()).isFalse();
    }

    @Test
    void anUnknownKeyVersionRefusesInsteadOfGuessing() {
        UUID ownerId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();

        SealedContents sealed = crypto.seal(ownerId, itemId, LABEL, BODY);
        SealedContents fromAFutureKey = new SealedContents(sealed.labelCipher(), sealed.labelIv(),
                sealed.bodyCipher(), sealed.bodyIv(), sealed.wrappedKey(), (short) 99, sealed.byteSize());

        assertThatThrownBy(() -> crypto.open(ownerId, itemId, fromAFutureKey))
                .isInstanceOf(SealedBoxUnavailableException.class)
                .hasMessage("The Sealed box is temporarily unavailable");
    }

    @Test
    void theUnavailableMessageReachesTheClientUnchanged() {
        ResponseEntity<ErrorResponse> response = new GlobalExceptionHandler()
                .handleSealedBoxUnavailable(new SealedBoxUnavailableException("The Sealed box is temporarily unavailable"));

        assertThat(response.getStatusCode().value()).isEqualTo(503);
        assertThat(response.getBody().getMessage()).isEqualTo("The Sealed box is temporarily unavailable");
    }

    @Test
    void theStoredSizeIsThePlaintextSizeSoTheListNeedsNoDecrypt() {
        SealedContents sealed = crypto.seal(UUID.randomUUID(), UUID.randomUUID(), LABEL, BODY);

        assertThat(sealed.byteSize()).isEqualTo(BODY.getBytes(StandardCharsets.UTF_8).length);
    }
}
