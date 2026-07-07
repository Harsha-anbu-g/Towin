import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import BlurFade from '../components/magic/BlurFade';
import api from '../api/axios';
import SmoothInput from '../components/SmoothInput';

const SF = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const SKY = 'var(--blue)';

const labelStyle = {
  display: 'block', fontSize: '14px', fontWeight: 600,
  color: 'var(--ink-3)', marginBottom: '6px',
};
const inputStyle = { width: '100%', boxSizing: 'border-box' };

export default function ChangePassword() {
  const navigate = useNavigate();
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(false);
  // null while loading; false = Google-only account setting its first password
  const [hasPassword, setHasPassword] = useState(null);

  useEffect(() => {
    api.get('/profile/me')
      .then(r => setHasPassword(r.data.hasPassword !== false))
      .catch(() => setHasPassword(true));
  }, []);

  const settingFirst = hasPassword === false;

  async function submit(e) {
    e.preventDefault(); setMsg('');
    if (pw.next.length < 8) { setMsg('New password must be at least 8 characters.'); return; }
    if (pw.next !== pw.confirm) { setMsg('New passwords do not match.'); return; }
    setSaving(true);
    try {
      if (settingFirst) {
        await api.post('/auth/set-password', { newPassword: pw.next });
      } else {
        await api.post('/auth/change-password', { currentPassword: pw.current, newPassword: pw.next });
      }
      setDone(true);
      setPw({ current: '', next: '', confirm: '' });
    } catch (err) {
      setMsg(err?.response?.data?.message || (settingFirst ? 'Could not set password.' : 'Could not change password.'));
    } finally { setSaving(false); }
  }

  return (
    <div style={{ minHeight: '100svh', background: 'var(--surface-pearl)', fontFamily: SFText }}>
      <NavBar />
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '32px 20px 80px' }}>

        {/* Back */}
        <button
          onClick={() => navigate('/profile')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px',
            fontFamily: SFText, fontSize: 'var(--text-sm)', color: SKY, fontWeight: 600,
            marginBottom: '24px', padding: 0,
          }}
        >
          <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
            <path d="M8.5 1L1.5 8L8.5 15" stroke={SKY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to profile
        </button>

        {hasPassword !== null && (
        <BlurFade delay={1}>
          <div style={{ background: 'var(--canvas)', borderRadius: '18px', padding: '28px', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--ink)', fontFamily: SF, letterSpacing: '-0.3px', marginBottom: '6px' }}>
              {settingFirst ? 'Set a Password' : 'Change Password'}
            </p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)', marginBottom: '22px' }}>
              {settingFirst
                ? 'Choose a password so you can also sign in with your username. Signing in with Google will keep working.'
                : 'Enter your current password, then choose a new one.'}
            </p>

            {done ? (
              <div>
                <p style={{ fontSize: '16px', color: 'var(--blue-deep)', fontWeight: 600, marginBottom: '20px' }}>
                  {settingFirst
                    ? '✓ Password set. Next time you can sign in with your username and password, or with Google.'
                    : '✓ Password changed. You can use your new password next time you sign in.'}
                </p>
                <button onClick={() => navigate('/profile')} className="primary-btn" style={{ fontSize: '16px' }}>
                  Back to profile
                </button>
              </div>
            ) : (
              <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {!settingFirst && (
                  <div>
                    <label style={labelStyle}>Current password</label>
                    <SmoothInput type="password" autoComplete="current-password" value={pw.current}
                      onChange={e => setPw(p => ({ ...p, current: e.target.value }))}
                      placeholder="Your current password" className="field" required style={inputStyle} />
                  </div>
                )}
                <div>
                  <label style={labelStyle}>New password</label>
                  <SmoothInput type="password" autoComplete="new-password" value={pw.next}
                    onChange={e => setPw(p => ({ ...p, next: e.target.value }))}
                    placeholder="At least 8 characters" className="field" required style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Confirm new password</label>
                  <SmoothInput type="password" autoComplete="new-password" value={pw.confirm}
                    onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))}
                    placeholder="Type it again" className="field" required style={inputStyle} />
                </div>
                {msg && (
                  <p style={{ fontSize: '14px', color: 'var(--ink-slate)', fontWeight: 500, margin: 0 }}>
                    {msg}
                  </p>
                )}
                <button type="submit" disabled={saving} className="primary-btn" style={{ fontSize: '16px', marginTop: '4px' }}>
                  {saving ? 'Saving…' : settingFirst ? 'Set password' : 'Change password'}
                </button>
              </form>
            )}
          </div>
        </BlurFade>
        )}
      </div>
    </div>
  );
}
