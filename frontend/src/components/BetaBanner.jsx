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
      background: '#4FA3CE',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '10px 20px',
      fontSize: '15px',
      fontFamily: `-apple-system, 'SF Pro Text', system-ui, sans-serif`,
      position: 'relative',
      zIndex: 1000,
      boxSizing: 'border-box',
    }}>
      <span>
        ToWin is in beta testing. Your feedback helps us improve.{' '}
        <button
          onClick={() => navigate('/feedback')}
          style={{
            background: 'none', border: 'none', color: '#fff',
            fontWeight: 600, cursor: 'pointer', textDecoration: 'underline',
            fontSize: '15px', fontFamily: 'inherit', padding: 0,
          }}
        >
          Give Feedback →
        </button>
      </span>
      <button
        onClick={dismiss}
        aria-label="Dismiss beta banner"
        style={{
          position: 'absolute', right: '16px',
          background: 'none', border: 'none', color: '#fff',
          fontSize: '18px', cursor: 'pointer', lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}
