package com.towinly.feedback.repository;

import com.towinly.feedback.entity.Feedback;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface FeedbackRepository extends JpaRepository<Feedback, UUID> {}
