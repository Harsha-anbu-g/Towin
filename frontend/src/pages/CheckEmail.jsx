import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import api from '../api/axios';

// Shown right after a manual signup. The account does NOT exist yet — it's
// created only when the user opens the link. So the user is not logged in here.
export default function CheckEmail() {
  const { state } = useLocation();
  const { toast } = useToast();
  const email = state?.email;
  const [sending, setSending] = useState(false);

  const resend = async () => {
    if (!email) { toast.error('Please sign up again to get a new link.'); return; }
    setSending(true);
    try {
      await api.post('/auth/resend-verification', { email });
      toast.success('Verification email sent. Check your inbox.');
    } catch {
      toast.error('Could not resend right now. Try again shortly.');
    } finally {
      setSending(false);
    }
  };

  const card = {
    maxWidth: 460, margin: '0 auto', padding: '64px 24px', textAlign: 'center',
    fontFamily: `-apple-system, 'SF Pro Text', system-ui, sans-serif`, color: '#2d3748',
  };
  const primaryBtn = {
    background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 10,
    padding: '12px 22px', fontSize: 17, fontWeight: 600, cursor: sending ? 'default' : 'pointer',
    opacity: sending ? 0.6 : 1, width: '100%', marginBottom: 12,
  };

  return (
    <div style={card}>
      <div style={{ fontSize: 44, marginBottom: 16 }}>✉️</div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Confirm your email</h1>
      <p style={{ color: '#718096', marginBottom: 8 }}>
        We sent a confirmation link to{email ? <> <strong>{email}</strong></> : ' your email'}.
      </p>
      <p style={{ color: '#718096', marginBottom: 20 }}>
        Open it to finish creating your account — then come back and log in.
      </p>

      <div style={{
        background: '#FBEED9', color: '#7a5b1e', borderRadius: 10,
        padding: '12px 16px', marginBottom: 28, fontSize: 15, lineHeight: 1.5, textAlign: 'left',
      }}>
        📁 <strong>Can't find it?</strong> Please check your <strong>Spam</strong> or <strong>Junk</strong> folder —
        the ToWin email often lands there. If you find it, mark it “Not spam” so future emails reach your inbox.
      </div>

      <button onClick={resend} disabled={sending} style={primaryBtn}>
        {sending ? 'Sending…' : 'Resend email'}
      </button>
      <Link to="/login" style={{ color: 'var(--blue)', fontWeight: 600, textDecoration: 'underline', fontSize: 15 }}>
        Back to log in
      </Link>
    </div>
  );
}
