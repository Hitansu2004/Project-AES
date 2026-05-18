package com.aes.dto.request;

import lombok.Data;

import java.time.LocalDate;

/**
 * Body for {@code POST /api/v1/parts/{id}/ordered} — vendor PO raised,
 * with an optional expected-delivery date.
 */
@Data
public class OrderPartRequest {
    private LocalDate expectedDelivery;
}
