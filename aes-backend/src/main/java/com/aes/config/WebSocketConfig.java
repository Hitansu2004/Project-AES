package com.aes.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * WebSocket configuration — STOMP over SockJS.
 *
 * Per Section 4.9 (lines 812-834) and Section 13 (lines 2037-2050):
 *   Endpoint: /ws
 *   Topics: /topic/tickets/{ticketNumber}, /topic/crm/inbox, /topic/escalation/dashboard
 *   App destination prefix: /app
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Per line 2043: endpoint /ws with SockJS fallback
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Per line 2047: enable simple broker on /topic
        config.enableSimpleBroker("/topic");
        // Per line 2048: application destination prefix /app
        config.setApplicationDestinationPrefixes("/app");
    }
}
