'use client';

import { Snowflake } from 'lucide-react';

/**
 * Rose Luxury splash — full-viewport loading screen with a pink chip,
 * uppercase brand mark and a soft pulsing helper line. Used by the root
 * router and Suspense fallbacks during auth/data hydration.
 */
export default function RoseSplash({ message = 'Loading your workspace…' }) {
  return (
    <div className="aes-splash" role="status" aria-live="polite">
      <div className="aes-splash__inner">
        <div className="aes-splash__chip" aria-hidden="true">
          <Snowflake size={36} strokeWidth={2.4} />
        </div>
        <div className="aes-splash__cluster">
          <span className="aes-splash__wordmark">Arial Engineering</span>
          <span className="aes-splash__text">{message}</span>
          <span className="aes-splash__bar" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
