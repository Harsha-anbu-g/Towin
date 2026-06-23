import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import BlurFade from '../components/magic/BlurFade';
import api from '../api/axios';

const SF = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const SKY = '#4FA3CE';

const labelStyle = {
  display: 'block', fontSize: '14px', fontWeight: 600,
  color: '#7a7a7a', marginBottom: '6px',
};
const inputStyle = { width: '100%', boxSizing: 'border-box' };

export default function ChangePassword() {
  const navigate = useNavigate();
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault(); setMsg('');
    if (pw.next.length < 8) { setMsg('New password must be at least 8 characters.'); return; }
    if (pw.next !== pw.confirm) { setMsg('New passwords do not match.'); return; }
    setSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword: pw.current, newPassword: pw.next });
      setDone(true);
      setMsg('Password changed.');
      setPw({ current: '', next: '', confirm: '' });
    } catch (err) {
      setMsg(err?.response?.data?.message || 'Could not change password.');
    } finally { setSaving(false); }
  }

  return (
    <div style={{ minHeight: '100svh', background: '#fafafc', fontFamily: SFText }}>
      <NavBar />
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '32px 20px 80px' }}>

        {/* Back */}
        <button
          onClick={() => navigate('/profile')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px',
            fontFamily: SFText, fontSize: '15px', color: SKY, fontWeight: 600,
            marginBottom: '24px', padding: 0,
          }}
        >
          <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
            <path d="M8.5 1L1.5 8L8.5 15" stroke={SKY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to profile
        </button>

        <BlurFade delay={1}>
          <div style={{ background: '#ffffff', borderRadius: '18px', padding: '28px', border: '1px solid #e0e0e0' }}>
            <p style={{ fontSize: '22px', fontWeight: 600, color: '#1d1d1f', fontFamily: SF, letterSpacing: '-0.3px', marginBottom: '6px' }}>
              Change Password
            </p>
            <p style={{ fontSize: '15px', color: '#7a7a7a', marginBottom: '22px' }}>
              Enter your current password, then choose a new one.
            </p>

            {done ? (
              <div>
                <p style={{ fontSize: '16px', color: '#4FA3CE', fontWeight: 600, marginBottom: '20px' }}>
                  ✓ Password changed. You can use your new password next time you sign in.
                </p>
                <button onClick={() => navigate('/profile')} className="primary-btn" style={{ fontSize: '16px' }}>
                  Back to profile
                </button>
              </div>
            ) : (
              <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Current password</label>
                  <input type="password" autoComplete="current-password" value={pw.current}
                    onChange={e => setPw(p => ({ ...p, current: e.target.value }))}
                    placeholder="Your current password" className="field" required style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>New password</label>
                  <input type="password" autoComplete="new-password" value={pw.next}
                    onChange={e => setPw(p => ({ ...p, next: e.target.value }))}
                    placeholder="At least 8 characters" className="field" required style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Confirm new password</label>
                  <input type="password" autoComplete="new-password" value={pw.confirm}
                    onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))}
                    placeholder="Type it again" className="field" required style={inputStyle} />
                </div>
                {msg && (
                  <p style={{ fontSize: '14px', color: '#5a6470', fontWeight: 500, margin: 0 }}>
                    {msg}
                  </p>
                )}
                <button type="submit" disabled={saving} className="primary-btn" style={{ fontSize: '16px', marginTop: '4px' }}>
                  {saving ? 'Saving…' : 'Change password'}
                </button>
              </form>
            )}
          </div>
        </BlurFade>
      </div>
    </div>
  );
}
