package com.aes.service;

import com.aes.entity.User;
import com.aes.enums.UserRole;
import com.aes.exception.BusinessException;
import com.aes.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Round-robin assignment service for CRM agents, service managers and admins.
 *
 * <p>Per Section 4.6 (line 647) — new tickets are auto-assigned to the next
 * available CRM agent. Per Section 4.8 (lines 768, 794) — escalations cycle
 * through service managers and admins respectively.</p>
 *
 * <p>The {@link AtomicInteger} counters give a thread-safe round-robin index
 * across concurrent requests (the escalation scheduler and the ticket-creation
 * controller can run simultaneously).</p>
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class AssignmentService {

    private final UserRepository userRepository;

    private final AtomicInteger crmAgentIndex = new AtomicInteger(0);
    private final AtomicInteger managerIndex = new AtomicInteger(0);
    private final AtomicInteger adminIndex = new AtomicInteger(0);

    /** Section 4.6 line 647 — pick the next available CRM agent for a new ticket. */
    public User getNextAvailableCrmAgent() {
        return pickRoundRobin(UserRole.CRM_AGENT, crmAgentIndex,
                "No active CRM agents are available to handle this ticket. Please contact admin.");
    }

    /** Section 4.8 line 768 — pick the next available service manager for L2 escalation. */
    public User getNextAvailableManager() {
        try {
            return pickRoundRobin(UserRole.SERVICE_MANAGER, managerIndex,
                    "No active service managers are available for L2 escalation.");
        } catch (BusinessException ex) {
            // Fail-safe: fall back to an admin so a critical ticket never goes unassigned.
            User fallback = firstActiveOrThrow(UserRole.ADMIN, ex.getMessage());
            log.warn("L2 escalation falling back to admin {} (no service managers available)", fallback.getName());
            return fallback;
        }
    }

    /** Section 4.8 line 794 — pick the next available admin for L3 escalation. */
    public User getNextAvailableAdmin() {
        return pickRoundRobin(UserRole.ADMIN, adminIndex,
                "No active admins are available for L3 escalation.");
    }

    private User pickRoundRobin(UserRole role, AtomicInteger counter, String emptyMessage) {
        List<User> pool = userRepository.findByRoleAndIsActiveTrue(role);
        if (pool.isEmpty()) {
            throw new BusinessException("NO_STAFF_AVAILABLE", emptyMessage,
                    HttpStatus.SERVICE_UNAVAILABLE);
        }
        // & 0x7FFFFFFF clears the sign bit so the index is always non-negative
        // even after AtomicInteger wraps past Integer.MAX_VALUE.
        int index = (counter.getAndIncrement() & 0x7FFFFFFF) % pool.size();
        User chosen = pool.get(index);
        log.debug("Round-robin assignment {} → {} (index {} of {})",
                role, chosen.getName(), index, pool.size());
        return chosen;
    }

    private User firstActiveOrThrow(UserRole role, String emptyMessage) {
        List<User> pool = userRepository.findByRoleAndIsActiveTrue(role);
        if (pool.isEmpty()) {
            throw new BusinessException("NO_STAFF_AVAILABLE", emptyMessage,
                    HttpStatus.SERVICE_UNAVAILABLE);
        }
        return pool.get(0);
    }
}
