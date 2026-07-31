package com.towinly.passon.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Yes or no to holding a key. Shaped like {@code FamilyRespondRequest}, so both of the app's
 * "somebody is asking you something" answers are sent the same way.
 *
 * Boxed rather than primitive on purpose: a missing field must be rejected outright, not read
 * as "no". Somebody's answer about a death is not a value to default.
 */
@Getter @Setter @NoArgsConstructor
public class KeyholderRespondRequest {

    @NotNull(message = "Please answer yes or no.")
    private Boolean accept;
}
