'use client';

import { useEffect, useRef } from 'react';
import styles from './OtpInput.module.css';

/**
 * Six-box OTP entry. Auto-advances to the next box on a digit, supports
 * paste of a 6-digit code, and submits on completion via {@code onComplete}.
 *
 * Props:
 *   value       — current 6-character string (parent state)
 *   onChange    — fired with the new string on every edit
 *   length      — number of boxes (default 6)
 *   autoFocus   — focus the first box on mount
 *   onComplete  — fired when all boxes are filled
 *   error       — boolean to show an error outline
 */
export default function OtpInput({
  value = '',
  onChange,
  length = 6,
  autoFocus = true,
  onComplete,
  error = false,
}) {
  const refs = useRef([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const setAt = (i, ch) => {
    const arr = value.padEnd(length, ' ').split('');
    arr[i] = ch;
    return arr.join('').replace(/\s/g, '');
  };

  const handleChange = (i, raw) => {
    const ch = (raw.match(/\d/g) || []).pop() || '';
    if (!ch) return;
    const next = setAt(i, ch);
    onChange(next);
    if (i < length - 1) refs.current[i + 1]?.focus();
    if (next.length === length) onComplete?.(next);
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      if (value[i]) {
        onChange(setAt(i, ''));
      } else if (i > 0) {
        refs.current[i - 1]?.focus();
        onChange(value.slice(0, i - 1));
      }
    } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    else if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus();
  };

  const handlePaste = (e) => {
    const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    refs.current[Math.min(pasted.length, length - 1)]?.focus();
    if (pasted.length === length) onComplete?.(pasted);
  };

  return (
    <div className={styles.row} onPaste={handlePaste}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          className={`${styles.box} ${error ? styles.error : ''} ${value[i] ? styles.filled : ''}`}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={value[i] || ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          aria-label={`Digit ${i + 1} of ${length}`}
        />
      ))}
    </div>
  );
}
