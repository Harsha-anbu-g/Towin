import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'towin_beta_banner_dismissed';

export default function BetaBanner() {
  const [visible, setVisible] = useState(
    () => localStorage.getItem(STORAGE_KEY) !== 'true'
  );
  const navigate = useNavigate();

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setVisible(false);
  };

  return (
    <div style={{
      width: '100%',
      background: 'var(--action-fill)',
      color: 'var(--action-ink)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '10px 48px',
      fontSize: 'var(--text-sm)',
      fontFamily: `-apple-system, 'SF Pro Text', system-ui, sans-serif`,
      position: 'relative',
      zIndex: 'var(--z-banner)',
      boxSizing: 'border-box',
    }}>
      <span>
        ToWin is in beta testing. Your feedback helps us improve.{' '}
        <button
          onClick={() => navigate('/feedback')}
          style={{
            background: 'none', border: 'none', color: '#fff',
            fontWeight: 600, cursor: 'pointer', textDecoration: 'underline',
            fontSize: 'var(--text-sm)', fontFamily: 'inherit',
            /* Comfortable tap height without making the banner taller */
            padding: '12px 4px', margin: '-12px -4px',
          }}
        >
          Give Feedback →
        </button>
      </span>
      <button
        onClick={dismiss}
        aria-label="Dismiss beta banner"
        style={{
          position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', color: '#fff',
          fontSize: 'var(--text-lg)', cursor: 'pointer', lineHeight: 1,
          minWidth: '44px', minHeight: '44px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ×
      </button>
    </div>
  );
}
