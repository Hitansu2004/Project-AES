package com.aes.service;

import com.aes.entity.Notification;
import com.aes.entity.User;
import com.aes.enums.NotificationType;
import com.aes.repository.NotificationRepository;
import com.aes.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Notification Service — logs notifications to DB.
 *
 * Per Section 14 (lines 2068-2070):
 *   - Push notifications: log to DB, show in-app
 *   - Email notifications: log only
 *   - SMS via Twilio: send OTP via Twilio API
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;

    /**
     * Create and save a notification to the database.
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
        log.info("Notification created: [{}] {} → user {}", type, title, userId);

        return notification;
    }

    /**
     * Shorthand: notify a single user about a ticket event.
     */
    @Transactional
    public void notifyUser(UUID userId, String title, String body,
                           NotificationType type, UUID ticketId) {
        createNotification(userId, title, body, type, ticketId, "TICKET");
    }

    /**
     * Shorthand: notify about installation request.
     */
    @Transactional
    public void notifyInstallation(UUID userId, String title, String body, UUID requestId) {
        createNotification(userId, title, body, NotificationType.INSTALLATION_UPDATE,
                requestId, "INSTALLATION");
    }
}
