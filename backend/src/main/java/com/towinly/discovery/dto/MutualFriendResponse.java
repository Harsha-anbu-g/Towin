package com.towinly.discovery.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Someone from the viewer's own circle who links them to a suggested person.
 * Only people the viewer already knows are ever named here.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MutualFriendResponse {

    public enum Relation {
        /** One of the viewer's family members, who already knows this person. */
        FAMILY,
        /** One of the viewer's friends, who is also this person's friend. */
        FRIEND,
        /** One of the viewer's friends, who knows someone this person knows. */
        THROUGH
    }

    private UUID userId;
    private String name;
    private Relation relation;
    /** For FAMILY: the link's own word, such as "daughter". Otherwise null. */
    private String relationship;
}
