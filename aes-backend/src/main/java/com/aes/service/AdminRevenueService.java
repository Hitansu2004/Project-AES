package com.aes.service;

import com.aes.repository.ServiceTicketRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Read-only roll-ups for the Super Admin / Admin "Revenue" dashboard.
 *
 * <p>All numbers come from {@code service_tickets.total_charge} where
 * {@code payment_status = 'PAID'}.  The query batches the today /
 * week / month / year / total totals into a single SQL round-trip and
 * also returns a recent-transactions feed for the live table on the
 * frontend.</p>
 */
@Service
@RequiredArgsConstructor
public class AdminRevenueService {

    private final ServiceTicketRepository ticketRepo;

    @PersistenceContext
    private EntityManager em;

    @Transactional(readOnly = true)
    public Map<String, Object> dashboard() {
        LocalDate today = LocalDate.now();
        LocalDate weekStart  = today.minusDays(today.getDayOfWeek().getValue() - 1L);  // Mon
        LocalDate monthStart = today.withDayOfMonth(1);
        LocalDate yearStart  = today.withDayOfYear(1);
        ZoneId zone = ZoneId.systemDefault();

        // ── One-shot KPI roll-up ───────────────────────────────────
        Object[] row = (Object[]) em.createNativeQuery("""
                SELECT
                  COALESCE(SUM(CASE WHEN paid_at >= :todayStart THEN total_charge END), 0) AS today,
                  COALESCE(SUM(CASE WHEN paid_at >= :weekStart  THEN total_charge END), 0) AS this_week,
                  COALESCE(SUM(CASE WHEN paid_at >= :monthStart THEN total_charge END), 0) AS this_month,
                  COALESCE(SUM(CASE WHEN paid_at >= :yearStart  THEN total_charge END), 0) AS this_year,
                  COALESCE(SUM(total_charge), 0)                                            AS lifetime,
                  COUNT(*)                                                                  AS paid_count
                FROM service_tickets
                WHERE payment_status = 'PAID'
                  AND total_charge IS NOT NULL
                """)
                .setParameter("todayStart", today.atStartOfDay(zone).toOffsetDateTime())
                .setParameter("weekStart",  weekStart.atStartOfDay(zone).toOffsetDateTime())
                .setParameter("monthStart", monthStart.atStartOfDay(zone).toOffsetDateTime())
                .setParameter("yearStart",  yearStart.atStartOfDay(zone).toOffsetDateTime())
                .getSingleResult();

        long today_      = ((Number) row[0]).longValue();
        long thisWeek    = ((Number) row[1]).longValue();
        long thisMonth   = ((Number) row[2]).longValue();
        long thisYear    = ((Number) row[3]).longValue();
        long lifetime    = ((Number) row[4]).longValue();
        long paidCount   = ((Number) row[5]).longValue();

        // ── Recent transactions feed ───────────────────────────────
        @SuppressWarnings("unchecked")
        List<Object[]> recent = em.createNativeQuery("""
                SELECT t.ticket_number, t.paid_at, t.total_charge,
                       t.payment_method, t.payment_ref,
                       u.name, u.phone_number, t.priority,
                       t.assigned_team_name
                FROM service_tickets t
                JOIN users u ON u.id = t.customer_id
                WHERE t.payment_status = 'PAID' AND t.paid_at IS NOT NULL
                ORDER BY t.paid_at DESC
                LIMIT 30
                """).getResultList();

        List<Map<String, Object>> txns = new ArrayList<>();
        for (Object[] r : recent) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("ticketNumber", r[0]);
            m.put("paidAt",       r[1] == null ? null : r[1].toString());
            m.put("amount",       r[2]);
            m.put("method",       r[3]);
            m.put("reference",    r[4]);
            m.put("customerName", r[5]);
            m.put("customerPhone", r[6]);
            m.put("priority",     r[7]);
            m.put("team",         r[8]);
            txns.add(m);
        }

        // ── Team workload roll-up ──────────────────────────────────
        @SuppressWarnings("unchecked")
        List<Object[]> teams = em.createNativeQuery("""
                SELECT assigned_team_name,
                       COUNT(*)                                                                 AS active,
                       COALESCE(SUM(CASE WHEN status='RESOLVED' AND resolved_at >= :since
                                         THEN 1 ELSE 0 END), 0)                                AS resolved_today,
                       COALESCE(SUM(CASE WHEN payment_status='PAID' AND paid_at >= :since
                                         THEN total_charge ELSE 0 END), 0)                     AS revenue_today
                FROM service_tickets
                WHERE assigned_team_name IS NOT NULL
                  AND (status NOT IN ('RESOLVED','CLOSED','CANCELLED')
                       OR resolved_at >= :since
                       OR (payment_status='PAID' AND paid_at >= :since))
                GROUP BY assigned_team_name
                ORDER BY assigned_team_name
                """)
                .setParameter("since", today.atStartOfDay(zone).toOffsetDateTime())
                .getResultList();
        List<Map<String, Object>> teamRows = new ArrayList<>();
        for (Object[] r : teams) {
            teamRows.add(Map.of(
                    "teamName",       r[0],
                    "activeTickets",  r[1],
                    "resolvedToday",  r[2],
                    "revenueToday",   r[3]
            ));
        }

        // ── Engineer-on-shift snapshot (super admin "who's where") ─
        @SuppressWarnings("unchecked")
        List<Object[]> engineers = em.createNativeQuery("""
                SELECT u.id, u.name, u.team_name,
                       COALESCE(sp.on_shift, FALSE) AS on_shift,
                       (SELECT COUNT(*) FROM service_tickets t
                        WHERE t.engineer_id = u.id
                          AND t.status NOT IN ('RESOLVED','CLOSED','CANCELLED'))     AS active_jobs
                FROM users u
                LEFT JOIN staff_profiles sp ON sp.user_id = u.id
                WHERE u.role = 'SITE_ENGINEER' AND u.is_active = TRUE
                ORDER BY u.team_name NULLS LAST, u.name
                """).getResultList();
        List<Map<String, Object>> engineerRows = new ArrayList<>();
        for (Object[] r : engineers) {
            engineerRows.add(Map.of(
                    "id",        r[0].toString(),
                    "name",      r[1],
                    "teamName",  r[2] == null ? "" : r[2],
                    "onShift",   r[3],
                    "activeJobs", r[4]
            ));
        }

        Map<String, Object> kpi = new LinkedHashMap<>();
        kpi.put("today",     today_);
        kpi.put("thisWeek",  thisWeek);
        kpi.put("thisMonth", thisMonth);
        kpi.put("thisYear",  thisYear);
        kpi.put("lifetime",  lifetime);
        kpi.put("paidCount", paidCount);
        kpi.put("avgTicket", paidCount == 0 ? BigDecimal.ZERO :
                BigDecimal.valueOf(lifetime).divide(BigDecimal.valueOf(paidCount), 0,
                        java.math.RoundingMode.HALF_UP));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("kpi",          kpi);
        out.put("transactions", txns);
        out.put("teams",        teamRows);
        out.put("engineers",    engineerRows);
        out.put("openTickets",  ticketRepo.countActive());
        out.put("criticalOpen", ticketRepo.countActiveCritical());
        out.put("generatedAt",  LocalDateTime.now().toString());
        return out;
    }
}
