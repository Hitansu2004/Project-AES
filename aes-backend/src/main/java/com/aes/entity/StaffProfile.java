package com.aes.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Operational metadata for a staff user — branch, shift, skills, workload cap.
 *
 * <p>Backs the Ops Manager workload board and the engineer picker described
 * in PLAN.md §9.1 / §9.2. PK is the {@code user_id} (one row per staff
 * member; customers have no profile).</p>
 *
 * <p>{@code skills} and {@code localities} are stored as PostgreSQL TEXT[]
 * columns; Hibernate 6 maps them via {@code SqlTypes.ARRAY}.</p>
 */
@Entity
@Table(name = "staff_profiles")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StaffProfile {

    /** Same as {@code users.id}. */
    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(nullable = false, length = 50)
    @Builder.Default
    private String branch = "HYDERABAD";

    @Column(name = "on_shift", nullable = false)
    @Builder.Default
    private Boolean onShift = false;

    @Column(name = "shift_start")
    private LocalTime shiftStart;

    @Column(name = "shift_end")
    private LocalTime shiftEnd;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(columnDefinition = "text[]")
    private String[] skills;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(columnDefinition = "text[]")
    private String[] localities;

    @Column(name = "max_concurrent_load", nullable = false)
    @Builder.Default
    private Integer maxConcurrentLoad = 8;

    @Column(name = "avg_resolution_minutes")
    private Integer avgResolutionMinutes;

    @Column(name = "csat_score", precision = 3, scale = 2)
    private BigDecimal csatScore;

    @Column(name = "last_seen_at")
    private OffsetDateTime lastSeenAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
