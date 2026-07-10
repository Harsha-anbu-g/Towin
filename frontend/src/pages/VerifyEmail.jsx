import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api/axios';

// Landing page for the link sent in the verification email. Reads ?token=,
// confirms it with the backend, and shows the result. No auth required.
export default function VerifyEmail() {
  const [params] = useSearchParams();
  // A missing token is known at mount — derive the initial state instead of
  // setting state synchronously inside the effect.
  const [state, setState] = useState(() => params.get('token') ? 'verifying' : 'error'); // verifying | success | error
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // guard against React 18 double-invoke in dev
    ran.current = true;
    const token = params.get('token');
    if (!token) return; // error already derived above
    api.post('/auth/verify-email', { token })
      .then(() => setState('success'))
      .catch(() => setState('error'));
  }, [params]);

  const card = {
    maxWidth: 460, margin: '0 auto', padding: '56px 24px', textAlign: 'center',
    fontFamily: `-apple-system, 'SF Pro Text', system-ui, sans-serif`, color: 'var(--ink-deep)',
  };
  const linkStyle = { color: 'var(--blue-deep)', fontWeight: 600, textDecoration: 'none' };

  return (
    <div style={card}>
      {state === 'verifying' && (
        <>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Verifying your email…</h1>
          <p style={{ color: 'var(--slate)' }}>Just a moment.</p>
        </>
      )}
      {state === 'success' && (
        <>
          <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Email verified!</h1>
          <p style={{ color: 'var(--slate)', marginBottom: 24 }}>
            Your account is ready. Please log in to get started.
          </p>
          <Link to="/login" style={linkStyle}>Go to login →</Link>
        </>
      )}
      {state === 'error' && (
        <>
          <div style={{ fontSize: 44, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Link didn't work</h1>
          <p style={{ color: 'var(--slate)', marginBottom: 24 }}>
            This link is invalid or has expired. Please sign up again to get a fresh one.
          </p>
          <Link to="/register" style={linkStyle}>Back to sign up →</Link>
        </>
      )}
    </div>
  );
}
