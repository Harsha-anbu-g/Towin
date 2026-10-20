package com.towinly.assistant.guide;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;

/** Loads the committed corpus from the classpath. */
public final class GuideChunks {

    public static final String RESOURCE = "assistant/guide-chunks.json";

    private GuideChunks() {}

    public static List<GuideChunk> load() {
        try (InputStream in = new ClassPathResource(RESOURCE).getInputStream()) {
            return new ObjectMapper().readValue(in, new TypeReference<List<GuideChunk>>() {});
        } catch (IOException e) {
            throw new IllegalStateException("Cannot read " + RESOURCE + ": " + e.getMessage(), e);
        }
    }
}
