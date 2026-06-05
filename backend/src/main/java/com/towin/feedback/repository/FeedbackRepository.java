package com.towin.feedback.repository;

import com.towin.feedback.entity.Feedback;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface FeedbackRepository extends JpaRepository<Feedback, UUID> {}
