package com.towinly.assistant.guide;

import com.towinly.embedding.EmbeddingClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** A question in, the nearest passages out as one block; nothing when off or when the call fails. */
class GuideRetrieverTest {

    private EmbeddingClient embeddings;
    private GuideChunkStore store;
    private GuideRetriever retriever;

    @BeforeEach
    void setUp() {
        embeddings = mock(EmbeddingClient.class);
        when(embeddings.isConfigured()).thenReturn(true);
        store = mock(GuideChunkStore.class);
        retriever = new GuideRetriever(embeddings, store);
    }

    @Test
    void passages_areHeadedAndJoined() {
        when(embeddings.embedOne("How do I check in?")).thenReturn(Optional.of(new float[] {1f}));
        when(store.nearest(any(), anyInt())).thenReturn(List.of(
                new GuideChunk("elder", "checkin", "If you are an elder / Your daily check-in", List.of("elder"),
                        "Tap I'm here today.", "h1"),
                new GuideChunk("start", "what", "Start here / What Towinly is", List.of("elder"),
                        "Towinly introduces older people to younger helpers.", "h2")));

        Optional<String> block = retriever.passagesFor("How do I check in?");

        assertThat(block).isPresent();
        assertThat(block.get()).isEqualTo(
                "[If you are an elder / Your daily check-in]\nTap I'm here today.\n\n"
                + "[Start here / What Towinly is]\nTowinly introduces older people to younger helpers.");
        verify(store).nearest(any(), eq(GuideRetriever.PASSAGES));
    }

    @Test
    void nothing_whenNotConfigured() {
        when(embeddings.isConfigured()).thenReturn(false);

        assertThat(retriever.passagesFor("anything")).isEmpty();
        verify(embeddings, never()).embedOne(anyString());
    }

    @Test
    void nothing_whenTheEmbeddingFails_orNoChunksMatch() {
        when(embeddings.embedOne(anyString())).thenReturn(Optional.empty());
        assertThat(retriever.passagesFor("q")).isEmpty();

        when(embeddings.embedOne(anyString())).thenReturn(Optional.of(new float[] {1f}));
        when(store.nearest(any(), anyInt())).thenReturn(List.of());
        assertThat(retriever.passagesFor("q")).isEmpty();
    }

    @Test
    void aStoreError_isSwallowed() {
        when(embeddings.embedOne(anyString())).thenReturn(Optional.of(new float[] {1f}));
        when(store.nearest(any(), anyInt())).thenThrow(new IllegalStateException("no table"));

        assertThat(retriever.passagesFor("q")).isEmpty();
    }
}
