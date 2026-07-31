package com.towinly.passon.dto;

import com.towinly.common.enums.PassOnAudience;
import com.towinly.common.enums.PassOnKind;
import com.towinly.common.enums.PassOnRelease;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One story or letter, as sent to a screen. Used both on the elder's own page and on a
 * visitor's, because a visitor is only ever handed items {@code PassOnVisibilityService}
 * has already said they may read — so there is nothing on this shape to hold back.
 */
@Getter
@Builder
public class PassOnItemResponse {

    private UUID id;
    private PassOnKind kind;
    private String title;
    private String body;
    private String photoUrl;
    private PassOnAudience audience;
    /** Set only for a letter, or a story written for one person. */
    private UUID audienceUserId;
    /** That person's name, so a screen can say "To Sarah" without a second lookup. */
    private String audienceUserName;
    private PassOnRelease releaseWhen;
    /** "Sarah read this on 3 June" — null until the person it names opens it. */
    private LocalDateTime firstReadAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
