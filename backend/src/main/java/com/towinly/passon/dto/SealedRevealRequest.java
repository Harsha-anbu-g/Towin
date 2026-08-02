package com.towinly.passon.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * The account password, re-typed, to open one thing in the Sealed box.
 *
 * <p>It is sent in a body rather than the path or a query string because those are written
 * into access logs, browser history and referrer headers, and this one is the password to the
 * whole account.
 *
 * <p>There is deliberately no owner and no item field. The box belongs to whoever is signed
 * in, and the item comes from the path — so nothing here can name a different person's box.
 */
@Getter @Setter @NoArgsConstructor
public class SealedRevealRequest {

    /**
     * Word for word the prompt on the card, so an empty box and a wrong password read as the
     * same kind of thing rather than one being a form error and the other a refusal.
     */
    @NotBlank(message = "Please type your password to see this.")
    private String password;
}
