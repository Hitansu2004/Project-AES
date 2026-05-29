'use client';

/**
 * One-shot loader for the Google Maps JavaScript API + Places library.
 *
 * <p>Google's recommended async loader pattern — we inject one
 * `<script>` tag with the v3 bootstrap, then export a hook that
 * resolves once `window.google.maps` is ready.</p>
 *
 * <p>Multiple components can call {@link useGoogleMaps} without
 * worrying about duplicate downloads — the module-level promise
 * caches the loader.</p>
 *
 * <p>If {@code NEXT_PUBLIC_GOOGLE_MAPS_API_KEY} is missing or the
 * script fails to load, the hook returns {@code error} so callers
 * can fall back to a manual-entry UI.</p>
 */

import { useEffect, useState } from 'react';

let loadPromise = null;

function injectScript(apiKey) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('SSR'));
    if (window.google?.maps) return resolve(window.google);

    // Already injected by a previous component instance
    const existing = document.querySelector('script[data-aes-gmaps]');
    if (existing) {
      existing.addEventListener('load',  () => resolve(window.google));
      existing.addEventListener('error', () => reject(new Error('Google Maps script failed to load')));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.setAttribute('data-aes-gmaps', 'true');
    script.onload  = () => resolve(window.google);
    script.onerror = () => reject(new Error('Google Maps script failed to load'));
    document.head.appendChild(script);
  });
}

export function loadGoogleMaps() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return Promise.reject(new Error('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set'));
  if (!loadPromise) loadPromise = injectScript(apiKey);
  return loadPromise;
}

export function useGoogleMaps() {
  const [state, setState] = useState({ loaded: false, error: null });
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => { if (!cancelled) setState({ loaded: true, error: null }); })
      .catch((err) => { if (!cancelled) setState({ loaded: false, error: err }); });
    return () => { cancelled = true; };
  }, []);
  return state;
}
