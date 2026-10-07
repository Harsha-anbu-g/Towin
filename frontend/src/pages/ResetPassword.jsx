import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api/axios';
import SmoothInput from '../components/SmoothInput';
import { tr } from '../i18n';

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
    if (pw.length < 8) { setError(tr('Password must be at least 8 characters')); return; }
    if (pw !== confirm) { setError(tr('Passwords do not match')); return; }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: pw });
      setDone(true);
    } catch (err) {
      setError(err?.response?.data?.message || tr('This reset link is invalid or has expired.'));
    } finally {
      setLoading(false);
    }
  };

  const wrap = {
    maxWidth: 420, margin: '0 auto', padding: '64px 24px',
    fontFamily: `-apple-system, 'SF Pro Text', system-ui, sans-serif`, color: 'var(--ink-deep)',
  };
  const input = {
    width: '100%', padding: '12px 14px', fontSize: 17, borderRadius: 10,
    border: '1px solid var(--input-line)', boxSizing: 'border-box', marginBottom: 14,
  };
  const btn = {
    width: '100%', background: 'var(--action-fill)', color: 'var(--action-ink)', border: 'none',
    borderRadius: 10, padding: '12px', fontSize: 17, fontWeight: 600,
    cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1,
  };
  const linkStyle = { color: 'var(--blue-deep)', fontWeight: 600, textDecoration: 'underline', fontSize: 'var(--text-sm)' };
  const labelStyle = { display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink)', marginBottom: 8 };

  if (!token) {
    return (
      <div style={{ ...wrap, textAlign: 'center' }}>
        <h1 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 12 }}>{tr('Invalid link')}</h1>
        <p style={{ color: 'var(--slate)', marginBottom: 24 }}>{tr('This reset link is missing its token.')}</p>
        <Link to="/forgot-password" style={linkStyle}>{tr('Request a new link')}</Link>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ ...wrap, textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>✅</div>
        <h1 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 12 }}>{tr('Password updated')}</h1>
        <p style={{ color: 'var(--slate)', marginBottom: 24 }}>{tr('You can now log in with your new password.')}</p>
        <Link to="/login" style={linkStyle}>{tr('Go to log in →')}</Link>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <h1 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 8 }}>{tr('Choose a new password')}</h1>
      <form onSubmit={submit} style={{ marginTop: 16 }}>
        <label htmlFor="rp-pw" style={labelStyle}>{tr('New password (at least 8 characters)')}</label>
        <SmoothInput
          id="rp-pw"
          type="password" required value={pw}
          onChange={e => { setPw(e.target.value); setError(''); }}
          style={input}
        />
        <label htmlFor="rp-confirm" style={labelStyle}>{tr('Re-enter new password')}</label>
        <SmoothInput
          id="rp-confirm"
          type="password" required value={confirm}
          onChange={e => { setConfirm(e.target.value); setError(''); }}
          style={input}
        />
        {error && <p style={{ color: 'var(--red-error)', fontSize: 14, marginBottom: 12 }}>{error}</p>}
        <button type="submit" disabled={loading} style={btn}>
          {loading ? tr('Saving…') : tr('Update password')}
        </button>
      </form>
      <p style={{ marginTop: 18, fontSize: 'var(--text-sm)' }}>
        <Link to="/login" style={linkStyle}>{tr('Back to log in')}</Link>
      </p>
    </div>
  );
}
