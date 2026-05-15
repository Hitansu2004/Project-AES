import { Snowflake } from 'lucide-react';

/**
 * AES brand mark — a snowflake glyph on a navy chip + wordmark.
 * Sizes: "sm" (24), "md" (32), "lg" (48).
 */
export default function Logo({ size = 'md', showWordmark = true, color = 'navy' }) {
  const dim = { sm: 24, md: 32, lg: 48 }[size] || 32;
  const chip = dim + 12;
  const palette = color === 'white'
    ? { bg: 'rgba(255,255,255,0.15)', fg: '#ffffff', text: '#ffffff' }
    : { bg: 'var(--primary-dark)', fg: '#ffffff', text: 'var(--primary-dark)' };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
      <div
        style={{
          width: chip,
          height: chip,
          borderRadius: 12,
          background: palette.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Snowflake size={dim - 6} color={palette.fg} strokeWidth={2.2} />
      </div>
      {showWordmark && (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: palette.text, letterSpacing: '-0.01em' }}>
            Arial Engineering
          </span>
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--on-surface-variant)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            HVAC Services
          </span>
        </div>
      )}
    </div>
  );
}
