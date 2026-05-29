package com.aes.repository;

import com.aes.entity.User;
import com.aes.enums.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByPhoneNumber(String phoneNumber);

    boolean existsByPhoneNumber(String phoneNumber);

    List<User> findByRoleAndIsActiveTrue(UserRole role);

    List<User> findByRole(UserRole role);

    // ── V14 — team & customer-search helpers ────────────────────────────
    List<User> findByTeamNameAndIsActiveTrueOrderByIsTeamLeadDescNameAsc(String teamName);

    @Query("SELECT DISTINCT u.teamName FROM User u " +
           "WHERE u.teamName IS NOT NULL AND u.isActive = true " +
           "ORDER BY u.teamName")
    List<String> findDistinctTeamNames();

    @Query("SELECT u FROM User u WHERE u.role = 'CUSTOMER' AND u.isActive = true " +
           "AND (LOWER(u.name) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "  OR u.phoneNumber LIKE CONCAT('%', :q, '%') " +
           "  OR LOWER(u.email) LIKE LOWER(CONCAT('%', :q, '%'))) " +
           "ORDER BY u.name ASC")
    List<User> searchCustomers(@Param("q") String query);
}
