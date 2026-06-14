package com.towin.auth.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Getter;

@Getter
@JsonInclude(JsonInclude.Include.NON_NULL)
public class OAuthExchangeResponse {

    private final String status;
    private final String token;
    private final String onboardingToken;
    private final String email;
    private final String name;

    private OAuthExchangeResponse(String status, String token,
                                   String onboardingToken, String email, String name) {
        this.status = status;
        this.token = token;
        this.onboardingToken = onboardingToken;
        this.email = email;
        this.name = name;
    }

    public static OAuthExchangeResponse ready(String token) {
        return new OAuthExchangeResponse("READY", token, null, null, null);
    }

    public static OAuthExchangeResponse needsOnboarding(String onboardingToken, String email, String name) {
        return new OAuthExchangeResponse("NEEDS_ONBOARDING", null, onboardingToken, email, name);
    }
}
