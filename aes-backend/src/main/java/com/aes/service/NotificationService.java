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
import java.util.regex.Matcher;
import java.util.regex.Pattern;

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

    /**
     * Best-effort deep-link the frontend can navigate to.
     *
     * <p>We never need the entity from the DB: every notification we create
     * already embeds the human-readable identifier inside the title or body
     * (e.g. {@code "INS-2026-2201"} / {@code "AES-2026-0123"} / {@code "QUO-…"}),
     * so a single regex over title+body produces a precise deep-link to the
     * correct detail screen, falling back to the matching list page when the
     * number cannot be parsed.</p>
     */
    private static final Pattern TICKET_NUMBER_RE  = Pattern.compile("(AES-\\d{4}-\\d{3,})");
    private static final Pattern INSTALL_NUMBER_RE = Pattern.compile("(INS-\\d{4}-\\d{3,})");
    private static final Pattern QUOTE_NUMBER_RE   = Pattern.compile("(QUO-\\d{4}-\\d{3,})");

    private static String deriveLink(Notification n) {
        if (n.getReferenceType() == null) return null;
        String haystack = (n.getTitle() == null ? "" : n.getTitle())
                + " " + (n.getBody() == null ? "" : n.getBody());

        return switch (n.getReferenceType()) {
            case "TICKET" -> {
                Matcher m = TICKET_NUMBER_RE.matcher(haystack);
                yield m.find() ? "/tickets/" + m.group(1) : "/tickets";
            }
            case "INSTALLATION" -> {
                Matcher m = INSTALL_NUMBER_RE.matcher(haystack);
                yield m.find() ? "/installations/" + m.group(1) : "/installations";
            }
            case "QUOTE" -> {
                // Quotes always live on a ticket — prefer that deep link if present.
                Matcher t = TICKET_NUMBER_RE.matcher(haystack);
                if (t.find()) yield "/tickets/" + t.group(1);
                Matcher q = QUOTE_NUMBER_RE.matcher(haystack);
                yield q.find() ? "/tickets" : "/tickets";
            }
            case "PART_REQUEST" -> {
                Matcher m = TICKET_NUMBER_RE.matcher(haystack);
                yield m.find() ? "/tickets/" + m.group(1) : "/tickets";
            }
            case "AMC" -> "/services/amc";
            default -> null;
        };
    }

    private static String shortId(UUID id) {
        return id == null ? "?" : id.toString().substring(0, 8) + "…";
    }
}
