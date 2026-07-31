package com.towinly.passon.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * The address a family writes to when the day comes.
 *
 * <h2>Why this is configuration and not a constant</h2>
 * This address is printed on the one-page copy an elder saves and keeps with her will. It is
 * read years later, by somebody in the week after a death, and it is the only route they have
 * into the release procedure. So it has to be a mailbox a person actually reads, which is an
 * operational fact about a deployment rather than a fact about the code — exactly like
 * {@code ADMIN_EMAIL} and {@code GROQ_API_KEY}, and it is set the same way.
 *
 * <h2>Why there is no default</h2>
 * A blank value means {@link #email()} is null and every screen says plainly that no address
 * has been set yet. There is deliberately no fallback, because the obvious one — a
 * plausible-looking mailbox on the real domain — is worse than nothing. An address that looks
 * real and cannot receive mail swallows a grieving family's letter in silence, and they have
 * no way of finding out. Saying "we have not set one yet" is the only honest answer, and it is
 * the one a family can act on.
 *
 * <p>The value is not a secret. It is published on a page people keep, so it is logged at boot
 * for whoever is checking the deployment.
 */
@Slf4j
@Component
public class ReleaseContact {

    private final String email;

    public ReleaseContact(@Value("${passon.sealed.release-contact-email:}") String configured) {
        this.email = configured == null || configured.isBlank() ? null : configured.trim();

        if (this.email == null) {
            log.warn("Sealed box release contact is NOT SET. Set SEALED_BOX_RELEASE_CONTACT_EMAIL "
                    + "to a mailbox somebody reads. Until then the saved one-page copy tells the "
                    + "family plainly that there is no address yet, rather than printing one that "
                    + "cannot receive their letter.");
        } else {
            log.info("Sealed box release contact is set to {}.", this.email);
        }
    }

    /** The configured address, or null when none is set. Never a placeholder. */
    public String email() {
        return email;
    }
}
