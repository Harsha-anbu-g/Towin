package com.towinly.embedding;

import com.towinly.assistant.guide.GuideChunk;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static com.towinly.embedding.EmbeddingStore.Kind.NEEDS;
import static com.towinly.embedding.EmbeddingStore.Kind.PROFILES;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Refresh only on change; the blend lifts a match by up to five kilometres; nothing without a key. */
class EmbeddingIndexTest {

    private static final UUID ME = UUID.randomUUID();
    private static final UUID NEAR = UUID.randomUUID();
    private static final UUID FAR = UUID.randomUUID();

    private EmbeddingClient client;
    private EmbeddingStore store;
    private EmbeddingIndex index;

    @BeforeEach
    void setUp() {
        client = mock(EmbeddingClient.class);
        when(client.isConfigured()).thenReturn(true);
        store = mock(EmbeddingStore.class);
        index = new EmbeddingIndex(client, store);
    }

    @Test
    void refreshProfile_skipsAnUnchangedText() {
        String text = "Elder. About: walks.";
        when(store.hashes(PROFILES)).thenReturn(Map.of(ME, GuideChunk.sha256(text)));

        index.refreshProfile(ME, text);

        verify(client, never()).embedOne(anyString());
        verify(store, never()).upsert(any(), any(), anyString(), any());
    }

    @Test
    void refreshProfile_embedsAndUpsertsAChangedText() {
        when(store.hashes(PROFILES)).thenReturn(Map.of(ME, "old"));
        when(client.embedOne("Elder. About: walks.")).thenReturn(Optional.of(new float[] {1f}));

        index.refreshProfile(ME, "Elder. About: walks.");

        verify(store).upsert(eq(PROFILES), eq(ME), eq(GuideChunk.sha256("Elder. About: walks.")), any());
    }

    @Test
    void refreshNeed_leavesTheRowAlone_whenTheCallFails() {
        when(store.hashes(NEEDS)).thenReturn(Map.of());
        when(client.embedOne(anyString())).thenReturn(Optional.empty());

        index.refreshNeed(ME, "Help request: Groceries.");

        verify(store, never()).upsert(any(), any(), anyString(), any());
    }

    @Test
    void withoutAKey_nothingIsReadOrWritten() {
        when(client.isConfigured()).thenReturn(false);

        index.refreshProfile(ME, "x");
        assertThat(index.queryVectorForElder(ME)).isEmpty();
        assertThat(index.similarity(PROFILES, new float[] {1f}, List.of(NEAR))).isEmpty();

        verify(store, never()).hashes(any());
    }

    @Test
    void refreshMany_embedsOnlyChangedTexts_inBatches_upToTheCap() {
        Map<UUID, String> texts = new LinkedHashMap<>();
        for (int i = 0; i < 150; i++) texts.put(UUID.randomUUID(), "Helper. About: " + i + ".");
        UUID unchanged = texts.keySet().iterator().next();
        when(store.hashes(PROFILES)).thenReturn(Map.of(unchanged, GuideChunk.sha256(texts.get(unchanged))));
        when(client.embed(anyList())).thenAnswer(inv -> {
            List<String> batch = inv.getArgument(0);
            return Optional.of(batch.stream().map(t -> new float[] {1f}).toList());
        });

        int done = index.refreshMany(PROFILES, texts, 120);

        assertThat(done).isEqualTo(120);
        verify(client, times(2)).embed(anyList());
        verify(store, never()).upsert(eq(PROFILES), eq(unchanged), anyString(), any());
    }

    @Test
    void queryVectorForElder_prefersTheOpenRequest_thenTheProfile() {
        when(store.latestOpenNeedVector(ME)).thenReturn(Optional.of(new float[] {2f}));
        assertThat(index.queryVectorForElder(ME).orElseThrow()).containsExactly(2f);

        when(store.latestOpenNeedVector(ME)).thenReturn(Optional.empty());
        when(store.vector(PROFILES, ME)).thenReturn(Optional.of(new float[] {3f}));
        assertThat(index.queryVectorForElder(ME).orElseThrow()).containsExactly(3f);
    }

    @Test
    void aStoreError_readsAsNoMatch() {
        when(store.similarity(any(), any(), any())).thenThrow(new IllegalStateException("down"));

        assertThat(index.similarity(PROFILES, new float[] {1f}, List.of(NEAR))).isEmpty();
    }

    @Test
    void byMatch_liftsAGoodMatchByUpToFiveKilometres_andKeepsDistance() {
        List<Map.Entry<UUID, Double>> byDistance = List.of(Map.entry(NEAR, 3.0), Map.entry(FAR, 6.0));

        // 6 km with 0.8 gives a key of 2.0; 3 km with 0.1 gives 2.5: the far match wins.
        // (0.7 at 6 km would tie at 2.5 and the stable sort would keep the nearer first.)
        List<Map.Entry<UUID, Double>> ordered = EmbeddingIndex.byMatch(byDistance, Map.of(FAR, 0.8, NEAR, 0.1),
                Map.Entry::getKey, Map.Entry::getValue);

        assertThat(ordered).extracting(Map.Entry::getKey).containsExactly(FAR, NEAR);
        assertThat(ordered.get(0).getValue()).isEqualTo(6.0);
        assertThat(EmbeddingIndex.byMatch(byDistance, Map.of(), Map.Entry::getKey, Map.Entry::getValue))
                .isEqualTo(byDistance);
    }

    @Test
    void rankKey_isDistanceMinusFiveTimesSimilarity() {
        assertThat(EmbeddingIndex.rankKey(6.0, 0.7)).isEqualTo(2.5);
        assertThat(EmbeddingIndex.rankKey(3.0, null)).isEqualTo(3.0);
    }
}
