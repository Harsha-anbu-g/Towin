import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/useAuth';
import { yearsOld } from '../lib/copy';

const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

const DEMO = {
  ELDER:  { identifier: 'elder',  password: '12345678' },
  HELPER: { identifier: 'helper', password: '123456789' },
  FAMILY: { identifier: 'demo.sarah@towin.app', password: 'DemoSarah!2026' },
};

/* The same demo quick-way-in as the login page — visitors on the create-account
   page shouldn't have to make an account just to look around. */
export default function DemoAccounts() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [guestLoading, setGuestLoading] = useState('');
  const [error, setError] = useState('');

  const handleGuest = async (role) => {
    setGuestLoading(role);
    setError('');
    try {
      const { data } = await api.post('/auth/login', DEMO[role]);
      login(data.token);
      navigate(
        data.role === 'ADMIN' ? '/admin'
          : data.role === 'FAMILY' ? '/family-home'
          : '/streaks',
        { replace: true }
      );
    } catch {
      setError('Could not start demo session. Please try again.');
    } finally {
      setGuestLoading('');
    }
  };

  return (
    <div style={{
      marginBottom: '20px', background: 'var(--blue-wash)',
      border: '1.5px solid var(--blue)', borderRadius: '16px',
      padding: '18px 18px 16px', position: 'relative', fontFamily: SFText,
    }}>
      <span style={{
        position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)',
        background: 'var(--action-fill)', color: 'var(--action-ink)',
        fontSize: '13px', fontWeight: 700, letterSpacing: '0.8px',
        padding: '3px 12px', borderRadius: '9999px', textTransform: 'uppercase',
      }}>
        DEMO
      </span>
      <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink)', textAlign: 'center', margin: '0 0 4px' }}>
        Just want to see how it works?
      </p>
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-slate)', textAlign: 'center', margin: '0 0 14px', lineHeight: 1.5 }}>
        Look around with a sample account, no account needed.
      </p>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {[
          { role: 'ELDER', label: 'Try as an Elder', sub: `Margaret, ${yearsOld('1953-05-14')}` },
          { role: 'HELPER', label: 'Try as a Helper', sub: `Harsha, ${yearsOld('2003-03-14')}` },
          { role: 'FAMILY', label: 'Try as Family', sub: "Sarah, Margaret's daughter" },
        ].map(({ role, label, sub }) => (
          <button
            key={role}
            type="button"
            onClick={() => handleGuest(role)}
            disabled={!!guestLoading}
            style={{
              flex: 1, minWidth: '110px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: 'var(--canvas)', border: '1.5px solid var(--blue-soft)',
              borderRadius: '11px', padding: '12px 10px',
              cursor: guestLoading ? 'not-allowed' : 'pointer',
              opacity: guestLoading && guestLoading !== role ? 0.5 : 1,
              textAlign: 'center', transition: 'border-color 0.15s, background 0.15s',
              fontFamily: SFText,
            }}
            onMouseEnter={e => { if (!guestLoading) e.currentTarget.style.borderColor = 'var(--blue)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--blue-soft)'; }}
          >
            <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--blue-deep)' }}>
              {guestLoading === role ? 'Opening…' : label}
            </span>
            <span style={{ display: 'block', fontSize: '13px', color: 'var(--ink-3)', marginTop: '2px' }}>
              {sub}
            </span>
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" style={{ fontSize: '14px', color: 'var(--red-error)', textAlign: 'center', margin: '10px 0 0' }}>
          {error}
        </p>
      )}
    </div>
  );
}
