import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useToast } from '../context/useToast';
import api from '../api/axios';
import { tr } from '../i18n';
import emphasize from '../i18n/emphasize';

// Shown right after a manual signup. The account does NOT exist yet — it's
// created only when the user opens the link. So the user is not logged in here.
export default function CheckEmail() {
  const { state } = useLocation();
  const { toast } = useToast();
  const email = state?.email;
  const [sending, setSending] = useState(false);

  const resend = async () => {
    if (!email) { toast.error(tr('Please sign up again to get a new link.')); return; }
    setSending(true);
    try {
      await api.post('/auth/resend-verification', { email });
      toast.success(tr('Verification email sent. Check your inbox.'));
    } catch {
      toast.error(tr('Could not resend right now. Try again shortly.'));
    } finally {
      setSending(false);
    }
  };

  const card = {
    maxWidth: 460, margin: '0 auto', padding: '64px 24px', textAlign: 'center',
    fontFamily: `-apple-system, 'SF Pro Text', system-ui, sans-serif`, color: 'var(--ink-deep)',
  };
  const primaryBtn = {
    background: 'var(--action-fill)', color: 'var(--action-ink)', border: 'none', borderRadius: 10,
    padding: '12px 22px', fontSize: 17, fontWeight: 600, cursor: sending ? 'default' : 'pointer',
    opacity: sending ? 0.6 : 1, width: '100%', marginBottom: 12,
  };

  return (
    <div style={card}>
      <div style={{ fontSize: 44, marginBottom: 16 }}>✉️</div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>{tr('Confirm your email')}</h1>
      <p style={{ color: 'var(--slate)', marginBottom: 8 }}>
        {email
          ? tr('We sent a confirmation link to {email}.').split('{email}').map((part, i) => (i === 0 ? part : <span key={i}><strong>{email}</strong>{part}</span>))
          : tr('We sent a confirmation link to your email.')}
      </p>
      <p style={{ color: 'var(--slate)', marginBottom: 20 }}>
        {tr('Open it to finish creating your account — then come back and log in.')}
      </p>

      <div style={{
        background: 'var(--gold-wash)', color: 'var(--gold-deep)', borderRadius: 10,
        padding: '12px 16px', marginBottom: 28, fontSize: 'var(--text-sm)', lineHeight: 1.5, textAlign: 'left',
      }}>
        📁 {emphasize(tr("*Can't find it?* Please check your *Spam* or *Junk* folder — the Towinly email often lands there. If you find it, mark it “Not spam” so future emails reach your inbox."), (part) => <strong>{part}</strong>)}
      </div>

      <button onClick={resend} disabled={sending} style={primaryBtn}>
        {sending ? tr('Sending…') : tr('Resend email')}
      </button>
      <Link to="/login" style={{ color: 'var(--blue-deep)', fontWeight: 600, textDecoration: 'underline', fontSize: 'var(--text-sm)' }}>
        {tr('Back to log in')}
      </Link>
    </div>
  );
}
