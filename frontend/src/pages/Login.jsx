import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

function HeroPanel() {
  return (
    <div className="auth-hero" style={{
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      padding: '52px 48px',
      background:
        'radial-gradient(ellipse at 25% 15%, rgba(255,255,255,0.55) 0%, transparent 55%),' +
        'radial-gradient(ellipse at 80% 85%, #BFD9EA 0%, transparent 60%),' +
        'linear-gradient(160deg, #EAF5FB 0%, #BFD9EA 45%, #4FA3CE 100%)',
    }}>
      {/* Hero photo — handshake between elder and younger hand */}
      <img
        src="/image3.png"
        alt="A handshake between an elder and a younger person"
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: 'center 70%', zIndex: 0,
        }}
      />

      {/* Soft readability wash — keeps the calm, never harsh black */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background:
          'linear-gradient(to top, rgba(20,55,80,0.62) 0%, rgba(20,55,80,0.30) 45%, rgba(20,55,80,0.05) 100%)',
      }} />

      {/* Turtle logo + wordmark top-left */}
      <div style={{
        position: 'absolute', top: '32px', left: '48px', zIndex: 2,
        display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <img src="/logo.png" alt="ToWin logo" style={{ width: 40, height: 40, objectFit: 'contain' }} />
        <p style={{
          fontSize: '22px', fontWeight: 800, color: '#fff', letterSpacing: '-0.4px',
          fontFamily: '-apple-system, "SF Pro Display", system-ui, sans-serif',
          margin: 0,
        }}>
          ToWin
        </p>
      </div>

      {/* Bottom content */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        <h1 style={{
          fontFamily: '-apple-system, "SF Pro Display", system-ui, sans-serif',
          fontSize: '40px', lineHeight: 1.15, color: '#fff',
          marginBottom: '16px', letterSpacing: '-0.3px', fontWeight: 600,
          textShadow: '0 2px 24px rgba(20,55,80,0.45)',
        }}>
          Connecting generations,<br />building trust.
        </h1>
        <p style={{
          fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
          fontSize: '17px', color: 'rgba(255,255,255,0.94)', maxWidth: '420px',
          lineHeight: 1.55, margin: 0,
          textShadow: '0 1px 12px rgba(20,55,80,0.5)',
        }}>
          A safer place for elders and helpers to meet, talk, and grow trust at their own pace.
        </p>
      </div>
    </div>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [showPwd, setShowPwd] = useState(false);

  const [guestLoading, setGuestLoading] = useState('');

  const DEMO = {
    ELDER:  { email: 'elder@gmail.com',  password: '12345678' },
    HELPER: { email: 'helper@gmail.com', password: '123456789' },
  };

  const handleGuest = async (role) => {
    setGuestLoading(role);
    setError('');
    try {
      const { data } = await api.post('/auth/login', DEMO[role]);
      login(data.token);
      navigate(
        (data.role === 'ELDER' || data.role === 'BOTH') ? '/streaks' : '/dashboard'
      );
    } catch {
      setError('Could not start demo session. Please try again.');
    } finally {
      setGuestLoading('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const errs = {};
    if (!form.email.includes('@')) errs.email = 'Enter a valid email address';
    if (form.password.length < 6) errs.password = 'Password must be at least 6 characters';
    if (Object.keys(errs).length) { setFieldErrors(errs); setLoading(false); return; }
    setFieldErrors({});
    try {
      const { data } = await api.post('/auth/login', form);
      login(data.token);
      navigate(
        data.role === 'ADMIN' ? '/admin' :
        (data.role === 'ELDER' || data.role === 'BOTH') ? '/streaks' :
        '/dashboard'
      );
    } catch {
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <HeroPanel />

      {/* Right panel */}
      <div className="auth-form">
        <div style={{ width: '100%', maxWidth: '380px' }}>
          {/* Form card */}
          <div className="auth-card" style={{
            background: '#ffffff',
            borderRadius: '18px',
            padding: '40px 36px',
            border: '1px solid #e0e0e0',
          }}>
            {/* Headline */}
            <h2 style={{
              fontFamily: '-apple-system, "SF Pro Display", system-ui, sans-serif',
              fontSize: '34px', fontWeight: 600, color: '#1d1d1f',
              marginBottom: '8px', letterSpacing: '-0.3px',
            }}>
              Welcome back.
            </h2>
            <p style={{
              fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
              fontSize: '17px', color: '#7a7a7a', marginBottom: '20px',
            }}>
              Sign in to your ToWin account.
            </p>

            {/* Hairline divider */}
            <div style={{ height: '1px', background: '#e0e0e0', marginBottom: '24px' }} />

            {/* Error state */}
            {error && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: '11px', padding: '12px 16px',
                fontSize: '14px', color: '#dc2626', marginBottom: '20px',
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{
                  display: 'block', fontSize: '13px', fontWeight: 600,
                  color: '#1d1d1f', marginBottom: '6px',
                  fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
                }}>
                  Email address
                </label>
                <input
                  type="email" required autoComplete="email"
                  className="field"
                  value={form.email}
                  onChange={e => { setForm({ ...form, email: e.target.value }); setFieldErrors(f => ({ ...f, email: '' })); }}
                  placeholder="you@example.com"
                  style={{ borderColor: fieldErrors.email ? '#fca5a5' : undefined }}
                />
                {fieldErrors.email && <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px', fontFamily: 'inherit' }}>{fieldErrors.email}</p>}
              </div>

              <div>
                <label style={{
                  display: 'block', fontSize: '13px', fontWeight: 600,
                  color: '#1d1d1f', marginBottom: '6px',
                  fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
                }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPwd ? 'text' : 'password'} required autoComplete="current-password"
                    className="field"
                    value={form.password}
                    onChange={e => { setForm({ ...form, password: e.target.value }); setFieldErrors(f => ({ ...f, password: '' })); }}
                    placeholder="••••••••"
                    style={{ borderColor: fieldErrors.password ? '#fca5a5' : undefined, paddingRight: '44px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', padding: '6px',
                      color: '#7a7a7a', display: 'flex',
                    }}
                  >
                    {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {fieldErrors.password && <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px', fontFamily: 'inherit' }}>{fieldErrors.password}</p>}
                {/* Forgot password */}
                <div style={{ textAlign: 'right', marginTop: '6px' }}>
                  <Link to="/forgot-password" style={{
                    fontSize: '13px', color: '#4FA3CE',
                    textDecoration: 'none',
                    fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
                  }}>
                    Forgot password?
                  </Link>
                </div>
              </div>

              {/* Blue pill Sign In button */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', height: '48px',
                  background: loading ? '#7BB8D6' : '#4FA3CE',
                  color: '#ffffff',
                  border: 'none', borderRadius: '9999px',
                  fontSize: '16px', fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
                  marginTop: '4px',
                  transition: 'background 0.15s',
                }}
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            {/* Create account link */}
            <p style={{
              textAlign: 'center', fontSize: '14px', color: '#7a7a7a',
              fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
              marginTop: '20px',
            }}>
              Don&apos;t have an account?{' '}
              <Link to="/register" style={{ color: '#4FA3CE', fontWeight: 600, textDecoration: 'none' }}>
                Create one
              </Link>
            </p>
            <div style={{ textAlign: 'center', marginTop: '14px' }}>
              <Link to="/how-it-works" style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                background: '#4FA3CE', color: '#ffffff', textDecoration: 'none',
                borderRadius: '9999px', padding: '11px 24px',
                fontSize: '14px', fontWeight: 700,
                fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
                boxShadow: '0 4px 16px rgba(79,163,206,0.35)',
              }}>
                How ToWin works
              </Link>
            </div>
            <p style={{
              textAlign: 'center', fontSize: '13px', color: '#a0a0a5',
              fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
              marginTop: '12px',
            }}>
              <Link to="/feedback" style={{ color: '#7a7a7a', textDecoration: 'none' }}>
                Share feedback
              </Link>
            </p>

            {/* Demo accounts */}
            <div style={{ marginTop: '24px' }}>
              <p style={{ fontSize: '12px', color: '#a0a0a5', fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif', textAlign: 'center', marginBottom: '12px', letterSpacing: '0.3px' }}>
                Or explore with a demo account
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                {[
                  { role: 'ELDER', title: 'Elder', name: 'Margaret · Trust Score 14', initial: 'M' },
                  { role: 'HELPER', title: 'Helper', name: 'James · Trust Score 32', initial: 'J' },
                ].map(({ role, title, name, initial }) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleGuest(role)}
                    disabled={!!guestLoading}
                    style={{
                      flex: 1,
                      background: '#f5f5f7',
                      border: '1px solid #e8e8e8',
                      borderRadius: '14px',
                      padding: '14px 12px',
                      cursor: guestLoading ? 'not-allowed' : 'pointer',
                      opacity: guestLoading && guestLoading !== role ? 0.5 : 1,
                      textAlign: 'left',
                      transition: 'background 0.15s',
                      fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
                    }}
                    onMouseEnter={e => { if (!guestLoading) e.currentTarget.style.background = '#ebebed'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#f5f5f7'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        background: '#e0e0e0', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '14px', fontWeight: 700, color: '#5a6470',
                      }}>
                        {guestLoading === role ? '…' : initial}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#1d1d1f' }}>{title}</p>
                        <p style={{ margin: 0, fontSize: '12px', color: '#7a7a7a', marginTop: '1px' }}>{name}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
