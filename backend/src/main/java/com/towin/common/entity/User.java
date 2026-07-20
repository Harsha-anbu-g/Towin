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

    @Column(unique = true)
    private String email;

    @Column(unique = true)
    private String phone;

    @Column(name = "password_hash")
    private String passwordHash;

    @Column(name = "auth_provider", length = 20)
    @Builder.Default
    private String authProvider = "LOCAL";

    @Column(name = "username", length = 30, unique = true, nullable = false)
    private String username;

    @Column(name = "full_name", length = 120)
    private String fullName;

    /**
     * The account's own photo — the fallback for anyone with no elder or helper
     * profile to carry one, which is every family account. Profiles still win
     * where they exist; see ProfilePhotoResolver.
     */
    @Column(name = "photo_url", length = 500)
    private String photoUrl;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(columnDefinition = "user_role")
    @Builder.Default
    private UserRole role = UserRole.ELDER;

    @Column(name = "trust_score")
    @Builder.Default
    private Double trustScore = 0.0;

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

    @Column(name = "phone_otp_attempts")
    @Builder.Default
    private int phoneOtpAttempts = 0;

    @Column(name = "phone_otp_locked_at")
    private LocalDateTime phoneOtpLockedAt;

    @Column(name = "setup_completed")
    @Builder.Default
    private boolean setupCompleted = false;

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

    @Column(name = "token_version")
    @Builder.Default
    private int tokenVersion = 0;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Column(name = "email_verified")
    @Builder.Default
    private boolean emailVerified = false;

    @Column(name = "email_verification_token")
    private String emailVerificationToken;

    @Column(name = "email_verification_expires_at")
    private LocalDateTime emailVerificationExpiresAt;

    @Column(name = "password_reset_token")
    private String passwordResetToken;

    @Column(name = "password_reset_expires_at")
    private LocalDateTime passwordResetExpiresAt;

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
