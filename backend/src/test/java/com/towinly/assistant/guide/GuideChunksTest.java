package com.towinly.assistant.guide;

import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/** The committed corpus is well formed: enough chunks, unique hashes, clean text, known roles. */
class GuideChunksTest {

    private final List<GuideChunk> chunks = GuideChunks.load();

    @Test
    void thereIsAWholeGuideHere() {
        assertThat(chunks).hasSizeGreaterThanOrEqualTo(100);
    }

    @Test
    void hashesAreUnique_andMatchTheText() {
        Set<String> seen = new HashSet<>();
        for (GuideChunk c : chunks) {
            assertThat(seen.add(c.hash())).as("duplicate hash in " + c.heading()).isTrue();
            assertThat(c.hash()).isEqualTo(GuideChunk.sha256(c.text()));
        }
    }

    @Test
    void textIsPlain_andBounded() {
        for (GuideChunk c : chunks) {
            assertThat(c.text()).as(c.heading()).isNotBlank().doesNotContain("[[").doesNotContain("**");
            assertThat(c.text().length()).as(c.heading()).isLessThanOrEqualTo(4000);
            assertThat(c.heading()).contains(" / ");
        }
    }

    @Test
    void rolesAreTheThreeSeats() {
        for (GuideChunk c : chunks) {
            assertThat(c.roles()).as(c.heading()).isNotEmpty().isSubsetOf("elder", "helper", "family");
        }
    }
}
