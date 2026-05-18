package com.aes.entity;

import com.aes.enums.ProblemCategory;
import com.aes.enums.Priority;
import com.aes.enums.ServiceType;
import com.aes.enums.TicketStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "service_tickets")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ServiceTicket {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "ticket_number", nullable = false, unique = true, length = 20)
    private String ticketNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private User customer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Property property;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ac_unit_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private AcUnit acUnit;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 5)
    private Priority priority;

    @Enumerated(EnumType.STRING)
    @Column(name = "service_type", nullable = false, length = 20)
    private ServiceType serviceType;

    @Enumerated(EnumType.STRING)
    @Column(name = "problem_category", nullable = false, length = 30)
    private ProblemCategory problemCategory;

    @Column(name = "error_code", length = 10)
    private String errorCode;

    @Column(name = "problem_description", columnDefinition = "TEXT")
    private String problemDescription;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "photos_json", columnDefinition = "jsonb")
    private String photosJson;

    @Column(name = "scheduled_date")
    private LocalDate scheduledDate;

    @Column(name = "scheduled_slot", length = 20)
    private String scheduledSlot;

    // Current assignment
    @Column(name = "current_level", nullable = false)
    @Builder.Default
    private Integer currentLevel = 1;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "current_assignee_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private User currentAssignee;

    @Column(name = "assigned_at")
    private OffsetDateTime assignedAt;

    // Status
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    @Builder.Default
    private TicketStatus status = TicketStatus.OPEN;

    // SLA tracking
    @Column(name = "sla_deadline_l1")
    private OffsetDateTime slaDeadlineL1;

    @Column(name = "sla_deadline_l2")
    private OffsetDateTime slaDeadlineL2;

    @Column(name = "sla_deadline_final")
    private OffsetDateTime slaDeadlineFinal;

    @Column(name = "acknowledged_at")
    private OffsetDateTime acknowledgedAt;

    @Column(name = "resolved_at")
    private OffsetDateTime resolvedAt;

    @Column(name = "closed_at")
    private OffsetDateTime closedAt;

    // Charges (P3 only)
    @Column(name = "estimated_charge", precision = 10, scale = 2)
    private BigDecimal estimatedCharge;

    @Column(name = "final_charge", precision = 10, scale = 2)
    private BigDecimal finalCharge;

    @Column(name = "charge_accepted")
    private Boolean chargeAccepted;

    // Rating
    @Column(name = "customer_rating")
    private Integer customerRating;

    @Column(name = "customer_feedback", columnDefinition = "TEXT")
    private String customerFeedback;

    // ── Workflow re-design (V7) ────────────────────────────────────
    /** When the Ops Manager triaged this ticket (null = still untriaged). */
    @Column(name = "triage_at")
    private OffsetDateTime triageAt;

    /** Ops Manager who triaged it. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "triaged_by")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private User triagedBy;

    /** Field engineer dispatched for the on-site job (distinct from currentAssignee). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "engineer_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private User engineer;

    @Column(name = "engineer_accepted_at")
    private OffsetDateTime engineerAcceptedAt;

    @Column(name = "en_route_at")
    private OffsetDateTime enRouteAt;

    @Column(name = "on_site_at")
    private OffsetDateTime onSiteAt;

    /** Operating branch — Hyderabad / Tirupati / Bangalore / Goa. */
    @Column(length = 50)
    @Builder.Default
    private String branch = "HYDERABAD";

    /** Soft-filter locality used by the engineer picker. */
    @Column(length = 100)
    private String locality;

    /** Reason picker value when a customer triggers a T1 escalation. */
    @Column(name = "escalation_reason", length = 40)
    private String escalationReason;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    // Relationships
    @OneToMany(mappedBy = "ticket", fetch = FetchType.LAZY)
    @Builder.Default
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<TicketActivity> activities = new ArrayList<>();

    @OneToMany(mappedBy = "ticket", fetch = FetchType.LAZY)
    @Builder.Default
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<TicketEscalationLog> escalationLogs = new ArrayList<>();
}
