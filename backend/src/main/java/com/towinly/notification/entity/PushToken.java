package com.towinly.notification.entity;

import com.towinly.common.entity.User;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One device that asked to be pinged. The token is Expo's address for the
 * device, unique across the table: when someone signs into a second account on
 * the same phone, the row moves to the new user instead of duplicating, so a
 * device never pings for an account that is no longer signed in on it.
 */
@Entity
@Table(name = "push_tokens")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PushToken {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, unique = true, length = 300)
    private String token;

    @Column(nullable = false, length = 16)
    private String platform;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
