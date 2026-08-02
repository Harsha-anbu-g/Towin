package com.towinly.passon.repository;

import com.towinly.passon.entity.PassOnOpen;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PassOnOpenRepository extends JpaRepository<PassOnOpen, Long> {

    // What the elder reads back: newest first.
    List<PassOnOpen> findByOwnerIdOrderByAtDesc(UUID ownerId);

    // GDPR purge, and the demo reset. owner_id carries no foreign key on purpose, so nothing
    // cascades here — these rows have to be cleared by name or they outlive the account.
    void deleteByOwnerId(UUID ownerId);
}
