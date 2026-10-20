package com.towinly.assistant.guide;

import com.towinly.embedding.EmbeddingClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** The table ends up equal to the file, and only the changed chunks cost an embedding. */
class GuideIndexerTest {

    private static final GuideChunk A = new GuideChunk("start", "what", "Start / What", List.of("elder"), "A", GuideChunk.sha256("A"));
    private static final GuideChunk B = new GuideChunk("start", "how", "Start / How", List.of("helper"), "B", GuideChunk.sha256("B"));

    private EmbeddingClient embeddings;
    private GuideChunkStore store;

    @BeforeEach
    void setUp() {
        embeddings = mock(EmbeddingClient.class);
        when(embeddings.isConfigured()).thenReturn(true);
        store = mock(GuideChunkStore.class);
    }

    private GuideIndexer indexer(List<GuideChunk> file) {
        return new GuideIndexer(embeddings, store, () -> file);
    }

    @Test
    void embedsAndInsertsOnlyTheChunksTheTableLacks() {
        when(store.hashes()).thenReturn(Set.of(A.hash()));
        when(embeddings.embed(List.of("B"))).thenReturn(Optional.of(List.of(new float[] {1f})));

        indexer(List.of(A, B)).sync();

        verify(embeddings).embed(List.of("B"));
        verify(store).insert(eq(B), any());
        verify(store, never()).insert(eq(A), any());
    }

    @SuppressWarnings("unchecked")
    @Test
    void removesRowsWhoseChunkLeftTheFile() {
        when(store.hashes()).thenReturn(Set.of(A.hash(), B.hash()));

        indexer(List.of(B)).sync();

        ArgumentCaptor<java.util.Collection<String>> keep = ArgumentCaptor.forClass(java.util.Collection.class);
        verify(store).deleteAllExcept(keep.capture());
        assertThat(keep.getValue()).containsExactly(B.hash());
        verify(embeddings, never()).embed(anyList());
    }

    @Test
    void aFailedEmbeddingCall_insertsNothing_andDeletesNothing() {
        when(store.hashes()).thenReturn(Set.of());
        when(embeddings.embed(anyList())).thenReturn(Optional.empty());

        indexer(List.of(A, B)).sync();

        verify(store, never()).insert(any(), any());
        verify(store, never()).deleteAllExcept(any());
    }

    @Test
    void withoutAKey_itTouchesNothing() {
        when(embeddings.isConfigured()).thenReturn(false);

        indexer(List.of(A)).sync();

        verify(store, never()).hashes();
    }
}
