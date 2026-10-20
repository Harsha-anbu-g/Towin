package com.towinly.assistant.guide;

import com.towinly.embedding.EmbeddingClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Finds the guide passages that match a question: embed the question, ask
 * pgvector for the nearest chunks, return them as one block the prompt can
 * carry. Empty when embeddings are off, when the call fails, or when the table
 * is empty, so Ask AI always has an answer path without the guide.
 */
@Slf4j
@Component
public class GuideRetriever {

    /** Four passages of about 1,200 characters: enough to cover a how-to, cheap enough to send every time. */
    static final int PASSAGES = 4;

    private final EmbeddingClient embeddings;
    private final GuideChunkStore store;

    public GuideRetriever(EmbeddingClient embeddings, GuideChunkStore store) {
        this.embeddings = embeddings;
        this.store = store;
    }

    public Optional<String> passagesFor(String question) {
        if (!embeddings.isConfigured()) return Optional.empty();
        try {
            Optional<float[]> query = embeddings.embedOne(question);
            if (query.isEmpty()) return Optional.empty();
            List<GuideChunk> nearest = store.nearest(query.get(), PASSAGES);
            if (nearest.isEmpty()) return Optional.empty();
            return Optional.of(nearest.stream()
                    .map(c -> "[" + c.heading() + "]\n" + c.text())
                    .collect(Collectors.joining("\n\n")));
        } catch (Exception e) {
            log.warn("Guide retrieval failed, answering without the guide: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
