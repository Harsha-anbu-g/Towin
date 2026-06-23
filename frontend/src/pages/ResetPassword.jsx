import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api/axios';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (pw.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (pw !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: pw });
      setDone(true);
    } catch (err) {
      setError(err?.response?.data?.message || 'This reset link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  const wrap = {
    maxWidth: 420, margin: '0 auto', padding: '64px 24px',
    fontFamily: `-apple-system, 'SF Pro Text', system-ui, sans-serif`, color: '#2d3748',
  };
  const input = {
    width: '100%', padding: '12px 14px', fontSize: 17, borderRadius: 10,
    border: '1px solid #d8dce2', boxSizing: 'border-box', marginBottom: 14,
  };
  const btn = {
    width: '100%', background: 'var(--blue)', color: '#fff', border: 'none',
    borderRadius: 10, padding: '12px', fontSize: 17, fontWeight: 600,
    cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1,
  };
  const linkStyle = { color: 'var(--blue)', fontWeight: 600, textDecoration: 'underline', fontSize: 15 };
  const labelStyle = { display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 };

  if (!token) {
    return (
      <div style={{ ...wrap, textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Invalid link</h1>
        <p style={{ color: '#718096', marginBottom: 24 }}>This reset link is missing its token.</p>
        <Link to="/forgot-password" style={linkStyle}>Request a new link</Link>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ ...wrap, textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>✅</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Password updated</h1>
        <p style={{ color: '#718096', marginBottom: 24 }}>You can now log in with your new password.</p>
        <Link to="/login" style={linkStyle}>Go to log in →</Link>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Choose a new password</h1>
      <form onSubmit={submit} style={{ marginTop: 16 }}>
        <label htmlFor="rp-pw" style={labelStyle}>New password (at least 8 characters)</label>
        <input
          id="rp-pw"
          type="password" required value={pw}
          onChange={e => { setPw(e.target.value); setError(''); }}
          style={input}
        />
        <label htmlFor="rp-confirm" style={labelStyle}>Re-enter new password</label>
        <input
          id="rp-confirm"
          type="password" required value={confirm}
          onChange={e => { setConfirm(e.target.value); setError(''); }}
          style={input}
        />
        {error && <p style={{ color: '#dc2626', fontSize: 14, marginBottom: 12 }}>{error}</p>}
        <button type="submit" disabled={loading} style={btn}>
          {loading ? 'Saving…' : 'Update password'}
        </button>
      </form>
      <p style={{ marginTop: 18, fontSize: 15 }}>
        <Link to="/login" style={linkStyle}>Back to log in</Link>
      </p>
    </div>
  );
}
