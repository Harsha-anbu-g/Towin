package com.towinly.passon.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/** Who the elder is asking. The asker always comes from the session, never from here. */
@Getter @Setter @NoArgsConstructor
public class KeyholderInviteRequest {

    @NotNull(message = "Please choose who to ask.")
    private UUID personId;
}
