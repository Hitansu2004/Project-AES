package com.aes.service;

import com.aes.dto.response.NotificationResponse;
import com.aes.entity.Notification;
import com.aes.entity.User;
import com.aes.enums.NotificationType;
import com.aes.exception.NotFoundException;
import com.aes.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Notification Service — persists in-app notifications, exposes read APIs
 * and pushes a live event over STOMP so the frontend bell updates without
 * a poll.
 *
 * <p>Per Section 14 (lines 2068-2070):</p>
 * <ul>
 *   <li>Push notifications: log to DB, show in-app (no native push for the demo).</li>
 *   <li>Email: log only.</li>
 *   <li>SMS via Twilio: handled by {@link SmsService}.</li>
 * </ul>
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class NotificationService {

    /** Per-user STOMP queue prefix. Subscribe at {@code /topic/users/{userId}/notifications}. */
    private static final String USER_TOPIC_PREFIX = "/topic/users/";

    private final NotificationRepository notificationRepository;
    private final SimpMessagingTemplate messagingTemplate;

    // ────────────────────────────────────────────────────────────────────────
    //  Creation helpers (called from the rest of the codebase)
    // ────────────────────────────────────────────────────────────────────────

    /**
     * Create and persist a notification, then broadcast a "NEW" event over
     * STOMP so the recipient's bell refreshes immediately.
     */
    @Transactional
    public Notification createNotification(UUID userId, String title, String body,
                                           NotificationType type, UUID referenceId,
                                           String referenceType) {
        Notification notification = Notification.builder()
                .user(User.builder().id(userId).build())
                .title(title)
                .body(body)
                .type(type)
                .referenceId(referenceId)
                .referenceType(referenceType)
                .isRead(false)
                .sentSms(false)
                .sentPush(false)
                .build();

        notification = notificationRepository.save(notification);
        log.info("notification {} → user={} ({})",
                type, shortId(userId), title);

        // Live broadcast — only contains the row, never PII beyond the title/body
        // we already chose. The userId is part of the topic, not the payload.
        messagingTemplate.convertAndSend(
                USER_TOPIC_PREFIX + userId + "/notifications",
                toResponse(notification));

        return notification;
    }

    /** Shorthand: notify a single user about a ticket event. */
    @Transactional
    public void notifyUser(UUID userId, String title, String body,
                           NotificationType type, UUID ticketId) {
        createNotification(userId, title, body, type, ticketId, "TICKET");
    }

    /** Shorthand: notify about installation request. */
    @Transactional
    public void notifyInstallation(UUID userId, String title, String body, UUID requestId) {
        createNotification(userId, title, body, NotificationType.INSTALLATION_UPDATE,
                requestId, "INSTALLATION");
    }

    // ────────────────────────────────────────────────────────────────────────
    //  Read APIs
    // ────────────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<NotificationResponse> listForUser(UUID userId, int limit) {
        Page<Notification> page = notificationRepository
                .findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, Math.min(limit, 100)));
        return page.getContent().stream().map(NotificationService::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public long unreadCount(UUID userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }

    @Transactional
    public NotificationResponse markRead(UUID userId, UUID notificationId) {
        Notification n = notificationRepository.findByIdAndUserId(notificationId, userId)
                .orElseThrow(() -> new NotFoundException("Notification", notificationId.toString()));
        if (Boolean.FALSE.equals(n.getIsRead())) {
            n.setIsRead(true);
            n = notificationRepository.save(n);
        }
        return toResponse(n);
    }

    @Transactional
    public int markAllRead(UUID userId) {
        return notificationRepository.markAllReadForUser(userId);
    }

    // ────────────────────────────────────────────────────────────────────────
    //  Mapping
    // ────────────────────────────────────────────────────────────────────────

    private static NotificationResponse toResponse(Notification n) {
        return NotificationResponse.builder()
                .id(n.getId())
                .title(n.getTitle())
                .body(n.getBody())
                .type(n.getType() != null ? n.getType().name() : null)
                .referenceId(n.getReferenceId())
                .referenceType(n.getReferenceType())
                .link(deriveLink(n))
                .read(Boolean.TRUE.equals(n.getIsRead()))
                .createdAt(n.getCreatedAt())
                .build();
    }

    /** Best-effort deep-link the frontend can navigate to. */
    private static String deriveLink(Notification n) {
        if (n.getReferenceType() == null || n.getReferenceId() == null) return null;
        return switch (n.getReferenceType()) {
            case "TICKET"       -> "/tickets";          // referenceId is the ticket UUID; the list page shows it
            case "INSTALLATION" -> "/services/installation";
            case "AMC"          -> "/services/amc";
            default -> null;
        };
    }

    private static String shortId(UUID id) {
        return id == null ? "?" : id.toString().substring(0, 8) + "…";
    }
}
