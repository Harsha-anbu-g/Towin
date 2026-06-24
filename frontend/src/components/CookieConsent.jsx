import { useState } from 'react';
import { Link } from 'react-router-dom';

const STORAGE_KEY = 'cookieConsent';

// Lightweight consent notice. We only use strictly-necessary local storage (the
// login token), so this is an acknowledgement rather than a blocking gate — it
// never prevents the user from reaching the app.
export default function CookieConsent() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'accepted';
    } catch {
      return true;
    }
  });

  if (dismissed) return null;

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'accepted');
    } catch {
      // private mode or storage disabled — just hide the banner for this session
    }
    setDismissed(true);
  };

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="cookie-notice"
      style={{
        position: 'fixed',
        /* bottom set via .cookie-notice so it can add the safe-area inset */
        left: 12,
        right: 12,
        maxWidth: 720,
        margin: '0 auto',
        background: '#1f2933',
        color: '#f0f4f8',
        borderRadius: 12,
        padding: '14px 18px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 12,
        boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
        zIndex: 1000,
        fontSize: 'var(--text-sm)',
        lineHeight: 1.5,
      }}
    >
      <span style={{ flex: 1, minWidth: 220 }}>
        We keep you signed in and use tools that record how the site is used
        (including replays of screen activity) to make it better. See our{' '}
        <Link to="/privacy" style={{ color: '#7cc4e8', textDecoration: 'underline' }}>Privacy Policy</Link>.
      </span>
      <button
        onClick={accept}
        style={{
          background: 'var(--blue)',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '8px 18px',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Got it
      </button>
    </div>
  );
}
