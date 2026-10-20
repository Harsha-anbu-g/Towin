package com.towinly.embedding;

import com.towinly.common.enums.NeedStatus;
import com.towinly.need.repository.NeedRepository;
import com.towinly.profile.repository.ElderProfileRepository;
import com.towinly.profile.repository.HelperProfileRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Boot-time catch-up: profiles and open requests that have no embedding yet, or
 * whose text changed while embeddings were off, get one now. Capped per boot so
 * a first run can never become a runaway bill; the rest follow on the next boot
 * or on their next edit. A no-op without a key.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class EmbeddingBackfill implements ApplicationRunner {

    static final int CAP_PER_BOOT = 500;

    private final ElderProfileRepository elderProfiles;
    private final HelperProfileRepository helperProfiles;
    private final NeedRepository needs;
    private final EmbeddingIndex index;

    @Override
    public void run(ApplicationArguments args) {
        try {
            Map<UUID, String> profiles = new LinkedHashMap<>();
            elderProfiles.findAll().forEach(p -> profiles.put(p.getUser().getId(), EmbeddingText.forElder(p)));
            helperProfiles.findAll().forEach(p -> profiles.put(p.getUser().getId(), EmbeddingText.forHelper(p)));
            int wroteProfiles = index.refreshMany(EmbeddingStore.Kind.PROFILES, profiles, CAP_PER_BOOT);

            Map<UUID, String> requests = new LinkedHashMap<>();
            needs.findByStatusOrderByCreatedAtDesc(NeedStatus.OPEN).forEach(n -> requests.put(n.getId(), EmbeddingText.forNeed(n)));
            int wroteNeeds = index.refreshMany(EmbeddingStore.Kind.NEEDS, requests, Math.max(0, CAP_PER_BOOT - wroteProfiles));

            if (wroteProfiles + wroteNeeds > 0) {
                log.info("Embedding backfill: {} profiles and {} requests embedded", wroteProfiles, wroteNeeds);
            }
        } catch (Exception e) {
            log.warn("Embedding backfill failed, discovery keeps its distance order: {}", e.getMessage());
        }
    }
}
