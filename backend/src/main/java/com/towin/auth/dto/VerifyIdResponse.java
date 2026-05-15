package com.towin.auth.dto;

import lombok.Builder;
import lombok.Data;

@Data @Builder
public class VerifyIdResponse {
    private String documentUrl;
    private String verificationStatus;
}
