package com.towinly.passon.entity;

import com.towinly.common.entity.User;
import com.towinly.common.enums.SealedKind;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One thing in the elder's Sealed box, encrypted server-side by {@code SealedCryptoService}.
 *
 * Nothing readable is stored here on purpose. There is no plaintext label and no plaintext
 * filename — a legible "Where the cash is hidden" beside the ciphertext, attached to a named
 * elderly person at a known address, would turn a database leak into a burglary list and make
 * the encryption decorative. Only {@link #kindHint} stays readable, so the owner's own list can
 * show a chip without a decrypt; it carries no name, no address and no amount.
 *
 * The ciphertext fields are bare {@code byte[]} and must stay that way. Adding {@code @Lob}
 * makes Hibernate 6 target a Postgres large object and the context refuses to start with
 * "found [bytea (Types#BINARY)], but expecting [oid (Types#BLOB)]" — see
 * {@code SealedItemByteaDbTest}, which exists to keep that mistake out.
 */
@Entity
@Table(name = "passon_sealed_items")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SealedItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(name = "label_cipher", nullable = false)
    private byte[] labelCipher;

    @Column(name = "label_iv", nullable = false)
    private byte[] labelIv;

    /** Readable by design, so the list can show a chip; carries nothing identifying. */
    @Enumerated(EnumType.STRING)
    @Column(name = "kind_hint", nullable = false, length = 20)
    private SealedKind kindHint;

    @Column(name = "body_cipher", nullable = false)
    private byte[] bodyCipher;

    @Column(name = "body_iv", nullable = false)
    private byte[] bodyIv;

    /** The per-item data key, wrapped under the master key. Never leaves this table. */
    @Column(name = "wrapped_key", nullable = false)
    private byte[] wrappedKey;

    /** Which master key wrapped it, so a rotation can find the rows it still has to re-wrap. */
    @Column(name = "key_version", nullable = false)
    @Builder.Default
    private Short keyVersion = 1;

    /** Plaintext length, kept so the list can show a size without a decrypt. */
    @Column(name = "byte_size", nullable = false)
    private Integer byteSize;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private Integer sortOrder = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
