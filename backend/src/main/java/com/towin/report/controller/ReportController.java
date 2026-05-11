package com.towin.report.controller;

import com.towin.report.dto.ReportRequest;
import com.towin.report.service.ReportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    @PostMapping
    public ResponseEntity<Void> submitReport(
            Authentication auth,
            @Valid @RequestBody ReportRequest request) {
        UUID userId = UUID.fromString(auth.getName());
        reportService.submitReport(userId, request);
        return ResponseEntity.ok().build();
    }
}
