package com.towin.family.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

/**
 * Body of POST /api/family/requests. {@code side} names the seat the TARGET
 * takes: "family" = caller is the elder adding a family member; "elder" =
 * caller is the family member adding their parent.
 */
@Getter
@Setter
public class FamilyRequest {

    @NotBlank(message = "Please enter a username, email, or phone number")
    @Size(max = 254, message = "That identifier is too long")
    private String identifier;

    @Size(max = 100, message = "Relationship must be 100 characters or fewer")
    private String relationship;

    @NotBlank(message = "Please say who you are adding")
    @Pattern(regexp = "family|elder", message = "side must be 'family' or 'elder'")
    private String side;
}
