package com.towinly.passon.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;
import java.util.UUID;

/**
 * Everything the last step of setup sends: who she picked, how many of them must agree, and
 * the two sentences she ticked.
 *
 * <h2>The acknowledgements are the wording, not a flag</h2>
 * Both ack fields carry the sentence <em>as it was shown to her</em>, and the server stores a
 * hash of it. A boolean would say she ticked something; it could never say what. "I understand
 * this is not a will" is precisely the sentence somebody will one day dispute, and by then the
 * copy on the page may have been rewritten twice.
 *
 * <h2>No keyholderTarget field</h2>
 * How many Keyholders she is aiming for is the length of {@code personIds}, worked out on the
 * server. Sending both would let a client send a pair that disagree, and the database CHECK
 * that keeps the quorum below the pool would then be enforcing a number nobody chose.
 *
 * <p>There is no owner field either: the box belongs to whoever is signed in.
 */
@Getter @Setter @NoArgsConstructor
public class PassOnArmRequest {

    /**
     * The people she picked, in the order she picked them. Three to five — checked in the
     * service rather than here, because "Please pick at least three people" is a sentence she
     * should read in her own words and not as a field error.
     */
    @NotEmpty(message = "Please pick at least three people")
    private List<UUID> personIds;

    @NotNull(message = "Please choose how many must agree")
    private Integer approvalsNeeded;

    /** The exact sentence beside the first tick box. */
    private String notAWillAck;

    /** The exact sentence beside the second tick box. */
    private String keyTruthAck;
}
