package com.towin.common.repository;

import com.towin.common.entity.PendingRegistration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

public interface PendingRegistrationRepository extends JpaRepository<PendingRegistration, UUID> {

    Optional<PendingRegistration> findByToken(String token);

    Optional<PendingRegistration> findFirstByEmailOrderByCreatedAtDesc(String email);

    @Modifying
    @Transactional
    void deleteByEmail(String email);
}
