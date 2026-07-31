package com.towinly.passon.repository;

import com.towinly.passon.entity.PassOnSettings;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

/**
 * One row per owner, keyed by the owner, so {@code findById(ownerId)} is the whole lookup.
 * Nothing here decides anything — the rules that matter are CHECK constraints in V53.
 */
public interface PassOnSettingsRepository extends JpaRepository<PassOnSettings, UUID> {

    // GDPR purge, and the demo reset. Named rather than deleteById so the purge reads the
    // same as every other table in this package.
    void deleteByOwnerId(UUID ownerId);
}
