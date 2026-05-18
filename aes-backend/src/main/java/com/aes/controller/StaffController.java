package com.aes.controller;

import com.aes.dto.request.ShiftToggleRequest;
import com.aes.dto.response.ApiResponse;
import com.aes.entity.StaffProfile;
import com.aes.service.StaffShiftService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Staff self-service — shift toggle, profile (PLAN.md §10.4 + FLOW.md C20).
 */
@RestController
@RequestMapping("/api/v1/staff")
@Slf4j
@RequiredArgsConstructor
public class StaffController {

    private final StaffShiftService shiftService;

    @PutMapping("/me/shift")
    @PreAuthorize("hasAnyRole('CRM_AGENT','SERVICE_MANAGER','OPS_MANAGER','SITE_ENGINEER','ADMIN')")
    public ResponseEntity<ApiResponse<StaffProfile>> toggleShift(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody ShiftToggleRequest req) {
        var profile = shiftService.toggle(userId, req.getOnShift(), req.getNote());
        return ResponseEntity.ok(ApiResponse.success(profile,
                Boolean.TRUE.equals(req.getOnShift()) ? "On shift" : "Off shift — handoff complete"));
    }
}
