import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
    } catch {
      // Intentionally ignore — we never reveal whether the email exists.
    } finally {
      setLoading(false);
      setSent(true);
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
    width: '100%', background: '#4FA3CE', color: '#fff', border: 'none',
    borderRadius: 10, padding: '12px', fontSize: 17, fontWeight: 600,
    cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1,
  };
  const linkStyle = { color: '#4FA3CE', fontWeight: 600, textDecoration: 'underline', fontSize: 15 };

  if (sent) {
    return (
      <div style={{ ...wrap, textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>✉️</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Check your email</h1>
        <p style={{ color: '#718096', marginBottom: 24 }}>
          If an account exists for that email, we've sent a link to reset your password.
          Be sure to check your Spam folder.
        </p>
        <Link to="/login" style={linkStyle}>Back to log in</Link>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Reset your password</h1>
      <p style={{ color: '#718096', marginBottom: 24, fontSize: 16 }}>
        Enter your email and we'll send you a link to set a new password.
      </p>
      <form onSubmit={submit}>
        <label htmlFor="fp-email" style={{ display: 'block', fontSize: 15, fontWeight: 600, color: '#1d1d1f', marginBottom: 8 }}>
          Email
        </label>
        <input
          id="fp-email"
          type="email" required value={email}
          onChange={e => setEmail(e.target.value)}
          style={input}
        />
        <button type="submit" disabled={loading} style={btn}>
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <p style={{ marginTop: 18, fontSize: 15 }}>
        <Link to="/login" style={linkStyle}>Back to log in</Link>
      </p>
    </div>
  );
}
