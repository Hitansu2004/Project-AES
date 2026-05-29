'use client';

/**
 * Swiggy/Zomato-style address picker.
 *
 * Built on Google Maps Platform's **new** Places library:
 *
 *   - {@code AutocompleteSuggestion.fetchAutocompleteSuggestions}
 *     returns predictions for the typed query — we render them as
 *     a custom dropdown so the styling matches the rest of the app
 *     (and so we sidestep the legacy {@code Autocomplete} widget,
 *     which Google retired for new GCP customers in March 2025).
 *
 *   - The new {@code Place} class is used to fetch geometry and
 *     address components once the user picks a suggestion.
 *
 * Three ways to set an address:
 *   1. "Use my current location"  → browser geolocation → reverse-geocode
 *   2. Type into the search box   → custom suggestions dropdown
 *   3. Drag the pin on the map    → reverse-geocode the new centre
 *
 * Returns:
 *   { lat, lng, formattedAddress, googlePlaceId, landmark,
 *     secondaryPhone, city, state, pincode }
 *
 * If the Places library fails to load (API key issue, blocked
 * network, etc.) the picker still works for typing the landmark and
 * dragging the pin — we never block the customer from saving.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, MapPin, Search, Crosshair, Loader2, Check, AlertCircle, Phone, Home,
} from 'lucide-react';
import { useGoogleMaps } from '@/hooks/useGoogleMaps';

// AES head office — used as the initial map centre when the user hasn't
// picked anything yet.  Hyderabad · Banjara Hills.
const DEFAULT_CENTER = { lat: 17.4156, lng: 78.4347 };

/**
 * Extract structured fields from Google's addressComponents array.
 * Returns { city, state, pincode, country } — any of which may be
 * empty strings if Google didn't include them in the response.
 */
function parseAddressComponents(components = []) {
  const out = { city: '', state: '', pincode: '', country: '' };
  for (const c of components) {
    const types = c.types || [];
    const longText  = c.longText  || c.long_name  || '';
    const shortText = c.shortText || c.short_name || '';
    if (types.includes('postal_code')) out.pincode = longText;
    else if (types.includes('locality')) out.city = longText;
    else if (types.includes('postal_town') && !out.city) out.city = longText;
    else if (types.includes('administrative_area_level_2') && !out.city) out.city = longText;
    else if (types.includes('administrative_area_level_1')) out.state = shortText || longText;
    else if (types.includes('country')) out.country = longText;
  }
  return out;
}

export default function LocationPicker({
  open,
  initial,        // optional starting address
  onClose,
  onSave,         // ({ lat, lng, formattedAddress, googlePlaceId, landmark, secondaryPhone, city, state, pincode }) => void
  saving = false,
}) {
  const { loaded, error } = useGoogleMaps();
  const mapRef        = useRef(null);
  const mapInstance   = useRef(null);
  const markerRef     = useRef(null);
  const sessionToken  = useRef(null);
  const debounceRef   = useRef(null);
  const placesLibRef  = useRef(null);          // cached {AutocompleteSuggestion, Place, AutocompleteSessionToken}

  const [center, setCenter]   = useState(initial?.lat && initial?.lng
    ? { lat: initial.lat, lng: initial.lng } : DEFAULT_CENTER);
  const [formattedAddress, setFormattedAddress] = useState(initial?.formattedAddress || '');
  const [placeId, setPlaceId]   = useState(null);
  const [landmark, setLandmark] = useState(initial?.landmark || '');
  const [phone, setPhone]       = useState(initial?.secondaryPhone || '');
  const [comps,    setComps]    = useState({ city:'', state:'', pincode:'', country:'' });
  const [geoBusy, setGeoBusy]   = useState(false);
  const [hint, setHint]         = useState('');

  // Search dropdown state
  const [searchValue, setSearchValue] = useState(initial?.formattedAddress || '');
  const [suggestions, setSuggestions] = useState([]);
  const [searchBusy,  setSearchBusy]  = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // ── Initialise map once the script is ready ────────────────────
  useEffect(() => {
    if (!open || !loaded || !mapRef.current) return;
    if (mapInstance.current) return;

    const { google } = window;
    const map = new google.maps.Map(mapRef.current, {
      center,
      zoom: 14,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
      gestureHandling: 'greedy',
    });
    mapInstance.current = map;

    const marker = new google.maps.Marker({
      position: center,
      map,
      draggable: true,
      title: 'Drag to fine-tune the pin',
    });
    markerRef.current = marker;

    // Drag → reverse-geocode
    marker.addListener('dragend', () => {
      const p = marker.getPosition();
      reverseGeocode(p.lat(), p.lng());
    });
    // Pan map → keep marker in centre, but DON'T reverse-geocode on
    // every tiny pan — only when the user stops moving (idle).  We
    // accept that the address text trails the camera slightly; that's
    // the standard food-delivery-app behaviour.
    map.addListener('idle', () => {
      const c = map.getCenter();
      if (!c) return;
      marker.setPosition(c);
    });

    // Pre-load the new Places library + create a session token.  We
    // create the token *once per modal-open* so all the suggestion
    // calls below get billed as one Place Autocomplete session.
    google.maps.importLibrary('places').then((lib) => {
      placesLibRef.current = lib;
      try { sessionToken.current = new lib.AutocompleteSessionToken(); } catch { /* noop */ }
    }).catch(() => { /* fallback: dropdown stays empty, drag/use-current still work */ });

    if (!initial?.formattedAddress) {
      reverseGeocode(center.lat, center.lng);
    }
  }, [open, loaded]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Reset when modal closes
  useEffect(() => {
    if (open) return;
    mapInstance.current = null;
    markerRef.current = null;
    sessionToken.current = null;
    placesLibRef.current = null;
    setSuggestions([]);
    setShowDropdown(false);
  }, [open]);

  // Reverse-geocode (no Places library needed; uses the basic Geocoder).
  const reverseGeocode = useCallback((lat, lng) => {
    if (!window.google?.maps) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        setFormattedAddress(results[0].formatted_address);
        setPlaceId(results[0].place_id || null);
        setCenter({ lat, lng });
        setSearchValue(results[0].formatted_address);
        // address_components on the legacy Geocoder uses snake_case
        const parsed = parseAddressComponents(
          (results[0].address_components || []).map((c) => ({
            longText: c.long_name, shortText: c.short_name, types: c.types,
          })),
        );
        setComps(parsed);
      }
    });
  }, []);

  // ── New Places autocomplete ─────────────────────────────────────
  const fetchSuggestions = useCallback(async (input) => {
    if (!input?.trim()) { setSuggestions([]); return; }
    const lib = placesLibRef.current;
    if (!lib?.AutocompleteSuggestion) return;
    setSearchBusy(true);
    try {
      // Bias predictions to the current map view for better local hits
      const bounds = mapInstance.current?.getBounds?.();
      const req = {
        input,
        includedRegionCodes: ['in'],
        sessionToken: sessionToken.current ?? undefined,
      };
      if (bounds) req.locationBias = bounds;
      const { suggestions: results = [] } =
        await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions(req);
      setSuggestions(results);
      setShowDropdown(true);
    } catch (e) {
      // Silent: dropdown stays empty.  The customer can still drag
      // the pin or use "current location" — those don't need Places.
      setSuggestions([]);
    } finally {
      setSearchBusy(false);
    }
  }, []);

  // Debounced search-as-you-type
  const onSearchChange = (v) => {
    setSearchValue(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(v), 220);
  };

  // User clicked one of the suggestions
  const pickSuggestion = async (sug) => {
    const lib = placesLibRef.current;
    if (!lib) return;
    setShowDropdown(false);
    try {
      // suggestion → Place (new SDK) → fetch the fields we need
      const place = sug.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location', 'addressComponents'],
      });
      const lat = place.location.lat();
      const lng = place.location.lng();
      const addr = place.formattedAddress || place.displayName || '';
      setCenter({ lat, lng });
      setFormattedAddress(addr);
      setSearchValue(addr);
      setPlaceId(place.id || null);
      setComps(parseAddressComponents(place.addressComponents));
      // Refresh the map view + marker
      if (mapInstance.current && markerRef.current) {
        mapInstance.current.setCenter({ lat, lng });
        mapInstance.current.setZoom(17);
        markerRef.current.setPosition({ lat, lng });
      }
      // Reset session token AFTER a successful pick (billing-best-practice)
      try { sessionToken.current = new lib.AutocompleteSessionToken(); } catch { /* noop */ }
    } catch (e) {
      setHint('Could not load that place. Try another suggestion or drag the pin.');
    }
  };

  // Use my current location
  const useMyLocation = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setHint('Your browser does not support geolocation. Search for your address instead.');
      return;
    }
    setGeoBusy(true);
    setHint('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCenter({ lat, lng });
        if (mapInstance.current && markerRef.current) {
          mapInstance.current.setCenter({ lat, lng });
          mapInstance.current.setZoom(17);
          markerRef.current.setPosition({ lat, lng });
        }
        reverseGeocode(lat, lng);
        setGeoBusy(false);
      },
      (err) => {
        setGeoBusy(false);
        setHint(err.code === 1
          ? 'Location permission denied. You can search for your address instead.'
          : 'Could not get your location — try searching for the address.');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  }, [reverseGeocode]);

  const handleSave = () => {
    if (!formattedAddress || !center.lat || !center.lng) {
      setHint('Pick a location on the map or search for an address first.');
      return;
    }
    onSave?.({
      lat: center.lat,
      lng: center.lng,
      formattedAddress,
      googlePlaceId: placeId,
      landmark: landmark.trim() || null,
      secondaryPhone: phone.trim() || null,
      city:    comps.city    || null,
      state:   comps.state   || null,
      pincode: comps.pincode || null,
      country: comps.country || null,
    });
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={overlay}
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 240, damping: 26 }}
          style={panel}
        >
          {/* Header */}
          <div style={header}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <MapPin size={18} color="#6366f1" />
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Set your visit address</h3>
                <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>
                  We need this to calculate the service charge and route our engineer.
                </p>
              </div>
            </div>
            <button onClick={onClose} style={iconBtn} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          {/* Search row + custom suggestions dropdown */}
          <div style={{ position: 'relative' }}>
            <div style={searchRow}>
              <div style={searchBox}>
                <Search size={16} color="#64748b" />
                <input
                  value={searchValue}
                  placeholder={loaded ? 'Search for area, street, landmark…' : 'Loading map…'}
                  disabled={!loaded}
                  onChange={(e) => onSearchChange(e.target.value)}
                  onFocus={() => { if (suggestions.length) setShowDropdown(true); }}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: '#0f172a' }}
                />
                {searchBusy && <Loader2 size={14} className="spin" color="#64748b" />}
              </div>
              <button onClick={useMyLocation} disabled={!loaded || geoBusy} style={locBtn} title="Use my current location">
                {geoBusy ? <Loader2 size={14} className="spin" /> : <Crosshair size={14} />}
                <span style={{ fontSize: 12, fontWeight: 600 }}>Use current</span>
              </button>
            </div>

            {showDropdown && suggestions.length > 0 && (
              <ul style={dropdown}>
                {suggestions.slice(0, 6).map((sug, idx) => {
                  const pp = sug.placePrediction;
                  const main = pp?.mainText?.text || pp?.text?.text || '';
                  const secondary = pp?.secondaryText?.text || '';
                  return (
                    <li key={pp?.placeId || idx}
                        onMouseDown={(e) => { e.preventDefault(); pickSuggestion(sug); }}
                        style={dropdownItem}>
                      <MapPin size={14} color="#64748b" style={{ flexShrink: 0, marginTop: 2 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{main}</div>
                        {secondary && (
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{secondary}</div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Hint / error */}
          {(hint || error) && (
            <div style={errorBox}>
              <AlertCircle size={14} />
              <span>{hint || (error ? 'Google Maps could not load — you can still enter an address manually below.' : '')}</span>
            </div>
          )}

          {/* Map */}
          <div style={mapWrap}>
            {!loaded && !error && (
              <div style={mapLoading}>
                <Loader2 size={24} className="spin" />
                <p style={{ margin: '8px 0 0', fontSize: 12, color: '#64748b' }}>Loading map…</p>
              </div>
            )}
            {error && (
              <div style={{ ...mapLoading, color: '#ef4444' }}>
                <AlertCircle size={24} />
                <p style={{ margin: '8px 0 0', fontSize: 12 }}>Map unavailable — enter your address manually below.</p>
              </div>
            )}
            <div ref={mapRef} style={{ width: '100%', height: '100%', borderRadius: 10 }} />
            {loaded && (
              <div style={crosshair} aria-hidden>
                <MapPin size={32} color="#ef4444" fill="#ef4444" />
              </div>
            )}
          </div>

          {/* Selected address card */}
          <div style={selectedCard}>
            <Home size={16} color="#6366f1" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                Selected address
              </div>
              <div style={{ fontSize: 13, color: '#0f172a', marginTop: 2, lineHeight: 1.4 }}>
                {formattedAddress || (loaded ? 'Drag the pin or search for an address' : 'Loading…')}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, fontFamily: 'monospace' }}>
                {center.lat.toFixed(5)}, {center.lng.toFixed(5)}
                {comps.city && <> · {comps.city}</>}
                {comps.pincode && <> · {comps.pincode}</>}
              </div>
            </div>
          </div>

          {/* Additional fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="input-group" style={{ margin: 0 }}>
              <label style={fieldLabel}>Floor / landmark (optional)</label>
              <input
                className="input"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="e.g. Flat 2B, opposite ICICI Bank"
                maxLength={200}
              />
            </div>
            <div className="input-group" style={{ margin: 0 }}>
              <label style={fieldLabel}>Alternate phone (optional)</label>
              <div style={{ position: 'relative' }}>
                <Phone size={14} color="#64748b" style={{ position: 'absolute', top: 12, left: 10 }} />
                <input
                  className="input"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  maxLength={15}
                  style={{ paddingLeft: 30 }}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving} style={{ flex: 1 }}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving || !formattedAddress}
              style={{ flex: 2 }}>
              {saving ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
              {saving ? ' Saving…' : ' Save & continue'}
            </button>
          </div>

          <style jsx>{`
            .spin { animation: spin 1s linear infinite; }
            @keyframes spin { to { transform: rotate(360deg); } }
          `}</style>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── inline styles ─────────────────────────────────────────────
const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
  zIndex: 900, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  padding: 0, backdropFilter: 'blur(2px)',
};
const panel = {
  background: 'var(--surface, #fff)', color: 'var(--on-surface, #0f172a)',
  borderRadius: '20px 20px 0 0',
  width: 'min(560px, 100%)',
  maxHeight: '95dvh', overflowY: 'auto',
  padding: '16px',
  display: 'flex', flexDirection: 'column', gap: 12,
  boxShadow: '0 -25px 60px rgba(0,0,0,0.3)',
  fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};
const header = { display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
const iconBtn = {
  background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b',
  width: 32, height: 32, borderRadius: 8, display: 'flex',
  alignItems: 'center', justifyContent: 'center',
};
const searchRow = { display: 'flex', gap: 8, alignItems: 'stretch' };
const searchBox = {
  flex: 1, display: 'flex', alignItems: 'center', gap: 8,
  border: '1px solid var(--border-light, #cbd5e1)', borderRadius: 10,
  padding: '10px 12px', background: 'var(--surface-container-low, #f8fafc)',
};
const locBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '0 12px', borderRadius: 10,
  background: 'linear-gradient(135deg, #6366f1, #0ea5e9)',
  color: '#fff', border: 'none', cursor: 'pointer',
};
const dropdown = {
  position: 'absolute', top: '100%', left: 0, right: 0,
  marginTop: 4, padding: 4, listStyle: 'none',
  background: 'var(--surface, #fff)',
  border: '1px solid var(--border-light, #e2e8f0)',
  borderRadius: 12, maxHeight: 280, overflowY: 'auto',
  boxShadow: '0 12px 32px rgba(15,23,42,0.18)',
  zIndex: 950,
};
const dropdownItem = {
  display: 'flex', alignItems: 'flex-start', gap: 10,
  padding: '10px 12px', cursor: 'pointer',
  borderRadius: 8,
};
const errorBox = {
  display: 'flex', alignItems: 'flex-start', gap: 6,
  padding: '8px 10px', borderRadius: 8,
  background: '#fef3c7', color: '#92400e', fontSize: 12,
};
const mapWrap = {
  position: 'relative', height: 280,
  borderRadius: 12, overflow: 'hidden',
  border: '1px solid var(--border-light, #e2e8f0)',
  background: '#f1f5f9',
};
const mapLoading = {
  position: 'absolute', inset: 0,
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  background: '#f8fafc',
};
const crosshair = {
  position: 'absolute', top: '50%', left: '50%',
  transform: 'translate(-50%, -100%)',
  pointerEvents: 'none', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))',
};
const selectedCard = {
  display: 'flex', alignItems: 'flex-start', gap: 10,
  padding: '12px 14px', borderRadius: 10,
  background: 'linear-gradient(135deg, #6366f110, #0ea5e910)',
  border: '1px solid #6366f130',
};
const fieldLabel = {
  fontSize: 11, fontWeight: 600, color: '#475569',
  textTransform: 'uppercase', letterSpacing: 0.4,
  marginBottom: 4, display: 'block',
};
