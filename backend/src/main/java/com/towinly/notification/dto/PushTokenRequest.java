package com.towinly.notification.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PushTokenRequest {

    // Expo push tokens read ExponentPushToken[...]; the controller checks the
    // shape so a stray value can never sit in the table looking deliverable.
    @NotBlank
    @Size(max = 300)
    private String token;

    @Size(max = 16)
    private String platform;
}
