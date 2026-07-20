package com.towin.common.service;

import com.towin.common.entity.User;
import com.towin.profile.entity.ElderProfile;
import com.towin.profile.entity.HelperProfile;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;

/**
 * A person's name is printed in public — on a helper's profile, in a review, on
 * a help request. These tests hold the line that we never print a way to contact
 * them instead.
 */
@ExtendWith(MockitoExtension.class)
class DisplayNameResolverTest {

    @Mock ElderProfileRepository elderProfiles;
    @Mock HelperProfileRepository helperProfiles;

    private User user(String username, String fullName) {
        User u = new User();
        u.setId(UUID.randomUUID());
        u.setUsername(username);
        u.setFullName(fullName);
        return u;
    }

    private void noProfiles() {
        lenient().when(elderProfiles.findByUserId(any())).thenReturn(Optional.empty());
        lenient().when(helperProfiles.findByUserId(any())).thenReturn(Optional.empty());
    }

    @Test
    void usesElderProfileNameWhenTheyHaveOne() {
        User margaret = user("elder", "Margaret Hill");
        ElderProfile profile = new ElderProfile();
        profile.setName("Margaret");
        lenient().when(elderProfiles.findByUserId(margaret.getId())).thenReturn(Optional.of(profile));

        assertThat(DisplayNameResolver.resolve(elderProfiles, helperProfiles, margaret))
                .isEqualTo("Margaret");
    }

    @Test
    void usesHelperProfileNameWhenThereIsNoElderProfile() {
        User harsha = user("helper", "Harsha A");
        HelperProfile profile = new HelperProfile();
        profile.setName("Harsha");
        lenient().when(elderProfiles.findByUserId(harsha.getId())).thenReturn(Optional.empty());
        lenient().when(helperProfiles.findByUserId(harsha.getId())).thenReturn(Optional.of(profile));

        assertThat(DisplayNameResolver.resolve(elderProfiles, helperProfiles, harsha))
                .isEqualTo("Harsha");
    }

    @Test
    void fallsBackToFullNameWhenThereIsNoProfile() {
        noProfiles();
        User sarah = user("demo.sarah@towin.app", "Sarah");

        assertThat(DisplayNameResolver.resolve(elderProfiles, helperProfiles, sarah))
                .isEqualTo("Sarah");
    }

    @Test
    void neverReturnsAnEmailAddressAsAName() {
        noProfiles();
        User sarah = user("demo.sarah@towin.app", null);

        String name = DisplayNameResolver.resolve(elderProfiles, helperProfiles, sarah);

        assertThat(name).doesNotContain("@").doesNotContain("towin.app");
        assertThat(name).as("a name still appears, so the sentence around it reads").isNotBlank();
    }

    @Test
    void neverReturnsAPhoneNumberAsAName() {
        noProfiles();

        assertThat(DisplayNameResolver.fromUser(user("+14165550112", null))).isEqualTo("Someone");
        assertThat(DisplayNameResolver.fromUser(user("4165550112", null))).isEqualTo("Someone");
        assertThat(DisplayNameResolver.fromUser(user("+1 (416) 555-0112", null))).isEqualTo("Someone");
    }

    @Test
    void keepsOnlyTheNameLikePartOfAnEmailHandle() {
        assertThat(DisplayNameResolver.fromUser(user("demo.sarah@towin.app", null)))
                .isEqualTo("Demo Sarah");
        assertThat(DisplayNameResolver.fromUser(user("sarah@towin.app", null)))
                .isEqualTo("Sarah");
    }

    @Test
    void saysSomeoneWhenTheHandleCarriesDigitsThatCouldIdentifyThem() {
        // "harsha1987" leaks a birth year, and "j" is not a name — neither is
        // worth printing next to someone's review.
        assertThat(DisplayNameResolver.fromUser(user("harsha1987@gmail.com", null))).isEqualTo("Someone");
        assertThat(DisplayNameResolver.fromUser(user("j@gmail.com", null))).isEqualTo("Someone");
    }

    @Test
    void showsAnOrdinaryLoginHandleUnchanged() {
        // "elder" is not a way to contact anyone, so the old behaviour stands.
        assertThat(DisplayNameResolver.fromUser(user("elder", null))).isEqualTo("elder");
    }

    @Test
    void saysSomeoneWhenThereIsNothingToGoOn() {
        assertThat(DisplayNameResolver.fromUser(user(null, null))).isEqualTo("Someone");
        assertThat(DisplayNameResolver.fromUser(user("   ", ""))).isEqualTo("Someone");
    }
}
