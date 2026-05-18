package com.aes.entity;

import com.aes.enums.NoteType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * CRM call-log / internal note attached to a ticket.
 *
 * <p>Distinct from {@link TicketActivity} — activities are system-generated
 * lifecycle events; notes are staff-typed comments ("called customer at 11:14,
 * no answer, will retry after lunch"). See PLAN.md §9.2.</p>
 */
@Entity
@Table(name = "ticket_notes")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TicketNote {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ticket_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private ServiceTicket ticket;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private User author;

    @Enumerated(EnumType.STRING)
    @Column(name = "note_type", nullable = false, length = 20)
    @Builder.Default
    private NoteType noteType = NoteType.INTERNAL;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String body;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
