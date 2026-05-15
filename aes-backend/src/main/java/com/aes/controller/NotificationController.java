package com.aes.controller;

import com.aes.dto.response.ApiResponse;
import com.aes.dto.response.NotificationResponse;
import com.aes.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Notification Controller — in-app notification feed for the bell icon and the
 * dedicated notifications page.
 *
 * <p>Per Section 14 (lines 2068-2070): the demo build keeps notifications
 * in-app + WebSocket only; SMS/push channels remain optional.</p>
 */
@RestController
@RequestMapping("/api/v1/notifications")
@Slf4j
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    /** GET /api/v1/notifications — most recent notifications for the caller. */
    @GetMapping
    public ResponseEntity<ApiResponse<List<NotificationResponse>>> list(
            @AuthenticationPrincipal UUID userId,
            @RequestParam(name = "limit", defaultValue = "50") int limit) {
        return ResponseEntity.ok(ApiResponse.success(
                notificationService.listForUser(userId, limit)));
    }

    /** GET /api/v1/notifications/unread-count — badge counter for the bell. */
    @GetMapping("/unread-count")
    public ResponseEntity<ApiResponse<Map<String, Long>>> unreadCount(
            @AuthenticationPrincipal UUID userId) {
        long count = notificationService.unreadCount(userId);
        return ResponseEntity.ok(ApiResponse.success(Map.of("count", count)));
    }

    /** POST /api/v1/notifications/{id}/read — mark a single notification read. */
    @PostMapping("/{id}/read")
    public ResponseEntity<ApiResponse<NotificationResponse>> markRead(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(
                notificationService.markRead(userId, id)));
    }

    /** POST /api/v1/notifications/read-all — mark every unread notification read. */
    @PostMapping("/read-all")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> markAllRead(
            @AuthenticationPrincipal UUID userId) {
        int updated = notificationService.markAllRead(userId);
        return ResponseEntity.ok(ApiResponse.success(Map.of("updated", updated)));
    }
}
