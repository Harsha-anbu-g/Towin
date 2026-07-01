import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import SmoothInput from '../components/SmoothInput';

const SF = '-apple-system, "SF Pro Text", system-ui, sans-serif';
const SFD = '-apple-system, "SF Pro Display", system-ui, sans-serif';
const BLUE = '#4FA3CE';
const BORDER = '#BFD9EA';

const ROLES = [
  { value: 'ELDER', label: 'Elder', desc: 'Looking for friends or help' },
  { value: 'HELPER', label: 'Helper', desc: 'Want to help others' },
];

export default function FinishSetup() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();

  const onboardingToken = state?.onboardingToken;
  const googleEmail = state?.email || '';
  const googleName = state?.name || '';

  const [role, setRole] = useState('ELDER');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // Guard: if someone navigates here directly without an onboarding token, send them to login
  if (!onboardingToken) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100%', padding: '40px 24px',
        fontFamily: SF, textAlign: 'center',
      }}>
        <p style={{ color: 'var(--ink-slate)', marginBottom: '20px' }}>
          This page is only accessible after signing in with Google.
        </p>
        <Link to="/login" style={{
          height: '44px', lineHeight: '44px', padding: '0 28px',
          background: BLUE, color: '#fff',
          borderRadius: '9999px', textDecoration: 'none',
          fontSize: '16px', fontFamily: SF,
        }}>
          Go to log in
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const errs = {};
    if (!/^[a-z0-9_]{3,20}$/.test(username)) errs.username = 'Username must be 3-20 characters: lowercase letters, numbers, underscores only';
    const digits = phone.replace(/[\s()-]/g, '');
    if (!/^\+?[0-9]{10,15}$/.test(digits)) errs.phone = 'Enter a valid phone number (10 to 15 digits)';
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    setFieldErrors({});
    setLoading(true);
    try {
      const { data } = await api.post('/auth/oauth/complete', {
        onboardingToken,
        role,
        phone: digits,
        username,
      });
      login(data.token);
      navigate('/profile', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100%', padding: '40px 24px',
      background: '#f9fafb', fontFamily: SF,
    }}>
      <div style={{
        width: '100%', maxWidth: '420px',
        background: '#ffffff', borderRadius: '20px',
        padding: '40px 36px',
        border: `1px solid rgba(191,217,234,0.6)`,
        boxShadow: '0 1px 2px rgba(16,42,67,0.04), 0 10px 28px rgba(16,42,67,0.07)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <img src="/tortoise-logo-alpha.png" alt="ToWin" style={{ width: 48, height: 48, objectFit: 'contain' }} />
        </div>

        <h2 style={{
          fontFamily: SFD, fontSize: 'var(--text-xl)', fontWeight: 600,
          color: 'var(--ink)', textAlign: 'center', margin: '0 0 8px',
          letterSpacing: '-0.3px',
        }}>
          One last step
        </h2>
        <p style={{
          fontSize: '16px', color: 'var(--ink-3)', textAlign: 'center',
          margin: '0 0 28px', lineHeight: 1.5,
        }}>
          {googleName ? `Welcome, ${googleName.split(' ')[0]}! ` : ''}
          Tell us a little more to finish creating your account.
        </p>

        {googleEmail && (
          <div style={{
            background: 'var(--blue-wash)', border: `1px solid ${BORDER}`,
            borderRadius: '10px', padding: '10px 14px',
            fontSize: '14px', color: 'var(--blue-teal)', marginBottom: '24px',
            textAlign: 'center',
          }}>
            Signing in as <strong>{googleEmail}</strong>
          </div>
        )}

        {error && (
          <div style={{
            background: 'var(--red-tint)', border: '1px solid #fecaca',
            borderRadius: '11px', padding: '12px 16px',
            fontSize: 'var(--text-sm)', color: 'var(--red-error)', marginBottom: '20px',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Role picker */}
          <div>
            <label style={{
              display: 'block', fontSize: '14px', fontWeight: 600,
              color: 'var(--ink)', marginBottom: '10px',
            }}>
              I am joining as
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {ROLES.map(({ value, label, desc }) => {
                const active = role === value;
                return (
                  <button key={value} type="button" onClick={() => setRole(value)}
                    style={{
                      padding: '14px 12px', borderRadius: '11px',
                      border: active ? `2px solid ${BLUE}` : '1.5px solid #e0e0e0',
                      background: active ? '#EAF5FB' : '#ffffff',
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.15s',
                    }}>
                    <div style={{
                      fontSize: 'var(--text-sm)', fontWeight: 600,
                      color: active ? BLUE : '#1d1d1f', marginBottom: '4px',
                    }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: active ? '#7BB8D6' : '#a0a0a5', lineHeight: 1.3 }}>
                      {desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Username */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
              Username
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                fontSize: '16px', color: 'var(--ink-4)', pointerEvents: 'none',
              }}>@</span>
              <SmoothInput
                type="text" autoComplete="username" required
                value={username}
                onChange={e => { setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')); setFieldErrors(f => ({ ...f, username: '' })); }}
                placeholder="your_username"
                className="field"
                style={{ borderColor: fieldErrors.username ? '#fca5a5' : undefined, paddingLeft: '28px' }}
              />
            </div>
            {fieldErrors.username && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--red-error)', marginTop: '4px' }}>{fieldErrors.username}</p>}
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-4)', marginTop: '4px', lineHeight: 1.4 }}>
              3-20 characters. Visible to others on your profile.
            </p>
          </div>

          {/* Phone */}
          <div>
            <label style={{
              display: 'block', fontSize: '14px', fontWeight: 600,
              color: 'var(--ink)', marginBottom: '6px',
            }}>
              Phone number
            </label>
            <SmoothInput
              type="tel" autoComplete="tel" required
              value={phone}
              onChange={e => { setPhone(e.target.value); setFieldErrors(f => ({ ...f, phone: '' })); }}
              placeholder="+1 416 555 0123"
              className="field"
              style={{ borderColor: fieldErrors.phone ? '#fca5a5' : undefined }}
            />
            {fieldErrors.phone && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--red-error)', marginTop: '4px' }}>{fieldErrors.phone}</p>
            )}
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-4)', marginTop: '4px', lineHeight: 1.4 }}>
              Only shared after both people reach the Phone Ready trust stage.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', height: '48px',
              background: loading ? '#7BB8D6' : BLUE,
              color: '#fff', border: 'none', borderRadius: '9999px',
              fontSize: '17px', fontWeight: 400,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: SF, transition: 'background 0.15s',
              boxShadow: '0 6px 18px rgba(79,163,206,0.35)',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
