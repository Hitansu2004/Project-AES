package com.aes.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * WebSocket Service — broadcasts real-time updates via STOMP.
 *
 * Per Section 4.9 (lines 812-834):
 *   /topic/tickets/{ticketNumber}   → ticket status changes
 *   /topic/crm/inbox               → new tickets for CRM agents
 *   /topic/escalation/dashboard    → admin escalation updates
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
}
