package com.aes.repository;

import com.aes.entity.StaffProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * Lookup helpers for {@link StaffProfile} — used by the workload board and
 * the engineer-picker recommendations.
 *
 * <p>Locality / skill matching uses native SQL because Hibernate's JPQL does
 * not understand PostgreSQL array operators (<code>= ANY</code>,
 * <code>&amp;&amp;</code>). The native queries here are intentionally simple
 * — no dynamic SQL building — to keep injection risk at zero.</p>
 */
@Repository
public interface StaffProfileRepository extends JpaRepository<StaffProfile, UUID> {

    /** Every staff member with the on-shift flag toggled on. */
    List<StaffProfile> findByOnShiftTrue();

    /** On-shift staff filtered by branch (e.g. only Hyderabad). */
    List<StaffProfile> findByBranchAndOnShiftTrue(String branch);

    /**
     * Engineers (or any role) on shift whose {@code skills} array contains the
     * requested skill string. Used by the engineer picker to surface relevant
     * candidates.
     */
    @Query(value = """
            SELECT * FROM staff_profiles sp
            WHERE sp.on_shift = TRUE
              AND :skill = ANY(sp.skills)
            """, nativeQuery = true)
    List<StaffProfile> findOnShiftWithSkill(String skill);
}
