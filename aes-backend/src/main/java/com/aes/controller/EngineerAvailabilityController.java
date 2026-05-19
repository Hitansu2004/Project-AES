package com.aes.controller;

import com.aes.dto.response.ApiResponse;
import com.aes.dto.response.EngineerAvailabilityDto;
import com.aes.service.WorkloadService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Read-only engineer availability board used by every role that can
 * dispatch work to a site engineer:
 *
 * <ul>
 *   <li>CRM_AGENT — Level-1 paid/AMC tickets (PLAN.md §6 → "Dispatch Engineer")</li>
 *   <li>SERVICE_MANAGER — Level-2 escalated tickets (manual re-routing)</li>
 *   <li>OPS_MANAGER / ADMIN — full board including triage/install dispatch</li>
 * </ul>
 *
 * <p>The payload only exposes counts, on-shift flag, skills and basic
 * profile data — no sensitive fields — so it is safe to widen access
 * beyond the regular Ops Manager dashboards.
 */
@RestController
@Slf4j
@RequiredArgsConstructor
public class EngineerAvailabilityController {

    private final WorkloadService workloadService;

    @GetMapping("/api/v1/ops/workload/engineers")
    @PreAuthorize("hasAnyRole('OPS_MANAGER','ADMIN','CRM_AGENT','SERVICE_MANAGER')")
    public ResponseEntity<ApiResponse<List<EngineerAvailabilityDto>>> engineers() {
        return ResponseEntity.ok(ApiResponse.success(workloadService.getEngineerAvailability()));
    }
}
