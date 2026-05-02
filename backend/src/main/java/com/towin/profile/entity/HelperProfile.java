package com.towin.profile.entity;

import com.towin.common.entity.User;
import com.towin.common.enums.BackgroundCheckStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "helper_profiles")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class HelperProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private Integer age;

    @Column(name = "photo_url")
    private String photoUrl;

    private String bio;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "skills_offered", columnDefinition = "text[]")
    private String[] skillsOffered;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(columnDefinition = "text[]")
    private String[] languages;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "availability_days", columnDefinition = "text[]")
    private String[] availabilityDays;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "availability_times", columnDefinition = "text[]")
    private String[] availabilityTimes;

    @Enumerated(EnumType.STRING)
    @Column(name = "background_check_status", columnDefinition = "background_check_status_type")
    @Builder.Default
    private BackgroundCheckStatus backgroundCheckStatus = BackgroundCheckStatus.NONE;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

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
