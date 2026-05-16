package com.towin.admin;

import com.towin.admin.dto.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    // Users
    @GetMapping("/users")
    public ResponseEntity<List<AdminUserResponse>> getUsers() {
        return ResponseEntity.ok(adminService.getAllUsers());
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<Void> deleteUser(Authentication auth, @PathVariable UUID id) {
        UUID adminId = UUID.fromString(auth.getName());
        adminService.deleteUser(adminId, id);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/users/{id}/suspend")
    public ResponseEntity<Void> suspendUser(@PathVariable UUID id) {
        adminService.suspendUser(id);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/users/{id}/unsuspend")
    public ResponseEntity<Void> unsuspendUser(@PathVariable UUID id) {
        adminService.unsuspendUser(id);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/users/{id}/photo")
    public ResponseEntity<Void> deletePhoto(@PathVariable UUID id) {
        adminService.deleteUserPhoto(id);
        return ResponseEntity.ok().build();
    }

    // Verifications
    @GetMapping("/verifications")
    public ResponseEntity<List<AdminVerificationResponse>> getVerifications() {
        return ResponseEntity.ok(adminService.getPendingVerifications());
    }

    @PutMapping("/verifications/{id}/approve")
    public ResponseEntity<Void> approveVerification(@PathVariable UUID id) {
        adminService.approveVerification(id);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/verifications/{id}/reject")
    public ResponseEntity<Void> rejectVerification(@PathVariable UUID id) {
        adminService.rejectVerification(id);
        return ResponseEntity.ok().build();
    }

    // Reports
    @GetMapping("/reports")
    public ResponseEntity<List<AdminReportResponse>> getReports() {
        return ResponseEntity.ok(adminService.getAllReports());
    }

    @DeleteMapping("/reports/{id}")
    public ResponseEntity<Void> deleteReport(@PathVariable UUID id) {
        adminService.deleteReport(id);
        return ResponseEntity.ok().build();
    }

    // Reviews
    @GetMapping("/reviews")
    public ResponseEntity<List<AdminReviewResponse>> getReviews(
            @RequestParam(defaultValue = "false") boolean safetyOnly) {
        return ResponseEntity.ok(adminService.getAllReviews(safetyOnly));
    }

    @DeleteMapping("/reviews/{id}")
    public ResponseEntity<Void> deleteReview(@PathVariable UUID id) {
        adminService.deleteReview(id);
        return ResponseEntity.ok().build();
    }

    // Connections
    @GetMapping("/connections")
    public ResponseEntity<List<AdminConnectionResponse>> getConnections() {
        return ResponseEntity.ok(adminService.getAllConnections());
    }

    @DeleteMapping("/connections/{id}")
    public ResponseEntity<Void> deleteConnection(@PathVariable UUID id) {
        adminService.deleteConnection(id);
        return ResponseEntity.ok().build();
    }

    // Needs
    @GetMapping("/needs")
    public ResponseEntity<List<AdminNeedResponse>> getNeeds() {
        return ResponseEntity.ok(adminService.getAllNeeds());
    }

    @DeleteMapping("/needs/{id}")
    public ResponseEntity<Void> deleteNeed(@PathVariable UUID id) {
        adminService.deleteNeed(id);
        return ResponseEntity.ok().build();
    }

    // Messages
    @GetMapping("/messages")
    public ResponseEntity<List<AdminMessageResponse>> getMessages() {
        return ResponseEntity.ok(adminService.getAllMessages());
    }

    @DeleteMapping("/messages/{id}")
    public ResponseEntity<Void> deleteMessage(@PathVariable UUID id) {
        adminService.deleteMessage(id);
        return ResponseEntity.ok().build();
    }
}
