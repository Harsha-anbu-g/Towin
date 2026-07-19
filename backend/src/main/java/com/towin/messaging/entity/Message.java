package com.towin.messaging.entity;

import com.towin.common.entity.User;
import com.towin.common.enums.MessageChannel;
import com.towin.common.enums.MessageType;
import com.towin.connection.entity.Connection;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "messages")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "connection_id", nullable = false)
    private Connection connection;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_id", nullable = false)
    private User sender;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "message_type")
    @Builder.Default
    private MessageType type = MessageType.TEXT;

    // VARCHAR(20) column (V40), not a Postgres enum type — plain STRING mapping.
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private MessageChannel channel = MessageChannel.MAIN;

    private LocalDateTime seenAt;

    @Builder.Default
    private boolean flagged = false;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        // Respect an explicitly-set time (demo seeding gives a conversation
        // realistic, ordered timestamps); default to now for live messages.
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
