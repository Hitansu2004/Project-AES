'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import styles from './AppTopBar.module.css';

/**
 * Sticky top bar used by wizards and detail screens. Shows a back button,
 * a centered title and an optional right-side slot (e.g. step indicator).
 */
export default function AppTopBar({
  title,
  onBack,
  right = null,
  showBack = true,
  variant = 'light',         // "light" | "transparent"
  width = 'narrow',          // "narrow" | "content" | "detail"
}) {
  const router = useRouter();
  const handleBack = () => {
    if (onBack) onBack();
    else router.back();
  };

  const widthClass = width === 'content'
    ? styles.rowContent
    : width === 'detail'
      ? styles.rowDetail
      : styles.row;

  return (
    <header className={`${styles.bar} ${variant === 'transparent' ? styles.transparent : ''}`}>
      <div className={widthClass}>
        <div className={styles.left}>
          {showBack ? (
            <button
              type="button"
              className={styles.iconButton}
              onClick={handleBack}
              aria-label="Go back"
            >
              <ArrowLeft size={22} />
            </button>
          ) : <div style={{ width: 40 }} />}
        </div>
        <h1 className={styles.title}>{title}</h1>
        <div className={styles.right}>{right || <div style={{ width: 40 }} />}</div>
      </div>
    </header>
  );
}
