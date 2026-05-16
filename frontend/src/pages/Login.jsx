import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

/* Curated Unsplash photos — elderly + community lifestyle */
const PHOTOS = [
  { id: 'photo-1576765974256-9b879d60a571', alt: 'Elder with helper' },
  { id: 'photo-1529156069898-49953e39b3ac', alt: 'Community friends' },
  { id: 'photo-1559839734-2b71ea197ec2', alt: 'Smiling elder woman' },
  { id: 'photo-1507679799987-c73779587ccf', alt: 'Elder gentleman' },
];

const unsplash = (id, w = 400, h = 300) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

function HeroPanel() {
  return (
    <div style={{
      flex: '0 0 46%',
      background: '#020817',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      padding: '52px 48px',
      minHeight: '100svh',
    }}>
      {/* Full-bleed lifestyle photo */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <LazyLoadImage
          src={unsplash('photo-1576765974256-9b879d60a571', 900, 1100)}
          alt="Elder and helper together"
          effect="blur"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          wrapperProps={{ style: { width: '100%', height: '100%', display: 'block' } }}
        />
        {/* Dark gradient overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.15) 100%)',
        }} />
      </div>

      {/* Logo top-left */}
      <div style={{ position: 'absolute', top: '32px', left: '48px', zIndex: 2 }}>
        <p style={{ fontSize: '17px', fontWeight: 700, color: '#fff', fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif' }}>
          ToWin
        </p>
      </div>

      {/* Bottom content */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        <h1 style={{
          fontFamily: '-apple-system, "SF Pro Display", system-ui, sans-serif',
          fontSize: '40px', lineHeight: 1.1, color: '#fff',
          marginBottom: '16px', letterSpacing: '-0.3px', fontWeight: 600,
        }}>
          Connecting generations,<br />building trust.
        </h1>

        {/* Social proof avatars */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '24px' }}>
          <div style={{ display: 'flex' }}>
            {PHOTOS.map(({ id }, i) => (
              <div key={id} style={{
                width: '32px', height: '32px', borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.8)',
                overflow: 'hidden', marginLeft: i === 0 ? 0 : '-10px',
                position: 'relative', zIndex: PHOTOS.length - i,
              }}>
                <LazyLoadImage
                  src={unsplash(id, 64, 64)}
                  alt=""
                  effect="blur"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  wrapperProps={{ style: { width: '100%', height: '100%', display: 'block' } }}
                />
              </div>
            ))}
          </div>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
            <strong style={{ color: '#fff' }}>12,000+</strong> members joined
          </p>
        </div>
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
      login(data.token, data.role, data.userId);
      navigate(data.role === 'ADMIN' ? '/admin' : '/dashboard');
    } catch {
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100svh', display: 'flex' }}>
      <HeroPanel />

      {/* Right panel */}
      <div style={{
        flex: '0 0 54%',
        background: '#fafafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 64px',
      }}>
        <div style={{ width: '100%', maxWidth: '380px' }}>
          {/* Form card */}
          <div style={{
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
                <input
                  type="password" required autoComplete="current-password"
                  className="field"
                  value={form.password}
                  onChange={e => { setForm({ ...form, password: e.target.value }); setFieldErrors(f => ({ ...f, password: '' })); }}
                  placeholder="••••••••"
                  style={{ borderColor: fieldErrors.password ? '#fca5a5' : undefined }}
                />
                {fieldErrors.password && <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px', fontFamily: 'inherit' }}>{fieldErrors.password}</p>}
                {/* Forgot password */}
                <div style={{ textAlign: 'right', marginTop: '6px' }}>
                  <Link to="/forgot-password" style={{
                    fontSize: '13px', color: '#0066cc',
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
                  background: loading ? '#5599dd' : '#0066cc',
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

            {/* OR divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
              <div style={{ flex: 1, height: '1px', background: '#e0e0e0' }} />
              <span style={{ fontSize: '12px', color: '#a0a0a5', fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif' }}>OR</span>
              <div style={{ flex: 1, height: '1px', background: '#e0e0e0' }} />
            </div>

            {/* Create account link */}
            <p style={{
              textAlign: 'center', fontSize: '14px', color: '#7a7a7a',
              fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
            }}>
              Don&apos;t have an account?{' '}
              <Link to="/register" style={{ color: '#0066cc', fontWeight: 600, textDecoration: 'none' }}>
                Create one
              </Link>
            </p>
          </div>

          {/* Trust badge */}
          <p style={{
            textAlign: 'center', fontSize: '13px', color: '#a0a0a5',
            marginTop: '20px',
            fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
          }}>
            Trusted by 10,000+ families
          </p>
        </div>
      </div>
    </div>
  );
}
