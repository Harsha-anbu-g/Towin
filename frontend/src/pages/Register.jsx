import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const unsplash = (id, w = 400, h = 300) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

const COMMUNITY_PHOTOS = [
  'photo-1529156069898-49953e39b3ac',
  'photo-1544005313-94ddf0286df2',
  'photo-1507679799987-c73779587ccf',
  'photo-1438761681033-6461ffad8d80',
  'photo-1534528741775-53994a69daeb',
  'photo-1573497491208-6b1acb260507',
];

function HeroPanel() {
  return (
    <div style={{
      flex: '0 0 42%',
      background: '#020817',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      padding: '52px 44px',
      minHeight: '100svh',
    }}>
      {/* Background photo */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <LazyLoadImage
          src={unsplash('photo-1529156069898-49953e39b3ac', 900, 1200)}
          alt="Community"
          effect="blur"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          wrapperProps={{ style: { width: '100%', height: '100%', display: 'block' } }}
        />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.15) 100%)',
        }} />
      </div>

      {/* Logo */}
      <div style={{ position: 'absolute', top: '32px', left: '44px', zIndex: 2 }}>
        <p style={{
          fontSize: '17px', fontWeight: 700, color: '#fff',
          fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
        }}>ToWin</p>
      </div>

      {/* Community photo mosaic — right side vertical strip */}
      <div style={{
        position: 'absolute', top: '60px', right: '20px', bottom: '220px', zIndex: 2,
        display: 'flex', flexDirection: 'column', gap: '6px', width: '80px',
      }}>
        {COMMUNITY_PHOTOS.slice(0, 4).map((id) => (
          <div key={id} style={{ flex: 1, borderRadius: '10px', overflow: 'hidden' }}>
            <LazyLoadImage
              src={unsplash(id, 160, 160)}
              alt=""
              effect="blur"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              wrapperProps={{ style: { width: '100%', height: '100%', display: 'block' } }}
            />
          </div>
        ))}
      </div>

      {/* Bottom text */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        <h1 style={{
          fontFamily: '-apple-system, "SF Pro Display", system-ui, sans-serif',
          fontSize: '40px', lineHeight: 1.1, color: '#fff',
          marginBottom: '14px', fontWeight: 600,
        }}>
          Your community<br />is waiting<br />for you.
        </h1>

        <p style={{
          fontSize: '14px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.7,
          marginBottom: '28px', maxWidth: '240px',
          fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
        }}>
          Join thousands of elders and helpers building real, trusted connections every day.
        </p>

        {/* Feature bullets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {['Free to join — no credit card', 'Verified and safe community', 'Your data stays private'].map((text) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
                background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="7" height="5" viewBox="0 0 7 5" fill="none">
                  <path d="M1 2.5L2.8 4L6 1" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)' }}>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* 3-step progress indicator */
function StepIndicator({ currentStep = 1 }) {
  const steps = [1, 2, 3];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '28px' }}>
      {steps.map((step, i) => (
        <div key={step} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
            background: step <= currentStep ? '#0066cc' : '#e0e0e0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: 700,
            color: step <= currentStep ? '#fff' : '#a0a0a5',
            fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
            transition: 'background 0.2s',
          }}>
            {step}
          </div>
          {i < steps.length - 1 && (
            <div style={{
              flex: 1, height: '2px',
              background: step < currentStep ? '#0066cc' : '#e0e0e0',
              transition: 'background 0.2s',
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

const pwdStrength = (p) => {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p)) s++;
  if (/[0-9]/.test(p)) s++;
  if (/[^a-zA-Z0-9]/.test(p)) s++;
  return s;
};

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', phone: '', password: '', role: 'ELDER' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const errs = {};
    if (!form.email.includes('@')) errs.email = 'Enter a valid email address';
    if (form.phone.length < 7) errs.phone = 'Enter a valid phone number';
    if (form.password.length < 8) errs.password = 'Password must be at least 8 characters';
    if (Object.keys(errs).length) { setFieldErrors(errs); setLoading(false); return; }
    setFieldErrors({});
    try {
      const { data } = await api.post('/auth/register', form);
      login(data.token, data.role, data.userId);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const ROLES = [
    { value: 'ELDER', label: 'Elder', desc: 'Looking for friends or help' },
    { value: 'HELPER', label: 'Helper', desc: 'Want to help others' },
    { value: 'BOTH', label: 'Both', desc: 'Elder and helper' },
  ];

  return (
    <div style={{ minHeight: '100svh', display: 'flex' }}>
      <HeroPanel />

      {/* Right panel */}
      <div style={{
        flex: '0 0 58%',
        background: '#fafafc',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        overflowY: 'auto',
      }}>
        {/* Dark hero band */}
        <div style={{
          width: '100%',
          background: '#272729',
          padding: '40px 64px 36px',
          textAlign: 'center',
        }}>
          <h2 style={{
            fontFamily: '-apple-system, "SF Pro Display", system-ui, sans-serif',
            fontSize: '56px', fontWeight: 600, color: '#ffffff',
            marginBottom: '10px', letterSpacing: '-0.5px', lineHeight: 1.05,
          }}>
            Join ToWin.
          </h2>
          <p style={{
            fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
            fontSize: '17px', color: '#cccccc',
          }}>
            Create your free account in minutes.
          </p>
        </div>

        {/* Form area */}
        <div style={{
          width: '100%', maxWidth: '440px',
          padding: '40px 24px 48px',
        }}>
          {/* 3-step progress */}
          <StepIndicator currentStep={1} />

          {/* Form card */}
          <div style={{
            background: '#ffffff',
            borderRadius: '18px',
            padding: '36px 32px',
            border: '1px solid #e0e0e0',
          }}>
            {/* Error state */}
            {error && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: '11px', padding: '12px 16px',
                fontSize: '14px', color: '#dc2626', marginBottom: '20px',
                fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Role selector */}
              <div>
                <label style={{
                  display: 'block', fontSize: '13px', fontWeight: 600,
                  color: '#1d1d1f', marginBottom: '8px',
                  fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
                }}>
                  I am joining as
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {ROLES.map(({ value, label, desc }) => {
                    const active = form.role === value;
                    return (
                      <button key={value} type="button" onClick={() => setForm({ ...form, role: value })}
                        style={{
                          padding: '12px 8px', borderRadius: '14px',
                          border: active ? '2px solid #0066cc' : '1.5px solid #e0e0e0',
                          background: active ? '#f0f6ff' : '#ffffff',
                          cursor: 'pointer', textAlign: 'left',
                          transition: 'all 0.15s',
                        }}>
                        <div style={{
                          fontSize: '13px', fontWeight: 700,
                          color: active ? '#0066cc' : '#1d1d1f',
                          marginBottom: '3px',
                          fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
                        }}>
                          {label}
                        </div>
                        <div style={{
                          fontSize: '11px', lineHeight: 1.3,
                          color: active ? '#5599dd' : '#a0a0a5',
                          fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
                        }}>
                          {desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Email */}
              <div>
                <label style={{
                  display: 'block', fontSize: '13px', fontWeight: 600,
                  color: '#1d1d1f', marginBottom: '6px',
                  fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
                }}>
                  Email address
                </label>
                <input
                  type="email" autoComplete="email" required
                  className="field"
                  value={form.email}
                  onChange={e => { setForm({ ...form, email: e.target.value }); setFieldErrors(f => ({ ...f, email: '' })); }}
                  placeholder="you@example.com"
                  style={{ borderColor: fieldErrors.email ? '#fca5a5' : undefined }}
                />
                {fieldErrors.email && <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px', fontFamily: 'inherit' }}>{fieldErrors.email}</p>}
              </div>

              {/* Phone */}
              <div>
                <label style={{
                  display: 'block', fontSize: '13px', fontWeight: 600,
                  color: '#1d1d1f', marginBottom: '6px',
                  fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
                }}>
                  Phone number
                </label>
                <input
                  type="tel" required
                  className="field"
                  value={form.phone}
                  onChange={e => { setForm({ ...form, phone: e.target.value }); setFieldErrors(f => ({ ...f, phone: '' })); }}
                  placeholder="+1 555 000 0000"
                  style={{ borderColor: fieldErrors.phone ? '#fca5a5' : undefined }}
                />
                {fieldErrors.phone && <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px', fontFamily: 'inherit' }}>{fieldErrors.phone}</p>}
              </div>

              {/* Password */}
              <div>
                <label style={{
                  display: 'block', fontSize: '13px', fontWeight: 600,
                  color: '#1d1d1f', marginBottom: '6px',
                  fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
                }}>
                  Password
                </label>
                <input
                  type="password" autoComplete="new-password" required
                  className="field"
                  value={form.password}
                  onChange={e => { setForm({ ...form, password: e.target.value }); setFieldErrors(f => ({ ...f, password: '' })); }}
                  placeholder="Create a password"
                  style={{ borderColor: fieldErrors.password ? '#fca5a5' : undefined }}
                />
                {fieldErrors.password && <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px', fontFamily: 'inherit' }}>{fieldErrors.password}</p>}
                {form.password && (
                  <div style={{ marginTop: '6px', display: 'flex', gap: '3px', alignItems: 'center' }}>
                    {[1,2,3,4].map(i => (
                      <div key={i} style={{
                        flex: 1, height: '3px', borderRadius: '9999px',
                        background: i <= pwdStrength(form.password)
                          ? ['#ff3b30','#ff9500','#34c759','#34c759'][pwdStrength(form.password)-1]
                          : '#e0e0e0',
                        transition: 'background 0.2s',
                      }} />
                    ))}
                    <span style={{ fontSize: '11px', color: '#7a7a7a', marginLeft: '6px', fontFamily: 'inherit' }}>
                      {['','Weak','Fair','Good','Strong'][pwdStrength(form.password)]}
                    </span>
                  </div>
                )}
              </div>

              {/* Terms checkbox */}
              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={e => setAgreed(e.target.checked)}
                  style={{ marginTop: '2px', accentColor: '#0066cc', flexShrink: 0 }}
                />
                <span style={{
                  fontSize: '13px', color: '#7a7a7a', lineHeight: 1.5,
                  fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
                }}>
                  I agree to the{' '}
                  <Link to="/terms" style={{ color: '#0066cc', textDecoration: 'none' }}>Terms of Service</Link>
                  {' '}and{' '}
                  <Link to="/privacy" style={{ color: '#0066cc', textDecoration: 'none' }}>Privacy Policy</Link>
                </span>
              </label>

              {/* Blue pill Create Account button */}
              <button
                type="submit"
                disabled={loading || !agreed}
                style={{
                  width: '100%', height: '48px',
                  background: loading || !agreed ? '#a0c4e8' : '#0066cc',
                  color: '#ffffff',
                  border: 'none', borderRadius: '9999px',
                  fontSize: '16px', fontWeight: 600,
                  cursor: loading || !agreed ? 'not-allowed' : 'pointer',
                  fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
                  marginTop: '4px',
                  transition: 'background 0.15s',
                }}
              >
                {loading ? 'Creating account…' : 'Create Account'}
              </button>
            </form>
          </div>

          {/* Sign in link */}
          <p style={{
            textAlign: 'center', fontSize: '14px', color: '#7a7a7a',
            marginTop: '20px',
            fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
          }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#0066cc', fontWeight: 600, textDecoration: 'none' }}>
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
