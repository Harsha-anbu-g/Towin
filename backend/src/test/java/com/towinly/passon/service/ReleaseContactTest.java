package com.towinly.passon.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The address a family writes to when the day comes.
 *
 * <p>There is only one rule here and it is worth a test file of its own: an address that was
 * not configured must come out as nothing. Every other shape of "missing" a deployment can
 * produce — an unset variable, an empty string, a line of whitespace left behind in a Railway
 * field — has to reach the page as null, so the page can say plainly that no address has been
 * set. A blank string dressed up as an address would be printed on a page a family keeps with
 * the will, and they would write to it.
 */
class ReleaseContactTest {

    @Test
    void anUnsetVariableIsNoAddressAtAll() {
        assertThat(new ReleaseContact(null).email()).isNull();
    }

    @Test
    void anEmptyOrBlankVariableIsAlsoNoAddressAtAll() {
        assertThat(new ReleaseContact("").email()).isNull();
        assertThat(new ReleaseContact("   ").email()).isNull();
    }

    @Test
    void aConfiguredAddressIsHandedOnAsItStands() {
        assertThat(new ReleaseContact("sealedbox@example.org").email())
                .isEqualTo("sealedbox@example.org");
    }

    /** Copied out of a dashboard field, a trailing space is the ordinary case, not the odd one. */
    @Test
    void surroundingSpaceIsTrimmedOffAConfiguredAddress() {
        assertThat(new ReleaseContact("  sealedbox@example.org\n").email())
                .isEqualTo("sealedbox@example.org");
    }
}
