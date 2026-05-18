package com.aes.controller;

import com.aes.dto.response.ApiResponse;
import com.aes.dto.response.CrmWorkloadDto;
import com.aes.dto.response.EngineerAvailabilityDto;
import com.aes.dto.response.OpsDashboardResponse;
import com.aes.service.TriageService;
import com.aes.service.WorkloadService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Read-only Ops Manager dashboards.
 *
 * <ul>
 *   <li>{@code GET /api/v1/dashboard/ops} — composite single-call payload
 *       (inbox + KPIs + workload + engineer availability). Used by the
 *       Phase 2 Ops Manager home screen.</li>
 *   <li>{@code GET /api/v1/ops/workload/crm} — CRM workload board only.</li>
 *   <li>{@code GET /api/v1/ops/workload/engineers} — engineer availability board.</li>
 * </ul>
 */
@RestController
@Slf4j
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('OPS_MANAGER','ADMIN')")
public class OpsDashboardController {

    private final TriageService triageService;
    private final WorkloadService workloadService;

    @GetMapping("/api/v1/dashboard/ops")
    public ResponseEntity<ApiResponse<OpsDashboardResponse>> dashboard() {
        return ResponseEntity.ok(ApiResponse.success(triageService.getDashboard()));
    }

    @GetMapping("/api/v1/ops/workload/crm")
    public ResponseEntity<ApiResponse<List<CrmWorkloadDto>>> crmWorkload() {
        return ResponseEntity.ok(ApiResponse.success(workloadService.getCrmWorkload()));
    }

    @GetMapping("/api/v1/ops/workload/engineers")
    public ResponseEntity<ApiResponse<List<EngineerAvailabilityDto>>> engineers() {
        return ResponseEntity.ok(ApiResponse.success(workloadService.getEngineerAvailability()));
    }
}
