package com.towinly.passon.dto;

import com.towinly.common.enums.PassOnAudience;
import com.towinly.common.enums.PassOnKind;
import com.towinly.common.enums.PassOnRelease;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

/**
 * Body of POST and PUT /api/passon/items — one story or one letter as the elder wrote it.
 *
 * There is deliberately no owner field. The writer always comes from the signed-in session,
 * so nothing posted here can put words in somebody else's mouth.
 */
@Getter
@Setter
public class PassOnItemRequest {

    /** Ignored on an edit: a story never becomes a letter, and a letter never becomes a story. */
    @NotNull(message = "Please say whether this is a story or a letter")
    private PassOnKind kind;

    @NotBlank(message = "Please give it a name")
    @Size(max = 120, message = "That name is a little long. Please use 120 letters or fewer.")
    private String title;

    @NotBlank(message = "Please write something before you save it")
    @Size(max = 20000, message = "That is longer than we can save. Please shorten it a little.")
    private String body;

    @Size(max = 500, message = "We couldn't save that photo. Please try adding it again.")
    private String photoUrl;

    @NotNull(message = "Please choose who should see this")
    private PassOnAudience audience;

    /** The one person this is for. Kept only when {@link #audience} is PERSON. */
    private UUID audienceUserId;

    /** Left out means "they can read it now", which is the only choice v1 offers. */
    private PassOnRelease releaseWhen;
}
