package com.towin.common.exception;

import com.towin.common.dto.ErrorResponse;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void missingResource_returns404NotBadRequest() {
        ResponseEntity<ErrorResponse> response = handler.handleIllegalArgument(
                new IllegalArgumentException("Need not found: 4a1c2f00-0000-0000-0000-000000000000"));

        assertThat(response.getStatusCode().value()).isEqualTo(404);
        // The raw message (with the internal id) must not be echoed back.
        assertThat(response.getBody().getMessage()).doesNotContain("4a1c2f00");
    }

    @Test
    void missingUser_returns404() {
        ResponseEntity<ErrorResponse> response = handler.handleIllegalArgument(
                new IllegalArgumentException("User not found"));

        assertThat(response.getStatusCode().value()).isEqualTo(404);
    }

    @Test
    void businessRuleViolation_stays400WithSafeMessage() {
        ResponseEntity<ErrorResponse> response = handler.handleIllegalArgument(
                new IllegalArgumentException("Username already taken"));

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(response.getBody().getMessage()).contains("Username already taken");
    }

    @Test
    void unknownMessage_stays400AndIsNotEchoed() {
        ResponseEntity<ErrorResponse> response = handler.handleIllegalArgument(
                new IllegalArgumentException("java.sql.SQLException: internal detail"));

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(response.getBody().getMessage()).isEqualTo("Invalid request.");
    }
}
