package com.aes.entity;

import com.aes.enums.EscalationType;
import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "ticket_escalation_log")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TicketEscalationLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ticket_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private ServiceTicket ticket;

    @Column(name = "from_level", nullable = false)
    private Integer fromLevel;

    @Column(name = "to_level", nullable = false)
    private Integer toLevel;

    @Column(name = "from_user_id")
    private UUID fromUserId;

    @Column(nullable = false, length = 200)
    private String reason;

    @Enumerated(EnumType.STRING)
    @Column(name = "escalation_type", nullable = false, length = 10)
    private EscalationType escalationType;

    @Column(name = "escalated_at", nullable = false)
    @Builder.Default
    private OffsetDateTime escalatedAt = OffsetDateTime.now();
}
