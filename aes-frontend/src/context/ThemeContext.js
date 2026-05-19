'use client';

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';

/**
 * Theme: 'light' | 'dark' | 'system'
 *
 * Persistence: `localStorage.aes_theme`.
 * Initial paint: a tiny script in <head> (see ThemeNoFlashScript) sets the
 * `data-theme` attribute on <html> BEFORE React hydrates, so users never see
 * a white flash when they reload in dark mode.
 */
const ThemeContext = createContext({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
});

const STORAGE_KEY = 'aes_theme';
const VALID = new Set(['light', 'dark', 'system']);

function systemPref() {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyToDom(resolved) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', resolved);
  // Match the browser chrome (Android nav bar, iOS status bar) to the theme.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0b1220' : '#003366');
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('system');
  const [system, setSystem] = useState('light');

  // Hydrate from storage + listen to OS theme changes.
  useEffect(() => {
    let stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch { /* private mode */ }
    if (stored && VALID.has(stored)) setThemeState(stored);
    setSystem(systemPref());

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => setSystem(e.matches ? 'dark' : 'light');
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  const resolvedTheme = theme === 'system' ? system : theme;

  useEffect(() => { applyToDom(resolvedTheme); }, [resolvedTheme]);

  const setTheme = useCallback((next) => {
    if (!VALID.has(next)) return;
    setThemeState(next);
    try {
      if (next === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch { /* ignore */ }
  }, []);

  const toggleTheme = useCallback(() => {
    // Two-state toggle: whatever the user is currently *seeing*, flip it.
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [theme, resolvedTheme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Inline <script> that runs before React hydrates so the right theme is on
 * <html> at first paint. Drop this in <head> via Next.js's `next/script`
 * with strategy `beforeInteractive`, or render it directly inside a server
 * component layout — both work in the App Router.
 */
export const themeBootScript = `
(function(){try{
  var t=localStorage.getItem('${STORAGE_KEY}');
  var sys=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
  var r=(t==='light'||t==='dark')?t:sys;
  document.documentElement.setAttribute('data-theme', r);
}catch(e){}})();
`;
