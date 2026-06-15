import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

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
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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
        <p style={{ color: '#5a6470', marginBottom: '20px' }}>
          This page is only accessible after signing in with Google.
        </p>
        <Link to="/login" style={{
          height: '44px', lineHeight: '44px', padding: '0 28px',
          background: BLUE, color: '#fff',
          borderRadius: '9999px', textDecoration: 'none',
          fontSize: '15px', fontFamily: SF,
        }}>
          Go to Sign In
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
    if (password.length < 8) errs.password = 'Password must be at least 8 characters';
    if (confirmPassword !== password) errs.confirmPassword = 'Passwords do not match';
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    setFieldErrors({});
    setLoading(true);
    try {
      const { data } = await api.post('/auth/oauth/complete', {
        onboardingToken,
        role,
        phone: digits,
        username,
        password,
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
          fontFamily: SFD, fontSize: '28px', fontWeight: 600,
          color: '#1d1d1f', textAlign: 'center', margin: '0 0 8px',
          letterSpacing: '-0.3px',
        }}>
          One last step
        </h2>
        <p style={{
          fontSize: '15px', color: '#7a7a7a', textAlign: 'center',
          margin: '0 0 28px', lineHeight: 1.5,
        }}>
          {googleName ? `Welcome, ${googleName.split(' ')[0]}! ` : ''}
          Tell us a little more to finish creating your account.
        </p>

        {googleEmail && (
          <div style={{
            background: '#EAF5FB', border: `1px solid ${BORDER}`,
            borderRadius: '10px', padding: '10px 14px',
            fontSize: '13px', color: '#3D8AB0', marginBottom: '24px',
            textAlign: 'center',
          }}>
            Signing in as <strong>{googleEmail}</strong>
          </div>
        )}

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: '11px', padding: '12px 16px',
            fontSize: '14px', color: '#dc2626', marginBottom: '20px',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Role picker */}
          <div>
            <label style={{
              display: 'block', fontSize: '13px', fontWeight: 600,
              color: '#1d1d1f', marginBottom: '10px',
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
                      fontSize: '14px', fontWeight: 600,
                      color: active ? BLUE : '#1d1d1f', marginBottom: '4px',
                    }}>
                      {label}
                    </div>
                    <div style={{ fontSize: '12px', color: active ? '#7BB8D6' : '#a0a0a5', lineHeight: 1.3 }}>
                      {desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Username */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1d1d1f', marginBottom: '6px' }}>
              Username
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                fontSize: '15px', color: '#a0a0a5', pointerEvents: 'none',
              }}>@</span>
              <input
                type="text" autoComplete="username" required
                value={username}
                onChange={e => { setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')); setFieldErrors(f => ({ ...f, username: '' })); }}
                placeholder="your_username"
                className="field"
                style={{ borderColor: fieldErrors.username ? '#fca5a5' : undefined, paddingLeft: '28px' }}
              />
            </div>
            {fieldErrors.username && <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>{fieldErrors.username}</p>}
            <p style={{ fontSize: '12px', color: '#a0a0a5', marginTop: '4px', lineHeight: 1.4 }}>
              3-20 characters. Visible to others on your profile.
            </p>
          </div>

          {/* Phone */}
          <div>
            <label style={{
              display: 'block', fontSize: '13px', fontWeight: 600,
              color: '#1d1d1f', marginBottom: '6px',
            }}>
              Phone number
            </label>
            <input
              type="tel" autoComplete="tel" required
              value={phone}
              onChange={e => { setPhone(e.target.value); setFieldErrors(f => ({ ...f, phone: '' })); }}
              placeholder="+1 416 555 0123"
              className="field"
              style={{ borderColor: fieldErrors.phone ? '#fca5a5' : undefined }}
            />
            {fieldErrors.phone && (
              <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>{fieldErrors.phone}</p>
            )}
            <p style={{ fontSize: '12px', color: '#a0a0a5', marginTop: '4px', lineHeight: 1.4 }}>
              Only shared after both people reach the Phone Ready trust stage.
            </p>
          </div>

          {/* Password */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1d1d1f', marginBottom: '6px' }}>
              Set a password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPwd ? 'text' : 'password'} autoComplete="new-password" required
                value={password}
                onChange={e => { setPassword(e.target.value); setFieldErrors(f => ({ ...f, password: '' })); }}
                placeholder="At least 8 characters"
                className="field"
                style={{ borderColor: fieldErrors.password ? '#fca5a5' : undefined, paddingRight: '44px' }}
              />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: '#7a7a7a', fontSize: '13px' }}>
                {showPwd ? 'Hide' : 'Show'}
              </button>
            </div>
            {fieldErrors.password && <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>{fieldErrors.password}</p>}
            <p style={{ fontSize: '12px', color: '#a0a0a5', marginTop: '4px', lineHeight: 1.4 }}>
              You can also use this password to log in without Google.
            </p>
          </div>

          {/* Confirm Password */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1d1d1f', marginBottom: '6px' }}>
              Re-enter password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirm ? 'text' : 'password'} autoComplete="new-password" required
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setFieldErrors(f => ({ ...f, confirmPassword: '' })); }}
                placeholder="Type the same password again"
                className="field"
                style={{ borderColor: fieldErrors.confirmPassword ? '#fca5a5' : undefined, paddingRight: '44px' }}
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: '#7a7a7a', fontSize: '13px' }}>
                {showConfirm ? 'Hide' : 'Show'}
              </button>
            </div>
            {fieldErrors.confirmPassword && <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>{fieldErrors.confirmPassword}</p>}
            {confirmPassword && password && confirmPassword === password && (
              <p style={{ fontSize: '12px', color: '#5FA670', marginTop: '4px' }}>Passwords match</p>
            )}
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
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
