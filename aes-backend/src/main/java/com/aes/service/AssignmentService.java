package com.aes.service;

import com.aes.entity.User;
import com.aes.enums.UserRole;
import com.aes.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Assignment Service — round-robin assignment for CRM agents and managers.
 *
 * Per Section 8 (line 1743):
 *   AssignmentService.java ← round-robin assignment logic
 *
 * Per Section 4.6 (line 647):
 *   Auto-assign to available CRM agent (round-robin among CRM_AGENT users)
 *
 * Per Section 4.8 (line 768):
 *   Assign to available SERVICE_MANAGER (round-robin)
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class AssignmentService {

    private final UserRepository userRepository;

    // Atomic counters for round-robin
    private final AtomicInteger crmAgentIndex = new AtomicInteger(0);
    private final AtomicInteger managerIndex = new AtomicInteger(0);
    private final AtomicInteger adminIndex = new AtomicInteger(0);

    /**
     * Get next available CRM agent using round-robin.
     * Per line 647.
     */
    public User getNextAvailableCrmAgent() {
        List<User> agents = userRepository.findByRoleAndIsActiveTrue(UserRole.CRM_AGENT);
        if (agents.isEmpty()) {
            log.warn("No active CRM agents found! Falling back to any admin.");
            List<User> admins = userRepository.findByRoleAndIsActiveTrue(UserRole.ADMIN);
            if (admins.isEmpty()) {
                throw new IllegalStateException("No CRM agents or admins available for ticket assignment");
            }
            return admins.get(0);
        }
        int index = Math.abs(crmAgentIndex.getAndIncrement() % agents.size());
        User agent = agents.get(index);
        log.info("Round-robin assigned CRM agent: {} (index {})", agent.getName(), index);
        return agent;
    }

    /**
     * Get next available Service Manager using round-robin.
     * Per line 768.
     */
    public User getNextAvailableManager() {
        List<User> managers = userRepository.findByRoleAndIsActiveTrue(UserRole.SERVICE_MANAGER);
        if (managers.isEmpty()) {
            log.warn("No active Service Managers found! Falling back to admin.");
            List<User> admins = userRepository.findByRoleAndIsActiveTrue(UserRole.ADMIN);
            if (admins.isEmpty()) {
                throw new IllegalStateException("No service managers or admins available for escalation");
            }
            return admins.get(0);
        }
        int index = Math.abs(managerIndex.getAndIncrement() % managers.size());
        User manager = managers.get(index);
        log.info("Round-robin assigned Service Manager: {} (index {})", manager.getName(), index);
        return manager;
    }

    /**
     * Get next available Admin for L3 escalation.
     * Per line 794.
     */
    public User getNextAvailableAdmin() {
        List<User> admins = userRepository.findByRoleAndIsActiveTrue(UserRole.ADMIN);
        if (admins.isEmpty()) {
            throw new IllegalStateException("No admins available for L3 escalation");
        }
        int index = Math.abs(adminIndex.getAndIncrement() % admins.size());
        return admins.get(index);
    }
}
