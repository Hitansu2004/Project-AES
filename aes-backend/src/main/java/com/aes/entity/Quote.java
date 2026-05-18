package com.aes.entity;

import com.aes.enums.QuoteStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Quote document — line items + totals + approval workflow.
 *
 * <p>Used for two flows (PLAN.md §7.4, FLOW.md C21–C24):</p>
 * <ul>
 *   <li>Installation quote — multiple line items, multi-version negotiation,
 *       SM approval up to ₹2L, Admin above.</li>
 *   <li>P3 service ticket estimate — usually one line, approval band depends
 *       on amount (≤₹500 auto, ₹500–5k CRM, ₹5k–50k SM, &gt;₹50k Admin).</li>
 * </ul>
 *
 * <p>Exactly one of {@code install} / {@code ticket} is non-null; enforced
 * by a DB check constraint in V7.</p>
 */
@Entity
@Table(name = "quotes")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Quote {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "quote_number", nullable = false, unique = true, length = 30)
    private String quoteNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "install_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private InstallationRequest install;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ticket_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private ServiceTicket ticket;

    @Column(nullable = false)
    @Builder.Default
    private Integer version = 1;

    /** JSONB array of {@code [{description, qty, unitPrice, gstPct}, …]}. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "line_items_json", columnDefinition = "jsonb", nullable = false)
    private String lineItemsJson;

    @Column(nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal subtotal = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal tax = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal discount = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal total = BigDecimal.ZERO;

    @Column(name = "valid_until")
    private LocalDate validUntil;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private QuoteStatus status = QuoteStatus.DRAFT;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prepared_by")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private User preparedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private User approvedBy;

    @Column(name = "approved_at")
    private OffsetDateTime approvedAt;

    @Column(name = "sent_at")
    private OffsetDateTime sentAt;

    /** ACCEPTED | REJECTED | NEGOTIATE — null until customer responds. */
    @Column(name = "customer_decision", length = 20)
    private String customerDecision;

    @Column(name = "customer_decided_at")
    private OffsetDateTime customerDecidedAt;

    @Column(name = "customer_response", columnDefinition = "TEXT")
    private String customerResponse;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
