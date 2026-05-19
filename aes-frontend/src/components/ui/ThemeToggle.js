'use client';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

/**
 * Two-state theme toggle. Pill-style icon button.
 * Click flips light ⇄ dark. (System default still works on first visit.)
 *
 * Variants:
 *   default  — pill, light surface, icon + label. Suited for surfaces with
 *              normal text color (cards, modals, AppTopBar).
 *   round    — circular icon button (40×40) on surface, for mobile top bars.
 *   onNavy   — used inside the navy desktop Header: transparent background
 *              with white text/icon so it blends with the brand color.
 */
export default function ThemeToggle({ variant = 'onNavy', className = '' }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'background 180ms ease, color 180ms ease, transform 180ms ease',
  };

  let variantStyle;
  if (variant === 'round') {
    variantStyle = {
      width: 40, height: 40, borderRadius: '50%',
      border: '1px solid var(--border-light)',
      color: 'var(--on-surface)',
      background: 'var(--surface-container-low)',
    };
  } else if (variant === 'onNavy') {
    variantStyle = {
      width: 38, height: 38, borderRadius: 999,
      border: 'none',
      color: '#fff',
      background: 'rgba(255,255,255,0.08)',
    };
  } else {
    variantStyle = {
      height: 36, padding: '0 12px', borderRadius: 999, gap: 6,
      fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
      border: '1px solid var(--border-light)',
      color: 'var(--on-surface)',
      background: 'var(--surface-container-low)',
    };
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={className}
      style={{ ...baseStyle, ...variantStyle }}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
      {variant === 'default' && <span>{isDark ? 'Light' : 'Dark'}</span>}
    </button>
  );
}
