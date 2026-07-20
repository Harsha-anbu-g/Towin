package com.towin.family.dto;

import com.towin.common.enums.DelegatedPower;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Set;

/**
 * The parent saying, in full, what this family member may do for them.
 *
 * The whole set is sent every time rather than one power at a time, so the call
 * is a straight replace: anything missing from the list is revoked. That keeps
 * "take it all back" as a single request with an empty list, and leaves no way
 * for a half-applied update to leave a power switched on by accident.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FamilyPowersRequest {
    /** Null or empty means: they may do nothing for me. */
    private Set<DelegatedPower> powers;
}
