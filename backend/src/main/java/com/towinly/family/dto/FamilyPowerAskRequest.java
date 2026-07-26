package com.towinly.family.dto;

import com.towinly.common.enums.DelegatedPower;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

/**
 * Body of POST /api/family/links/{linkId}/power-requests — one power per ask,
 * deliberately not {@link FamilyPowersRequest}: that one replaces the whole
 * grant set, while an ask is a single question for the elder to answer.
 */
@Getter
@Setter
public class FamilyPowerAskRequest {

    @NotNull(message = "Please say which power you are asking about")
    private DelegatedPower power;
}
