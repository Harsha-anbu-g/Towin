package com.towin.common.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Staging row for a manual signup that hasn't verified its email yet. The real
 * {@link User} account is created only when the verification link is clicked,
 * and this row is deleted at that point. Nothing here is a usable account.
 */
@Entity
@Table(name = "pending_registrations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PendingRegistration {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String username;

    @Column(nullable = false)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    // Stored as plain text; the user_role Postgres enum is only used on the real users table.
    @Column(nullable = false, length = 20)
    private String role;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Column(nullable = false, unique = true)
    private String token;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
