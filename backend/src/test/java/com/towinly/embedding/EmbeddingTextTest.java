package com.towinly.embedding;

import com.towinly.common.enums.NeedCategory;
import com.towinly.need.entity.Need;
import com.towinly.profile.entity.ElderProfile;
import com.towinly.profile.entity.HelperProfile;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** One short paragraph per person or request, with empty fields left out. */
class EmbeddingTextTest {

    @Test
    void anElder_isRoleBioInterestsLanguagesOccupation() {
        ElderProfile p = ElderProfile.builder().bio("I like a slow walk and a chat.")
                .interests(new String[] {"Reading", "Gardening"}).languages(new String[] {"English", "French"})
                .occupation("Retired teacher").build();

        assertThat(EmbeddingText.forElder(p)).isEqualTo(
                "Elder. About: I like a slow walk and a chat. Interests: Reading, Gardening. "
                + "Languages: English, French. Occupation: Retired teacher.");
    }

    @Test
    void aHelper_isRoleBioSkillsHobbiesLanguagesOccupation() {
        HelperProfile p = HelperProfile.builder().bio("Student, free on weekends.")
                .skillsOffered(new String[] {"Driving", "Errands"}).hobbies(new String[] {"Walking"})
                .languages(new String[] {"English"}).build();

        assertThat(EmbeddingText.forHelper(p)).isEqualTo(
                "Helper. About: Student, free on weekends. Can help with: Driving, Errands. "
                + "Hobbies: Walking. Languages: English.");
    }

    @Test
    void aRequest_isTitleDescriptionCategory() {
        Need n = Need.builder().title("A ride to the clinic").description("Tuesday at 9, back by 11.")
                .category(NeedCategory.TRANSPORTATION).build();

        assertThat(EmbeddingText.forNeed(n)).isEqualTo(
                "Help request: A ride to the clinic. Tuesday at 9, back by 11. Category: transportation.");
    }

    @Test
    void emptyFields_areLeftOut_andNothingIsNull() {
        assertThat(EmbeddingText.forElder(ElderProfile.builder().build())).isEqualTo("Elder.");
        assertThat(EmbeddingText.forHelper(HelperProfile.builder().bio("  ").build())).isEqualTo("Helper.");
        assertThat(EmbeddingText.forNeed(Need.builder().title("Groceries").build())).isEqualTo("Help request: Groceries.");
    }
}
