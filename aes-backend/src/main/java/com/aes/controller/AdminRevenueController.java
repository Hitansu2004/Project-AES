package com.aes.controller;

import com.aes.dto.response.ApiResponse;
import com.aes.service.AdminRevenueService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Live revenue + workforce dashboard endpoint backing
 * {@code /admin/revenue} on the frontend.  Locked down to the
 * owner-tier roles.
 */
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminRevenueController {

    private final AdminRevenueService service;

    @GetMapping("/revenue")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
    public ApiResponse<Map<String, Object>> revenue() {
        return ApiResponse.success(service.dashboard());
    }
}
