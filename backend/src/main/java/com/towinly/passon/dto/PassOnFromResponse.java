package com.towinly.passon.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;
import java.util.UUID;

/**
 * What one visitor may read of what one elder wrote — the payload behind "From Margaret".
 *
 * {@link #items} carries only what {@code PassOnVisibilityService} allowed for this reader,
 * and never a Sealed box item: those live in another table this endpoint does not touch.
 */
@Getter
@Builder
public class PassOnFromResponse {

    private UUID ownerId;
    /** "From Margaret" — her name as everywhere else in the app. */
    private String ownerName;
    private List<PassOnItemResponse> items;
}
