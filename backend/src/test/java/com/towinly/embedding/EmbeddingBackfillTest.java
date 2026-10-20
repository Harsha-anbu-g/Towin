package com.towinly.embedding;

import com.towinly.common.entity.User;
import com.towinly.common.enums.NeedCategory;
import com.towinly.common.enums.NeedStatus;
import com.towinly.need.entity.Need;
import com.towinly.need.repository.NeedRepository;
import com.towinly.profile.entity.ElderProfile;
import com.towinly.profile.entity.HelperProfile;
import com.towinly.profile.repository.ElderProfileRepository;
import com.towinly.profile.repository.HelperProfileRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** At boot, every profile and every open request is offered to the index, once, capped. */
class EmbeddingBackfillTest {

    @SuppressWarnings("unchecked")
    @Test
    void offersProfilesAndOpenNeeds_asTexts() {
        ElderProfileRepository elders = mock(ElderProfileRepository.class);
        HelperProfileRepository helpers = mock(HelperProfileRepository.class);
        NeedRepository needs = mock(NeedRepository.class);
        EmbeddingIndex index = mock(EmbeddingIndex.class);
        UUID e = UUID.randomUUID();
        UUID h = UUID.randomUUID();
        UUID n = UUID.randomUUID();
        when(elders.findAll()).thenReturn(List.of(ElderProfile.builder().user(User.builder().id(e).build()).bio("walks").build()));
        when(helpers.findAll()).thenReturn(List.of(HelperProfile.builder().user(User.builder().id(h).build()).bio("errands").build()));
        when(needs.findByStatusOrderByCreatedAtDesc(NeedStatus.OPEN)).thenReturn(List.of(
                Need.builder().id(n).title("Groceries").category(NeedCategory.ERRANDS).build()));

        new EmbeddingBackfill(elders, helpers, needs, index).run(null);

        ArgumentCaptor<Map<UUID, String>> profiles = ArgumentCaptor.forClass(Map.class);
        verify(index).refreshMany(eq(EmbeddingStore.Kind.PROFILES), profiles.capture(), anyInt());
        assertThat(profiles.getValue()).containsEntry(e, "Elder. About: walks.").containsEntry(h, "Helper. About: errands.");
        ArgumentCaptor<Map<UUID, String>> requests = ArgumentCaptor.forClass(Map.class);
        verify(index).refreshMany(eq(EmbeddingStore.Kind.NEEDS), requests.capture(), anyInt());
        assertThat(requests.getValue()).containsEntry(n, "Help request: Groceries. Category: errands.");
    }
}
