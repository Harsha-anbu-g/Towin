import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import SiteFooter from '../components/SiteFooter';
import SmoothInput from '../components/SmoothInput';
import { yearsOld } from '../lib/copy';

function HeroPanel() {
  return (
    <div className="auth-hero" style={{
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      padding: '52px 48px',
      background:
        'radial-gradient(ellipse at 25% 15%, rgba(255,255,255,0.55) 0%, transparent 55%),' +
        'radial-gradient(ellipse at 80% 85%, var(--blue-soft) 0%, transparent 60%),' +
        'linear-gradient(160deg, var(--blue-wash) 0%, var(--blue-soft) 45%, var(--blue) 100%)',
    }}>
      {/* Hero photo — handshake between elder and younger hand */}
      <img
        src="/image3.jpg"
        alt="A handshake between an elder and a younger person"
        draggable="false"
        onDragStart={e => e.preventDefault()}
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: 'center 15%', zIndex: 0,
          userSelect: 'none', WebkitUserDrag: 'none',
        }}
      />

      {/* Soft readability wash — keeps the calm, never harsh black */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background:
          'linear-gradient(to top, rgba(20,55,80,0.62) 0%, rgba(20,55,80,0.30) 45%, rgba(20,55,80,0.05) 100%)',
      }} />

      {/* Tagline — centered on the photo */}
      <p style={{
        position: 'absolute', bottom: '15%', left: '50%', transform: 'translateX(-50%)',
        zIndex: 2, whiteSpace: 'nowrap', margin: 0,
        fontSize: '30px', fontWeight: 400, letterSpacing: '-0.02em', color: '#fff',
        textShadow: '0 2px 20px rgba(20,55,80,0.55)',
        fontFamily: 'var(--font-display)',
      }}>
        It takes two To Win.
      </p>

      {/* Turtle logo + wordmark top-left — back to the landing story */}
      <Link to="/" style={{
        position: 'absolute', top: '32px', left: '48px', zIndex: 2,
        display: 'flex', alignItems: 'center', gap: '10px',
        textDecoration: 'none',
      }}>
        <span style={{
          width: 42, height: 42, borderRadius: '12px', background: '#ffffff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid rgba(20,55,80,0.08)',
          boxShadow: '0 2px 10px rgba(20,55,80,0.22)',
          flexShrink: 0,
        }}>
          <img src="/tortoise-logo-alpha.png" alt="ToWin logo" style={{ width: 26, height: 26, objectFit: 'contain' }} />
        </span>
        <p style={{
          fontSize: '21px', fontWeight: 600, color: '#ffffff', letterSpacing: '-0.374px',
          fontFamily: '-apple-system, "SF Pro Display", system-ui, sans-serif',
          margin: 0,
        }}>
          ToWin
        </p>
      </Link>

      {/* Content — pushed below logo */}
      <div style={{ position: 'relative', zIndex: 2, marginTop: '44px' }}>
        
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-3xl)', lineHeight: 1.12, color: '#fff',
          marginBottom: '16px', letterSpacing: '-0.02em', fontWeight: 400,
          textShadow: '0 2px 24px rgba(20,55,80,0.45)',
        }}>
          Connecting generations,<br />building <span style={{ color: 'var(--trust-gold)' }}>trust</span>.
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

const BACKEND_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api').replace(/\/api$/, '');

function GoogleButton({ label }) {
  const SF = '-apple-system, "SF Pro Text", system-ui, sans-serif';
  return (
    <a
      href={`${BACKEND_URL}/oauth2/authorization/google`}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
        width: '100%', height: '48px',
        background: 'var(--canvas)', border: '1.5px solid var(--border)',
        borderRadius: '9999px', textDecoration: 'none',
        fontSize: '16px', fontWeight: 500, color: 'var(--ink)',
        fontFamily: SF, cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--blue)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      <svg width="20" height="20" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z"/>
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.4 19 12 24 12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5.1l-6.2-5.2C29.4 35.5 26.8 36 24 36c-5.2 0-9.7-3.3-11.3-8H6.5C9.9 35.7 16.4 44 24 44z"/>
        <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C41 36.2 44 30.5 44 24c0-1.3-.1-2.7-.4-3.9z"/>
      </svg>
      {label}
    </a>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [showPwd, setShowPwd] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  const [guestLoading, setGuestLoading] = useState('');

  // If the user was bounced here by an expired session, say so (H9).
  useEffect(() => {
    if (sessionStorage.getItem('sessionExpired')) {
      setSessionExpired(true);
      sessionStorage.removeItem('sessionExpired');
    }
  }, []);

  const DEMO = {
    ELDER:  { identifier: 'elder',  password: '12345678' },
    HELPER: { identifier: 'helper', password: '123456789' },
  };

  const handleGuest = async (role) => {
    setGuestLoading(role);
    setError('');
    try {
      const { data } = await api.post('/auth/login', DEMO[role]);
      login(data.token);
      navigate(
        (data.role === 'ELDER' || data.role === 'BOTH') ? '/streaks' : '/dashboard',
        { replace: true }
      );
    } catch (err) {
      setError(
        err?.response?.status === 429
          ? (err.response.data?.message || 'Too many attempts. Please try again later.')
          : 'Could not start demo session. Please try again.'
      );
    } finally {
      setGuestLoading('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const errs = {};
    if (!form.identifier.trim()) errs.identifier = 'Enter your username, Gmail, or phone number';
    if (form.password.length < 6) errs.password = 'Password must be at least 6 characters';
    if (Object.keys(errs).length) { setFieldErrors(errs); setLoading(false); return; }
    setFieldErrors({});
    try {
      const { data } = await api.post('/auth/login', form);
      login(data.token);
      navigate(
        data.role === 'ADMIN' ? '/admin' :
        (data.role === 'ELDER' || data.role === 'BOTH') ? '/streaks' :
        '/dashboard',
        { replace: true }
      );
    } catch (err) {
      setError(
        err?.response?.status === 429
          ? (err.response.data?.message || 'Too many attempts. Please try again later.')
          : 'Invalid username or password.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <HeroPanel />

      {/* Right panel */}
      <div className="auth-form" style={{ flexDirection: 'column', paddingBottom: 0 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: 0 }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          {/* Demo accounts — shown first so users don't miss it */}
          <div style={{
            marginBottom: '20px', background: 'var(--blue-wash)',
            border: '1.5px solid var(--blue)', borderRadius: '16px',
            padding: '18px 18px 16px',
            position: 'relative',
          }}>
            <span style={{
              position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)',
              background: 'var(--blue)', color: '#fff',
              fontSize: '11px', fontWeight: 700, letterSpacing: '0.8px',
              padding: '3px 12px', borderRadius: '9999px',
              fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
              textTransform: 'uppercase',
            }}>
              DEMO
            </span>
            <p style={{
              fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink)', textAlign: 'center',
              fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
              margin: '0 0 4px',
            }}>
              Just want to see how it works?
            </p>
            <p style={{
              fontSize: 'var(--text-xs)', color: 'var(--ink-slate)', textAlign: 'center',
              fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
              margin: '0 0 14px', lineHeight: 1.5,
            }}>
              Look around with a sample account, no account needed.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                // Ages track the demo accounts' seeded birthdates (DemoDataSeeder)
                // so the chips never drift from what the app itself computes.
                { role: 'ELDER', label: 'Try as an Elder', sub: `Margaret, ${yearsOld('1953-05-14')}` },
                { role: 'HELPER', label: 'Try as a Helper', sub: `Harsha, ${yearsOld('2003-03-14')}` },
              ].map(({ role, label, sub }) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => handleGuest(role)}
                  disabled={!!guestLoading}
                  style={{
                    flex: 1,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--canvas)',
                    border: '1.5px solid var(--blue-soft)',
                    borderRadius: '11px',
                    padding: '12px 10px',
                    cursor: guestLoading ? 'not-allowed' : 'pointer',
                    opacity: guestLoading && guestLoading !== role ? 0.5 : 1,
                    textAlign: 'center',
                    transition: 'border-color 0.15s, background 0.15s',
                    fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
                  }}
                  onMouseEnter={e => { if (!guestLoading) e.currentTarget.style.borderColor = 'var(--blue)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--blue-soft)'; }}
                >
                  <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--blue-teal)' }}>
                    {guestLoading === role ? 'Opening…' : label}
                  </span>
                  <span style={{ display: 'block', fontSize: '12px', color: 'var(--ink-3)', marginTop: '2px' }}>
                    {sub}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Form card */}
          <div className="auth-card" style={{
            background: 'var(--canvas)',
            borderRadius: '18px',
            padding: '40px 36px',
            border: '1px solid var(--border)',
          }}>
            {/* Log in / Create account switcher */}
            <div style={{ display: 'flex', gap: '6px', background: 'var(--surface-2)', borderRadius: '9999px', padding: '5px', marginBottom: '24px' }}>
              <button type="button" style={{
                flex: 1, height: '40px', border: 'none', borderRadius: '9999px',
                fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'default', fontFamily: 'inherit',
                background: 'var(--seg-active)', color: 'var(--blue)', boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
              }}>Log in</button>
              <button type="button" onClick={() => navigate('/register')} style={{
                flex: 1, height: '40px', border: 'none', borderRadius: '9999px',
                fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                background: 'transparent', color: 'var(--ink-3)',
              }}>Create account</button>
            </div>

            {/* Headline */}
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '28px', fontWeight: 400, color: 'var(--ink)',
              marginBottom: '6px', letterSpacing: '-0.02em',
            }}>
              Welcome back.
            </h2>
            <p style={{
              fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
              fontSize: '16px', color: 'var(--ink-3)', marginBottom: '20px',
            }}>
              Log in to your ToWin account.
            </p>

            {/* Session expired notice — explains why they're back here (H9) */}
            {sessionExpired && (
              <div style={{
                background: 'var(--blue-wash)', border: '1px solid var(--blue-soft)',
                borderRadius: '11px', padding: '12px 16px',
                fontSize: 'var(--text-sm)', color: 'var(--blue-teal)', marginBottom: '20px',
                lineHeight: 1.45,
              }}>
                For your safety, you were logged out after a period of inactivity. Please log in again.
              </div>
            )}

            {/* Error state */}
            {error && (
              <div role="alert" style={{
                background: 'var(--red-tint)', border: '1px solid var(--red-line)',
                borderRadius: '11px', padding: '12px 16px',
                fontSize: 'var(--text-sm)', color: 'var(--red-error)', marginBottom: '20px',
              }}>
                {error}
              </div>
            )}

            {/* Google log-in — the easiest path, especially for new users */}
            <GoogleButton label="Log in with Google" />
            <p style={{ textAlign: 'center', fontSize: '14px', color: 'var(--ink-4)', marginTop: '8px', fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif' }}>
              Fastest way in, no password to remember.
            </p>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '22px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              <span style={{ fontSize: '14px', color: 'var(--ink-4)', fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif' }}>or log in with username</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label htmlFor="login-identifier" style={{
                  display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600,
                  color: 'var(--ink)', marginBottom: '8px',
                  fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
                }}>
                  Username, Gmail, or phone
                </label>
                <SmoothInput
                  id="login-identifier"
                  type="text" required autoComplete="username"
                  className="field"
                  value={form.identifier}
                  onChange={e => { setForm({ ...form, identifier: e.target.value }); setFieldErrors(f => ({ ...f, identifier: '' })); }}
                  style={{ borderColor: fieldErrors.identifier ? 'var(--red-soft)' : undefined }}
                />
                {fieldErrors.identifier && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--red-error)', marginTop: '4px', fontFamily: 'inherit' }}>{fieldErrors.identifier}</p>}
              </div>

              <div>
                <label htmlFor="login-password" style={{
                  display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600,
                  color: 'var(--ink)', marginBottom: '8px',
                  fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
                }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <SmoothInput
                    id="login-password"
                    type={showPwd ? 'text' : 'password'} required autoComplete="current-password"
                    className="field"
                    value={form.password}
                    onChange={e => { setForm({ ...form, password: e.target.value }); setFieldErrors(f => ({ ...f, password: '' })); }}
                    style={{ borderColor: fieldErrors.password ? 'var(--red-soft)' : undefined, paddingRight: '44px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute', right: '2px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      minWidth: '44px', minHeight: '44px',
                      color: 'var(--ink-3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {fieldErrors.password && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--red-error)', marginTop: '4px', fontFamily: 'inherit' }}>{fieldErrors.password}</p>}
                {/* Forgot password */}
                <div style={{ textAlign: 'right', marginTop: '6px' }}>
                  <Link to="/forgot-password" style={{
                    fontSize: 'var(--text-sm)', color: 'var(--blue)',
                    textDecoration: 'none', display: 'inline-block', padding: '12px 0 12px 12px',
                    fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
                  }}>
                    Forgot password?
                  </Link>
                </div>
              </div>

              {/* Blue pill Log In button */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', height: '48px',
                  background: loading ? 'var(--blue-mid)' : 'var(--blue)',
                  color: '#ffffff',
                  border: 'none', borderRadius: '9999px',
                  fontSize: '17px', fontWeight: 400,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
                  marginTop: '4px',
                  transition: 'background 0.15s',
                  boxShadow: '0 2px 10px rgba(79,163,206,0.22)',
                }}
              >
                {loading ? 'Logging in…' : 'Log In'}
              </button>
            </form>

            <p style={{
              textAlign: 'center', fontSize: '14px', color: 'var(--ink-3)',
              fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
              marginTop: '20px',
            }}>
              New here?{' '}
              <Link to="/register" style={{ color: 'var(--blue)', fontWeight: 600, textDecoration: 'none' }}>
                Create Account
              </Link>
            </p>
          </div>

          <div style={{ textAlign: 'center', marginTop: '14px' }}>
            <Link to="/how-it-works" style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'transparent', color: 'var(--blue-teal)', textDecoration: 'none',
              borderRadius: '9999px', padding: '11px 24px',
              fontSize: 'var(--text-sm)', fontWeight: 500,
              border: '1px solid var(--border)',
              fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
            }}>
              How It Works
            </Link>
          </div>
          <p style={{
            textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--ink-4)',
            fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
            marginTop: '12px',
          }}>
            <Link to="/feedback" style={{ color: 'var(--ink-3)', textDecoration: 'none' }}>
              Share feedback
            </Link>
          </p>
        </div>
        </div>
        <SiteFooter />
      </div>
    </div>
  );
}
