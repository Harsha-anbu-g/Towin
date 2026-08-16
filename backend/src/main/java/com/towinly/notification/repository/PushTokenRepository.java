package com.towinly.notification.repository;

import com.towinly.notification.entity.PushToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PushTokenRepository extends JpaRepository<PushToken, UUID> {

    Optional<PushToken> findByToken(String token);

    List<PushToken> findAllByUserId(UUID userId);

    @Modifying
    void deleteByToken(String token);

    @Modifying
    void deleteByUserId(UUID userId);
}
