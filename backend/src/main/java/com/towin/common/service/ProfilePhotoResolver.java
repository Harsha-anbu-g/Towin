package com.towin.common.service;

import com.towin.common.entity.User;
import com.towin.profile.entity.ElderProfile;
import com.towin.profile.entity.HelperProfile;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;

/**
 * The one place that decides which photo we show for a person, mirroring
 * {@link DisplayNameResolver}.
 *
 * Photos used to be looked up straight off an elder or helper profile. That
 * quietly meant family accounts could never have a face: they have neither
 * profile, so every lookup ended in null and their messages fell back to an
 * initial no matter what we stored. Sarah is a person in these conversations,
 * not a grey circle.
 *
 * Static on purpose, matching DisplayNameResolver: callers already hold these
 * repositories, so no extra bean wiring is needed.
 */
public final class ProfilePhotoResolver {

    private ProfilePhotoResolver() {
    }

    /**
     * The person's photo: their elder profile's, then their helper profile's,
     * then the one on their account. Null when there is genuinely none — callers
     * render an initial, which is a fine answer and better than a broken image.
     *
     * The returned value is the RAW stored URL. Callers must still pass it
     * through S3Service.presignedUrl, exactly as they did before, so that S3
     * objects get signed and app-served paths come back untouched.
     */
    public static String resolve(ElderProfileRepository elderProfiles,
                                 HelperProfileRepository helperProfiles,
                                 User user) {
        return elderProfiles.findByUserId(user.getId())
                .map(ElderProfile::getPhotoUrl)
                .filter(ProfilePhotoResolver::notBlank)
                .or(() -> helperProfiles.findByUserId(user.getId())
                        .map(HelperProfile::getPhotoUrl)
                        .filter(ProfilePhotoResolver::notBlank))
                .orElseGet(() -> notBlank(user.getPhotoUrl()) ? user.getPhotoUrl() : null);
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
