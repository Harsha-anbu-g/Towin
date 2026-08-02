package com.towinly.passon.dto;

import com.towinly.common.enums.SealedKind;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

/**
 * One thing going into the Sealed box, as the elder typed it.
 *
 * Both fields are encrypted before anything is written, including the name. A readable
 * "Where the cash is hidden" beside the ciphertext, attached to a named elderly person at a
 * known address, would turn a database leak into a burglary list.
 *
 * There is deliberately no owner field: the box belongs to whoever is signed in, and no
 * request may name a different one.
 */
@Getter
@Setter
public class SealedItemRequest {

    @NotBlank(message = "Please give it a name")
    @Size(max = 120, message = "That name is a little long. Please use 120 letters or fewer.")
    private String label;

    @NotBlank(message = "Please write something before you save it")
    @Size(max = 20000, message = "That is longer than we can save. Please shorten it a little.")
    private String body;

    /** The one readable thing about the item: a chip, carrying no name, address or amount. */
    @NotNull(message = "Please choose what kind of thing this is")
    private SealedKind kindHint;
}
