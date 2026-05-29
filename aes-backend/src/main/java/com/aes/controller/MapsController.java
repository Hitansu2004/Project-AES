package com.aes.controller;

import com.aes.dto.response.ApiResponse;
import com.aes.entity.ServiceTicket;
import com.aes.exception.NotFoundException;
import com.aes.repository.ServiceTicketRepository;
import com.aes.service.DistanceService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Read-only helpers backed by the Maps APIs we enabled in GCP.
 *
 * <p>Today the only consumer is the engineer route view — given a
 * ticket number, return the AES office origin, customer destination
 * and a ready-to-launch Google Maps Directions URL.</p>
 */
@RestController
@RequestMapping("/api/v1/maps")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class MapsController {

    private final DistanceService distance;
    private final ServiceTicketRepository ticketRepo;

    @GetMapping("/route/{ticketNumber}")
    @Transactional(readOnly = true)
    public ApiResponse<Map<String, Object>> routeForTicket(@PathVariable String ticketNumber) {
        ServiceTicket t = ticketRepo.findByTicketNumber(ticketNumber)
                .orElseThrow(() -> new NotFoundException("Ticket", ticketNumber));

        Double dstLat = t.getServiceLat() != null ? t.getServiceLat()
                : t.getProperty() != null ? t.getProperty().getLatitude() : null;
        Double dstLng = t.getServiceLng() != null ? t.getServiceLng()
                : t.getProperty() != null ? t.getProperty().getLongitude() : null;

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("ticketNumber", ticketNumber);
        body.put("originLat",  distance.getOfficeLat());
        body.put("originLng",  distance.getOfficeLng());
        body.put("originLabel", "AES Office · Banjara Hills");
        if (dstLat != null && dstLng != null) {
            body.put("destLat", dstLat);
            body.put("destLng", dstLng);
            body.put("destAddress", t.getServiceAddress() != null
                    ? t.getServiceAddress()
                    : t.getProperty() != null ? t.getProperty().getFormattedAddress() : "");
            body.put("distanceKm", distance.kmFromOffice(dstLat, dstLng));
            body.put("directionsUrl", distance.directionsUrl(dstLat, dstLng));
        } else {
            body.put("destAddress", t.getProperty() != null
                    ? t.getProperty().getAddressLine1() + ", " + t.getProperty().getCity() : "");
            body.put("directionsUrl",
                    "https://www.google.com/maps/search/?api=1&query=" +
                    java.net.URLEncoder.encode(
                            (t.getProperty() != null ? t.getProperty().getAddressLine1() : ""),
                            java.nio.charset.StandardCharsets.UTF_8));
        }
        return ApiResponse.success(body);
    }
}
