package com.aes.service;

import com.aes.entity.AmcVisit;
import com.aes.entity.User;
import com.aes.enums.NotificationType;
import com.aes.enums.UserRole;
import com.aes.repository.AmcVisitRepository;
import com.aes.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * AMC visit cron jobs (FLOW.md C6, PLAN.md §S5).
 *
 * <ul>
 *   <li>Every hour — flip past-due {@code SCHEDULED} visits to {@code MISSED}
 *       and ping the Ops Manager so they can re-schedule.</li>
 *   <li>Once daily (06:30 IST) — fire a reminder for visits scheduled in
 *       the next 24h (customer + assigned engineer).</li>
 * </ul>
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class AmcVisitScheduler {

    private final AmcVisitRepository visitRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    /** Hourly — mark overdue scheduled visits as MISSED. */
    @Scheduled(fixedDelayString = "${app.amc.overdue-check-ms:3600000}")
    @Transactional
    public void markOverdueAsMissed() {
        LocalDate today = LocalDate.now();
        List<AmcVisit> overdue = visitRepository.findOverdueScheduled(today);
        if (overdue.isEmpty()) return;

        for (AmcVisit v : overdue) {
            v.setStatus("MISSED");
            visitRepository.save(v);
        }
        // Alert ops managers so they can re-schedule.
        String body = overdue.size() + " AMC visit(s) were missed and need re-scheduling.";
        for (User ops : userRepository.findByRoleAndIsActiveTrue(UserRole.OPS_MANAGER)) {
            notificationService.notifyUser(ops.getId(),
                    "AMC visits missed",
                    body,
                    NotificationType.AMC_REMINDER, null);
        }
        log.warn("Marked {} AMC visit(s) MISSED", overdue.size());
    }

    /** Daily 06:30 IST — remind customer + engineer of upcoming visits. */
    @Scheduled(cron = "${app.amc.reminder-cron:0 30 6 * * *}", zone = "Asia/Kolkata")
    @Transactional(readOnly = true)
    public void sendDailyReminders() {
        LocalDate today = LocalDate.now();
        LocalDate tomorrow = today.plusDays(1);
        List<AmcVisit> upcoming = visitRepository.findUpcomingScheduled(today, tomorrow);
        for (AmcVisit v : upcoming) {
            if (v.getContract() == null || v.getContract().getCustomer() == null) continue;
            notificationService.notifyUser(v.getContract().getCustomer().getId(),
                    "AMC visit reminder",
                    "Your AMC visit is scheduled for " + v.getScheduledDate()
                            + (v.getScheduledTimeSlot() != null ? " (" + v.getScheduledTimeSlot() + ")" : "")
                            + ".",
                    NotificationType.AMC_REMINDER, v.getId());
            if (v.getEngineer() != null) {
                notificationService.notifyUser(v.getEngineer().getId(),
                        "AMC visit due tomorrow",
                        "Customer: " + v.getContract().getCustomer().getName()
                                + " — slot " + v.getScheduledTimeSlot(),
                        NotificationType.AMC_REMINDER, v.getId());
            }
        }
        if (!upcoming.isEmpty()) {
            log.info("Sent AMC reminders for {} upcoming visit(s)", upcoming.size());
        }
    }
}
