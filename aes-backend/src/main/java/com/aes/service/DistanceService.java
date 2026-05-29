package com.aes.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Distance + driving-route lookups for the dynamic-pricing engine and
 * the engineer route view.
 *
 * <p><b>Two-tier strategy.</b>  We always try Google Distance Matrix
 * first (when an API key is configured) for an accurate driving
 * distance.  If the key is missing, the call fails, or quota is
 * exhausted, we silently fall back to the Haversine straight-line
 * formula × 1.3 (a reasonable average detour ratio for urban India).
 * This keeps the pricing calculator working in demo mode without
 * Google Maps and lets us scale up to real traffic-aware numbers
 * with one config change.</p>
 */
@Slf4j
@Service
public class DistanceService {

    private static final double EARTH_RADIUS_KM = 6371.0;
    /** Empirical multiplier — straight-line × 1.3 ≈ driving distance. */
    private static final double DETOUR_RATIO = 1.30;

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(4))
            .build();

    @Value("${app.google.maps-key:}")
    private String mapsKey;

    @Value("${app.aes.office.lat:17.4156}")
    private double officeLat;

    @Value("${app.aes.office.lng:78.4347}")
    private double officeLng;

    /** Driving distance from AES office → customer (in km). */
    public BigDecimal kmFromOffice(double destLat, double destLng) {
        return kmBetween(officeLat, officeLng, destLat, destLng);
    }

    public BigDecimal kmBetween(double srcLat, double srcLng, double dstLat, double dstLng) {
        if (mapsKey != null && !mapsKey.isBlank()) {
            BigDecimal viaGoogle = tryGoogleDistance(srcLat, srcLng, dstLat, dstLng);
            if (viaGoogle != null) return viaGoogle;
        }
        return haversineKm(srcLat, srcLng, dstLat, dstLng)
                .multiply(BigDecimal.valueOf(DETOUR_RATIO))
                .setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * Public Google Maps Directions URL — safe to embed in the engineer
     * dashboard so the field tech can launch turn-by-turn navigation
     * in the device's native Maps app.  Costs nothing (no API call).
     */
    public String directionsUrl(double dstLat, double dstLng) {
        return "https://www.google.com/maps/dir/?api=1"
                + "&origin=" + officeLat + "," + officeLng
                + "&destination=" + dstLat + "," + dstLng
                + "&travelmode=driving";
    }

    public double getOfficeLat() { return officeLat; }
    public double getOfficeLng() { return officeLng; }

    // ── Internals ────────────────────────────────────────────────

    private BigDecimal tryGoogleDistance(double srcLat, double srcLng,
                                         double dstLat, double dstLng) {
        try {
            URI uri = UriComponentsBuilder
                    .fromHttpUrl("https://maps.googleapis.com/maps/api/distancematrix/json")
                    .queryParam("origins", srcLat + "," + srcLng)
                    .queryParam("destinations", dstLat + "," + dstLng)
                    .queryParam("units", "metric")
                    .queryParam("mode", "driving")
                    .queryParam("key", mapsKey)
                    .build(true)
                    .toUri();

            HttpRequest req = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(6))
                    .GET()
                    .build();

            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() != 200) {
                log.warn("Distance Matrix API status={} body={}", res.statusCode(), res.body());
                return null;
            }
            JsonNode root = mapper.readTree(res.body());
            String topStatus = root.path("status").asText("");
            if (!"OK".equals(topStatus)) {
                log.warn("Distance Matrix top-level status={}", topStatus);
                return null;
            }
            JsonNode element = root.path("rows").path(0).path("elements").path(0);
            if (!"OK".equals(element.path("status").asText(""))) return null;
            int metres = element.path("distance").path("value").asInt(-1);
            if (metres < 0) return null;
            return BigDecimal.valueOf(metres / 1000.0).setScale(2, RoundingMode.HALF_UP);
        } catch (Exception e) {
            log.warn("Distance Matrix call failed — falling back to Haversine: {}", e.getMessage());
            return null;
        }
    }

    private BigDecimal haversineKm(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                 + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                 * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return BigDecimal.valueOf(EARTH_RADIUS_KM * c).setScale(2, RoundingMode.HALF_UP);
    }
}
