package com.towin.common.entity;

import com.towin.common.enums.UserRole;
import com.towin.common.enums.VerificationStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.math.BigDecimal;
import java.time.LocalDate;
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

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(columnDefinition = "user_role")
    @Builder.Default
    private UserRole role = UserRole.ELDER;

    @Column(name = "trust_score")
    @Builder.Default
    private Integer trustScore = 0;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "verification_status", columnDefinition = "verification_status")
    @Builder.Default
    private VerificationStatus verificationStatus = VerificationStatus.NONE;

    @Column(name = "id_document_url")
    private String idDocumentUrl;

    @Column(name = "location_lat", precision = 10, scale = 8)
    private BigDecimal locationLat;

    @Column(name = "location_lng", precision = 11, scale = 8)
    private BigDecimal locationLng;

    private String city;

    @Column(name = "phone_verified")
    @Builder.Default
    private boolean phoneVerified = false;

    @Column(name = "phone_otp")
    private String phoneOtp;

    @Column(name = "phone_otp_expires_at")
    private LocalDateTime phoneOtpExpiresAt;

    @Column(name = "inactivity_alerted_at")
    private LocalDateTime inactivityAlertedAt;

    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "last_seen_at")
    private LocalDateTime lastSeenAt;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
