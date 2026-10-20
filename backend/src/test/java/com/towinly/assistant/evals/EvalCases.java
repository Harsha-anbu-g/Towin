package com.towinly.assistant.evals;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;

/** Loads the cases. Unknown fields fail loudly so a typo in a rule name cannot pass silently. */
final class EvalCases {

    static final String RESOURCE = "assistant/evals.json";

    private EvalCases() {}

    static List<EvalCase> load() {
        try (InputStream in = new ClassPathResource(RESOURCE).getInputStream()) {
            return new ObjectMapper().readValue(in, new TypeReference<List<EvalCase>>() {});
        } catch (IOException e) {
            throw new IllegalStateException("Cannot read " + RESOURCE + ": " + e.getMessage(), e);
        }
    }
}
