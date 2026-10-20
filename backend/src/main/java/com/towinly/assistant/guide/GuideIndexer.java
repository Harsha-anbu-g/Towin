package com.towinly.assistant.guide;

import com.towinly.embedding.EmbeddingClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.Supplier;
import java.util.stream.Collectors;

/**
 * At boot, makes the table equal to guide-chunks.json: embeds and inserts the
 * chunks whose hash the table lacks, then removes rows whose hash the file no
 * longer has. The first boot with a key embeds the whole guide (a few batch
 * calls); every later boot finds nothing to do unless the guide was re-exported.
 *
 * <p>Runs after Flyway (an ApplicationRunner starts once the context is ready).
 * Any failure is logged and the boot continues: Ask AI works without the guide.
 */
@Slf4j
@Component
public class GuideIndexer implements ApplicationRunner {

    private final EmbeddingClient embeddings;
    private final GuideChunkStore store;
    private final Supplier<List<GuideChunk>> corpus;

    @Autowired
    public GuideIndexer(EmbeddingClient embeddings, GuideChunkStore store) {
        this(embeddings, store, GuideChunks::load);
    }

    GuideIndexer(EmbeddingClient embeddings, GuideChunkStore store, Supplier<List<GuideChunk>> corpus) {
        this.embeddings = embeddings;
        this.store = store;
        this.corpus = corpus;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            sync();
        } catch (Exception e) {
            log.warn("Guide index: sync failed, Ask AI will answer without the guide: {}", e.getMessage());
        }
    }

    /** One pass: insert what is new, delete what is gone. Package-private for tests. */
    void sync() {
        if (!embeddings.isConfigured()) {
            log.info("Guide index: embeddings are not configured; the user guide is not indexed.");
            return;
        }
        List<GuideChunk> file = corpus.get();
        Set<String> inTable = store.hashes();
        List<GuideChunk> missing = file.stream().filter(c -> !inTable.contains(c.hash())).toList();

        for (int from = 0; from < missing.size(); from += EmbeddingClient.MAX_BATCH) {
            List<GuideChunk> batch = missing.subList(from, Math.min(from + EmbeddingClient.MAX_BATCH, missing.size()));
            Optional<List<float[]>> vectors = embeddings.embed(batch.stream().map(GuideChunk::text).toList());
            if (vectors.isEmpty()) {
                log.warn("Guide index: embedding a batch of {} failed; stopping this pass, nothing deleted", batch.size());
                return;
            }
            for (int i = 0; i < batch.size(); i++) {
                store.insert(batch.get(i), vectors.get().get(i));
            }
        }

        Set<String> keep = file.stream().map(GuideChunk::hash).collect(Collectors.toSet());
        int removed = inTable.stream().anyMatch(h -> !keep.contains(h)) ? store.deleteAllExcept(new ArrayList<>(keep)) : 0;
        log.info("Guide index: {} chunks in file, {} embedded now, {} removed", file.size(), missing.size(), removed);
    }
}
