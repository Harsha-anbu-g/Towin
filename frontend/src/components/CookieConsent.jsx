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
      style={{
        position: 'fixed',
        bottom: 12,
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
        fontSize: 14,
        lineHeight: 1.5,
      }}
    >
      <span style={{ flex: 1, minWidth: 220 }}>
        We store a small amount of data on your device to keep you signed in and remember your choices.
        See our <Link to="/privacy" style={{ color: '#7cc4e8', textDecoration: 'underline' }}>Privacy Policy</Link>.
      </span>
      <button
        onClick={accept}
        style={{
          background: '#4FA3CE',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '8px 18px',
          fontSize: 14,
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
