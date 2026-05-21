package com.towin.feedback.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "feedback")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Feedback {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private String name;
    private String email;
    private String phone;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    private Integer ratingIdea;
    private Integer ratingUi;
    private Integer ratingTheme;
    private Integer ratingSecurity;
    private Integer ratingEaseOfUse;
    private Integer ratingPerformance;
    private Integer ratingOverall;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() { this.createdAt = LocalDateTime.now(); }
}
