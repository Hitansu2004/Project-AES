package com.aes.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * WebSocket Service — broadcasts real-time updates via STOMP.
 *
 * <h3>Topic surface</h3>
 * <ul>
 *   <li>{@code /topic/tickets/{ticketNumber}} — per-ticket status changes.</li>
 *   <li>{@code /topic/crm/inbox} — fan-out to every CRM agent (legacy auto-assign flow).</li>
 *   <li>{@code /topic/escalation/dashboard} — L2/L3 escalation events.</li>
 *   <li>{@code /topic/ops/inbox} — Ops Manager triage inbox: new untriaged
 *       items, offer-bounced items, customer escalations. (Phase 2)</li>
 *   <li>{@code /topic/users/{userId}/offers} — per-user assignment offer
 *       events (CRM + engineer share this topic). (Phase 2)</li>
 *   <li>{@code /topic/users/{userId}/notifications} — per-user bell, managed
 *       directly by {@link NotificationService}.</li>
 * </ul>
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class WebSocketService {

    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Broadcast ticket update to /topic/tickets/{ticketNumber}.
     * Per lines 826-834.
     */
    public void broadcastTicketUpdate(String ticketNumber, String event,
                                       int currentLevel, long slaRemainingSeconds,
                                       String assignedTo) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("ticketNumber", ticketNumber);
        payload.put("event", event);
        payload.put("currentLevel", currentLevel);
        payload.put("slaRemainingSeconds", slaRemainingSeconds);
        payload.put("assignedTo", assignedTo);
        payload.put("timestamp", OffsetDateTime.now().toString());

        messagingTemplate.convertAndSend("/topic/tickets/" + ticketNumber, payload);
        log.debug("WebSocket broadcast: {} → {}", ticketNumber, event);
    }

    /**
     * Broadcast new ticket to CRM inbox.
     * Per line 819.
     */
    public void broadcastNewTicketToCrm(String ticketNumber, String priority, String customerName) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("ticketNumber", ticketNumber);
        payload.put("priority", priority);
        payload.put("customerName", customerName);
        payload.put("event", "NEW_TICKET");
        payload.put("timestamp", OffsetDateTime.now().toString());

        messagingTemplate.convertAndSend("/topic/crm/inbox", payload);
        log.debug("WebSocket CRM inbox: new ticket {}", ticketNumber);
    }

    /**
     * Broadcast escalation event to admin dashboard.
     * Per line 820.
     */
    public void broadcastEscalationUpdate(String ticketNumber, int fromLevel, int toLevel) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("ticketNumber", ticketNumber);
        payload.put("event", "ESCALATED_TO_L" + toLevel);
        payload.put("fromLevel", fromLevel);
        payload.put("toLevel", toLevel);
        payload.put("timestamp", OffsetDateTime.now().toString());

        messagingTemplate.convertAndSend("/topic/escalation/dashboard", payload);
        log.debug("WebSocket escalation dashboard: {} L{} → L{}", ticketNumber, fromLevel, toLevel);
    }

    // ────────────────────────────────────────────────────────────────
    //  Phase 2 — Ops Manager triage inbox + per-user offers
    // ────────────────────────────────────────────────────────────────

    /**
     * Fire an event into the Ops Manager triage inbox.
     *
     * @param event short string: {@code NEW_TICKET}, {@code OFFER_BOUNCED},
     *              {@code OFFER_EXPIRED}, {@code CUSTOMER_ESCALATED},
     *              {@code NEW_INSTALL}, {@code TRIAGED}.
     * @param referenceNumber AES-… / INS-… string for the UI to highlight.
     * @param details optional extra payload (priority, reason, etc.). Merged
     *                into the message; pass {@code null} for none.
     */
    public void broadcastOpsInbox(String event, String referenceNumber,
                                   Map<String, Object> details) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("event", event);
        payload.put("referenceNumber", referenceNumber);
        payload.put("timestamp", OffsetDateTime.now().toString());
        if (details != null) {
            payload.putAll(details);
        }
        messagingTemplate.convertAndSend("/topic/ops/inbox", payload);
        log.debug("WebSocket ops inbox: {} {}", event, referenceNumber);
    }

    /**
     * Push an offer event to a single recipient's offer topic. Subscribed by
     * the CRM agent dashboard (Phase 2) and the Site Engineer dashboard
     * (Phase 3) so the "Pending offers" card refreshes instantly.
     *
     * @param userId recipient
     * @param event {@code OFFER_RECEIVED}, {@code OFFER_WITHDRAWN},
     *              {@code OFFER_EXPIRED}.
     * @param payload arbitrary JSON-serialisable map; typically the
     *                {@link com.aes.dto.response.AssignmentOfferResponse}.
     */
    public void broadcastOfferToUser(UUID userId, String event, Object payload) {
        Map<String, Object> wrapper = new HashMap<>();
        wrapper.put("event", event);
        wrapper.put("offer", payload);
        wrapper.put("timestamp", OffsetDateTime.now().toString());
        messagingTemplate.convertAndSend("/topic/users/" + userId + "/offers", wrapper);
        log.debug("WebSocket offers: {} → user {}", event, userId);
    }
}
