import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/useToast';
import api from '../api/axios';

function emailFromToken(token) {
  try { return JSON.parse(atob(token.split('.')[1])).email; } catch { return null; }
}

// Full-page gate shown to a logged-in user who hasn't verified their email yet.
// They cannot reach any app page until they open the link and sign in again.
export default function VerifyPending() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [sending, setSending] = useState(false);

  if (!user) return <Navigate to="/login" replace />;
  if (user.emailVerified !== false) return <Navigate to="/dashboard" replace />;

  const email = emailFromToken(user.token);

  const resend = async () => {
    setSending(true);
    try {
      await api.post('/auth/resend-verification');
      toast.success('Verification email sent. Check your inbox.');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Could not send the email. Try again shortly.');
    } finally {
      setSending(false);
    }
  };

  const backToLogin = () => { logout(); navigate('/login', { replace: true }); };

  const card = {
    maxWidth: 460, margin: '0 auto', padding: '64px 24px', textAlign: 'center',
    fontFamily: `-apple-system, 'SF Pro Text', system-ui, sans-serif`, color: 'var(--ink-deep)',
  };
  const primaryBtn = {
    background: 'var(--action-fill)', color: 'var(--action-ink)', border: 'none', borderRadius: 10,
    padding: '12px 22px', fontSize: 17, fontWeight: 600, cursor: sending ? 'default' : 'pointer',
    opacity: sending ? 0.6 : 1, width: '100%', marginBottom: 12,
  };
  const linkBtn = {
    background: 'none', border: 'none', color: 'var(--blue-deep)', fontWeight: 600,
    cursor: 'pointer', textDecoration: 'underline', fontSize: 'var(--text-sm)',
  };

  return (
    <div style={card}>
      <div style={{ fontSize: 44, marginBottom: 16 }}>✉️</div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Verify your email</h1>
      <p style={{ color: 'var(--slate)', marginBottom: 8 }}>
        We sent a verification link to{email ? <> <strong>{email}</strong></> : ' your email'}.
      </p>
      <p style={{ color: 'var(--slate)', marginBottom: 20 }}>
        Open it to activate your account, then sign in again to continue.
      </p>

      <div style={{
        background: 'var(--gold-wash)', color: 'var(--gold-deep)', borderRadius: 10,
        padding: '12px 16px', marginBottom: 28, fontSize: 'var(--text-sm)', lineHeight: 1.5, textAlign: 'left',
      }}>
        📁 <strong>Can't find it?</strong> Please check your <strong>Spam</strong> or <strong>Junk</strong> folder —
        the ToWin verification email often lands there. If you find it, mark it “Not spam” so future emails reach your inbox.
      </div>

      <button onClick={resend} disabled={sending} style={primaryBtn}>
        {sending ? 'Sending…' : 'Resend email'}
      </button>
      <button onClick={backToLogin} style={linkBtn}>
        I've verified — sign in
      </button>
    </div>
  );
}
