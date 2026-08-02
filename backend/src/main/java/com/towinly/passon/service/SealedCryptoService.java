package com.towinly.passon.service;

import com.towinly.passon.exception.SealedBoxUnavailableException;
import com.towinly.passon.exception.SealedItemUnreadableException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;
import java.util.UUID;

/**
 * The only class in Towinly that touches the Sealed box master key. Nothing else may read
 * it, log it, return it, or hold a copy of it.
 *
 * <h2>What is guaranteed, and what is not</h2>
 * Envelope encryption, server-side. Every sealed item gets its own fresh 256-bit data key;
 * the label and the body are encrypted under it with AES-256-GCM and a fresh 12-byte nonce
 * each; the data key is then wrapped under the master key and stored beside them. The
 * master key lives only as the {@code SEALED_BOX_MASTER_KEY} environment variable.
 *
 * This protects against a stolen database. It does not protect against someone holding both
 * the database and the master key — which is us. That trade is deliberate and is stated in
 * the product copy, because the alternative (a key only the elder holds) guarantees boxes
 * that cannot be opened on the one day they exist for.
 *
 * <h2>Why the additional authenticated data matters more than the algorithm</h2>
 * A GCM tag proves a blob was not edited. It does not stop somebody with write access to
 * Postgres from moving one elder's ciphertext onto another elder's row, or shuffling a blob
 * between two rows of the same elder — the tag still verifies, and the wrong person reads
 * the wrong secret. Binding {@code owner_id || item_id || key_version} as additional
 * authenticated data, on the wrap and on both contents, is what closes that. Every decrypt
 * is therefore also an assertion that this ciphertext belongs on this row.
 *
 * <h2>Failing shut</h2>
 * A startup self-check round-trips a known constant. If the key is missing, malformed, or
 * fails that round-trip, {@link #isAvailable()} is false and {@link #seal} refuses: writing
 * rows nobody can ever decrypt is far worse than being unavailable for an afternoon.
 */
@Slf4j
@Service
public class SealedCryptoService {

    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final String ALGORITHM = "AES";
    private static final int GCM_TAG_BITS = 128;
    private static final int NONCE_BYTES = 12;
    private static final int DATA_KEY_BITS = 256;
    private static final int MASTER_KEY_BYTES = 32;

    /**
     * The key version stamped on everything written today. A future rotation adds a second
     * master key and re-wraps rows in the background; the column exists so that can happen
     * without re-encrypting a single body.
     */
    public static final short CURRENT_KEY_VERSION = 1;

    private static final String SELF_CHECK_CONSTANT = "sealed-box-self-check";

    private final SecureRandom random = new SecureRandom();
    private final byte[] masterKey;
    private final boolean available;

    public SealedCryptoService(@Value("${passon.sealed.master-key:}") String masterKeyBase64) {
        this.masterKey = decodeMasterKey(masterKeyBase64);
        this.available = masterKey != null && selfCheckPasses();
        if (available) {
            log.info("Sealed box armed: master key loaded and the startup self-check round-tripped.");
        } else {
            log.warn("Sealed box is OFF. Set SEALED_BOX_MASTER_KEY to a base64 32-byte key. "
                    + "Until then the sealed endpoints refuse rather than write unreadable rows.");
        }
    }

    /** Everything the caller must store for one sealed item, and nothing it must not. */
    public record SealedContents(byte[] labelCipher, byte[] labelIv,
                                 byte[] bodyCipher, byte[] bodyIv,
                                 byte[] wrappedKey, short keyVersion, int byteSize) {

        // Copy on the way in so no caller keeps a live handle on our arrays, and so a
        // later edit to their copy cannot change what we are about to write.
        public SealedContents {
            labelCipher = labelCipher.clone();
            labelIv = labelIv.clone();
            bodyCipher = bodyCipher.clone();
            bodyIv = bodyIv.clone();
            wrappedKey = wrappedKey.clone();
        }
    }

    /** What one sealed item actually says, once opened. Never logged, never cached. */
    public record OpenContents(String label, String body) {}

    /** True when the master key loaded and the startup self-check round-tripped. */
    public boolean isAvailable() {
        return available;
    }

    /**
     * Encrypts one item's label and body under a data key made only for this item.
     *
     * @param ownerId the elder the item belongs to — bound into the ciphertext
     * @param itemId  the row it will be stored on — bound into the ciphertext, so it must
     *                be decided before sealing, not left to the database
     */
    public SealedContents seal(UUID ownerId, UUID itemId, String label, String body) {
        requireAvailable();

        byte[] dataKey = new byte[DATA_KEY_BITS / 8];
        try {
            KeyGenerator generator = KeyGenerator.getInstance(ALGORITHM);
            generator.init(DATA_KEY_BITS, random);
            dataKey = generator.generateKey().getEncoded();

            byte[] aad = additionalData(ownerId, itemId, CURRENT_KEY_VERSION);
            byte[] labelIv = freshNonce();
            byte[] bodyIv = freshNonce();
            byte[] wrapIv = freshNonce();
            byte[] plainBody = body.getBytes(StandardCharsets.UTF_8);

            byte[] labelCipher = encrypt(dataKey, labelIv, aad, label.getBytes(StandardCharsets.UTF_8));
            byte[] bodyCipher = encrypt(dataKey, bodyIv, aad, plainBody);
            // No column exists for the wrap's nonce, so it rides in front of the wrapped
            // key. A nonce is not secret; only its freshness matters.
            byte[] wrapped = concat(wrapIv, encrypt(masterKey, wrapIv, aad, dataKey));

            return new SealedContents(labelCipher, labelIv, bodyCipher, bodyIv, wrapped,
                    CURRENT_KEY_VERSION, plainBody.length);
        } catch (GeneralSecurityException e) {
            // Never let the exception text out: it can carry key material lengths and
            // provider internals. The elder gets the plain unavailable line.
            log.error("Sealing a box item failed", e);
            throw new SealedBoxUnavailableException(SealedBoxUnavailableException.MESSAGE);
        } finally {
            Arrays.fill(dataKey, (byte) 0);
        }
    }

    /**
     * Opens one item. Throws {@link SealedItemUnreadableException} when the ciphertext does
     * not belong on this owner and item — that is the transplant defence doing its job, so
     * it is logged as a security event rather than swallowed.
     */
    public OpenContents open(UUID ownerId, UUID itemId, SealedContents stored) {
        return unwrapAndRead(ownerId, itemId, stored, true);
    }

    /**
     * Opens the name of one item and deliberately not its contents.
     *
     * The owner's own list shows what is in the box by name, and so will the account export;
     * neither has any business decrypting a bank account number to render a card that says
     * "Locked". Splitting the read here rather than opening both and dropping one is what
     * makes that structural: on the list path the body's plaintext is never produced at all,
     * so it cannot be logged, cached, serialised or caught in a heap dump by accident.
     */
    public String openLabel(UUID ownerId, UUID itemId, SealedContents stored) {
        return unwrapAndRead(ownerId, itemId, stored, false).label();
    }

    /**
     * The single unwrap path behind both reads. The data key exists for the length of one
     * call and is wiped in the {@code finally} whichever way the call ends.
     */
    private OpenContents unwrapAndRead(UUID ownerId, UUID itemId, SealedContents stored, boolean withBody) {
        requireAvailable();
        if (stored.keyVersion() != CURRENT_KEY_VERSION) {
            log.error("Sealed item for owner {} was wrapped by key version {}, which this build does not hold.",
                    ownerId, stored.keyVersion());
            throw new SealedBoxUnavailableException(SealedBoxUnavailableException.MESSAGE);
        }

        byte[] aad = additionalData(ownerId, itemId, stored.keyVersion());
        byte[] wrapped = stored.wrappedKey();
        if (wrapped.length <= NONCE_BYTES) {
            log.error("Sealed item for owner {} has a truncated wrapped key.", ownerId);
            throw new SealedItemUnreadableException(SealedItemUnreadableException.MESSAGE);
        }

        byte[] dataKey = null;
        try {
            byte[] wrapIv = Arrays.copyOf(wrapped, NONCE_BYTES);
            dataKey = decrypt(masterKey, wrapIv, aad, Arrays.copyOfRange(wrapped, NONCE_BYTES, wrapped.length));

            String label = new String(decrypt(dataKey, stored.labelIv(), aad, stored.labelCipher()),
                    StandardCharsets.UTF_8);
            String body = withBody
                    ? new String(decrypt(dataKey, stored.bodyIv(), aad, stored.bodyCipher()),
                            StandardCharsets.UTF_8)
                    : null;
            return new OpenContents(label, body);
        } catch (GeneralSecurityException e) {
            // A failed tag here means the row was edited or moved. Log it loudly; the row
            // number and owner are enough to investigate without printing any ciphertext.
            log.error("Sealed item {} for owner {} failed to authenticate — the row was edited or moved.",
                    itemId, ownerId);
            throw new SealedItemUnreadableException(SealedItemUnreadableException.MESSAGE);
        } finally {
            if (dataKey != null) {
                Arrays.fill(dataKey, (byte) 0);
            }
        }
    }

    private void requireAvailable() {
        if (!available) {
            throw new SealedBoxUnavailableException(SealedBoxUnavailableException.MESSAGE);
        }
    }

    /**
     * Binds the row's identity into the ciphertext. Fixed-width and ordered, so no two
     * different rows can ever produce the same bytes.
     */
    private static byte[] additionalData(UUID ownerId, UUID itemId, short keyVersion) {
        return ByteBuffer.allocate(Long.BYTES * 4 + Short.BYTES)
                .putLong(ownerId.getMostSignificantBits())
                .putLong(ownerId.getLeastSignificantBits())
                .putLong(itemId.getMostSignificantBits())
                .putLong(itemId.getLeastSignificantBits())
                .putShort(keyVersion)
                .array();
    }

    private byte[] freshNonce() {
        byte[] nonce = new byte[NONCE_BYTES];
        random.nextBytes(nonce);
        return nonce;
    }

    private static byte[] encrypt(byte[] key, byte[] nonce, byte[] aad, byte[] plaintext)
            throws GeneralSecurityException {
        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, ALGORITHM),
                new GCMParameterSpec(GCM_TAG_BITS, nonce));
        cipher.updateAAD(aad);
        return cipher.doFinal(plaintext);
    }

    private static byte[] decrypt(byte[] key, byte[] nonce, byte[] aad, byte[] ciphertext)
            throws GeneralSecurityException {
        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, ALGORITHM),
                new GCMParameterSpec(GCM_TAG_BITS, nonce));
        cipher.updateAAD(aad);
        return cipher.doFinal(ciphertext);
    }

    private static byte[] concat(byte[] first, byte[] second) {
        byte[] joined = Arrays.copyOf(first, first.length + second.length);
        System.arraycopy(second, 0, joined, first.length, second.length);
        return joined;
    }

    /** Returns null — never a partial key — when the configured value is unusable. */
    private static byte[] decodeMasterKey(String masterKeyBase64) {
        if (masterKeyBase64 == null || masterKeyBase64.isBlank()) {
            return null;
        }
        try {
            byte[] decoded = Base64.getDecoder().decode(masterKeyBase64.trim());
            if (decoded.length != MASTER_KEY_BYTES) {
                // Length only. Never the value, never a prefix of it.
                log.error("SEALED_BOX_MASTER_KEY decoded to {} bytes; it must be exactly {}.",
                        decoded.length, MASTER_KEY_BYTES);
                Arrays.fill(decoded, (byte) 0);
                return null;
            }
            return decoded;
        } catch (IllegalArgumentException e) {
            log.error("SEALED_BOX_MASTER_KEY is not valid base64.");
            return null;
        }
    }

    /**
     * The startup self-check. Encrypts and decrypts a known constant through the same path
     * a real item takes, so a JCE provider that cannot do AES-256-GCM is caught at boot
     * rather than on the day a family needs the box.
     */
    private boolean selfCheckPasses() {
        try {
            UUID probeOwner = new UUID(0L, 1L);
            UUID probeItem = new UUID(0L, 2L);
            byte[] aad = additionalData(probeOwner, probeItem, CURRENT_KEY_VERSION);
            byte[] nonce = freshNonce();
            byte[] sealed = encrypt(masterKey, nonce, aad, SELF_CHECK_CONSTANT.getBytes(StandardCharsets.UTF_8));
            String opened = new String(decrypt(masterKey, nonce, aad, sealed), StandardCharsets.UTF_8);
            return SELF_CHECK_CONSTANT.equals(opened);
        } catch (GeneralSecurityException e) {
            log.error("Sealed box startup self-check failed", e);
            return false;
        }
    }
}
