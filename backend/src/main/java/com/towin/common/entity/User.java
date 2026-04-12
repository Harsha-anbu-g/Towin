package com.towin.common.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(unique = true, nullable = false)
    private String phone;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(columnDefinition = "user_role")
    private UserRole role = UserRole.ELDER;

    @Builder.Default
    @Column(name = "trust_score")
    private Integer trustScore = 0;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "verification_status", columnDefinition = "verification_status")
    private VerificationStatus verificationStatus = VerificationStatus.NONE;

    @Column(name = "id_document_url")
    private String idDocumentUrl;

    @Column(name = "location_lat", precision = 10, scale = 8)
    private BigDecimal locationLat;

    @Column(name = "location_lng", precision = 11, scale = 8)
    private BigDecimal locationLng;

    private String city;

    @Builder.Default
    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "last_seen_at")
    private LocalDateTime lastSeenAt;

    @Builder.Default
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Builder.Default
    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public enum UserRole { ELDER, HELPER, BOTH }
    public enum VerificationStatus { NONE, PENDING, VERIFIED, REJECTED }
}
