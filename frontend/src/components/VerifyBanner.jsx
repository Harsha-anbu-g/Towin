import { useState } from 'react';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/useToast';
import api from '../api/axios';

// Shown app-wide only for a logged-in user whose email is not yet verified.
// Guests, Google, demo and grandfathered accounts are already verified, so the
// banner stays hidden for them.
export default function VerifyBanner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sending, setSending] = useState(false);

  if (!user || user.emailVerified !== false) return null;

  const resend = async () => {
    setSending(true);
    try {
      await api.post('/auth/resend-verification');
      toast.success('Verification email sent. Check your inbox.');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not send the email. Try again shortly.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{
      width: '100%',
      background: 'var(--gold-wash)',
      color: 'var(--gold-deep)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      flexWrap: 'wrap',
      padding: '10px 20px',
      fontSize: 'var(--text-sm)',
      fontFamily: `-apple-system, 'SF Pro Text', system-ui, sans-serif`,
      boxSizing: 'border-box',
      zIndex: 'var(--z-banner)',
    }}>
      <span>Please verify your email to unlock posting, messaging, and connections.</span>
      <button
        onClick={resend}
        disabled={sending}
        style={{
          background: 'none', border: 'none', color: 'var(--gold-deep)',
          fontWeight: 700, cursor: sending ? 'default' : 'pointer',
          textDecoration: 'underline', opacity: sending ? 0.6 : 1,
        }}
      >
        {sending ? 'Sending…' : 'Resend email'}
      </button>
    </div>
  );
}
