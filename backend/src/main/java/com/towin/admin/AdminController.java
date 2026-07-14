package com.towin.admin;

import com.towin.admin.dto.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

// Every list here stays a plain array — the panel reads them that way — but each is now
// a bounded page (newest first). ?page=&size= walks the rest.
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    // Demo — reset the public demo accounts to their seeded baseline right away
    @PostMapping("/demo/reset")
    public ResponseEntity<Void> resetDemo() {
        adminService.resetDemoData();
        return ResponseEntity.ok().build();
    }

    // Users
    @GetMapping("/users")
    public ResponseEntity<List<AdminUserResponse>> getUsers(
            @PageableDefault(size = AdminService.DEFAULT_PAGE_SIZE, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(adminService.getAllUsers(pageable));
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
    public ResponseEntity<List<AdminVerificationResponse>> getVerifications(
            @PageableDefault(size = AdminService.DEFAULT_PAGE_SIZE, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(adminService.getPendingVerifications(pageable));
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
    public ResponseEntity<List<AdminReportResponse>> getReports(
            @PageableDefault(size = AdminService.DEFAULT_PAGE_SIZE, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(adminService.getAllReports(pageable));
    }

    @DeleteMapping("/reports/{id}")
    public ResponseEntity<Void> deleteReport(@PathVariable UUID id) {
        adminService.deleteReport(id);
        return ResponseEntity.ok().build();
    }

    // Reviews
    @GetMapping("/reviews")
    public ResponseEntity<List<AdminReviewResponse>> getReviews(
            @RequestParam(defaultValue = "false") boolean safetyOnly,
            @PageableDefault(size = AdminService.DEFAULT_PAGE_SIZE, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(adminService.getAllReviews(safetyOnly, pageable));
    }

    @DeleteMapping("/reviews/{id}")
    public ResponseEntity<Void> deleteReview(@PathVariable UUID id) {
        adminService.deleteReview(id);
        return ResponseEntity.ok().build();
    }

    // Connections
    @GetMapping("/connections")
    public ResponseEntity<List<AdminConnectionResponse>> getConnections(
            @PageableDefault(size = AdminService.DEFAULT_PAGE_SIZE, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(adminService.getAllConnections(pageable));
    }

    @DeleteMapping("/connections/{id}")
    public ResponseEntity<Void> deleteConnection(@PathVariable UUID id) {
        adminService.deleteConnection(id);
        return ResponseEntity.ok().build();
    }

    // Needs
    @GetMapping("/needs")
    public ResponseEntity<List<AdminNeedResponse>> getNeeds(
            @PageableDefault(size = AdminService.DEFAULT_PAGE_SIZE, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(adminService.getAllNeeds(pageable));
    }

    @DeleteMapping("/needs/{id}")
    public ResponseEntity<Void> deleteNeed(@PathVariable UUID id) {
        adminService.deleteNeed(id);
        return ResponseEntity.ok().build();
    }

    // Messages
    @GetMapping("/messages")
    public ResponseEntity<List<AdminMessageResponse>> getMessages(
            @PageableDefault(size = AdminService.DEFAULT_PAGE_SIZE, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(adminService.getAllMessages(pageable));
    }

    @DeleteMapping("/messages/{id}")
    public ResponseEntity<Void> deleteMessage(@PathVariable UUID id) {
        adminService.deleteMessage(id);
        return ResponseEntity.ok().build();
    }
}
