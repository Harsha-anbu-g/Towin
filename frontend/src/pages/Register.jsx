import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const TERMS_CONTENT = [
  { h: '1. Welcome to ToWin',
    p: 'ToWin is a community platform that connects elders with helpers for companionship, errands, and everyday support. By creating an account, you agree to these Terms of Service. This is a placeholder document for the prototype. Final terms will be reviewed by counsel before launch.' },
  { h: '2. Eligibility',
    p: 'You must be at least 18 years old to use ToWin. By registering, you confirm that the information you provide is accurate and that you will keep it up to date. Accounts created with false information may be suspended at any time.' },
  { h: '3. Your account',
    p: 'You are responsible for keeping your password confidential and for any activity on your account. Notify us immediately if you suspect unauthorized use. We may suspend accounts that violate community standards, including harassment, fraud, or unsafe behavior toward another member.' },
  { h: '4. Community conduct',
    p: 'ToWin exists to build trust. You agree to treat every elder, helper, and admin with respect. Discrimination, threats, solicitation, or any behavior that compromises another member’s safety is grounds for immediate removal.' },
  { h: '5. Help requests and meetings',
    p: 'Helpers and elders may arrange to meet in person once trust has been established through the Trust Journey. ToWin facilitates introductions but is not a party to any agreement between members. Use good judgment, meet in public when possible, and report safety concerns promptly.' },
  { h: '6. Reviews and trust scores',
    p: 'Trust scores and reviews reflect community feedback. Reviews must be honest and based on real interactions. Fake or coordinated reviews are not allowed and may result in account action.' },
  { h: '7. Limitation of liability',
    p: 'ToWin is provided “as is.” To the maximum extent permitted by law, we are not liable for losses arising from interactions between members. Always use common sense and your local emergency services when needed.' },
  { h: '8. Changes to these terms',
    p: 'We may update these terms from time to time. We will notify you of significant changes. Continued use of ToWin after changes take effect means you accept the revised terms.' },
  { h: '9. Contact',
    p: 'Questions about these terms can be sent to support@towin.example. Last updated: May 2026.' },
];

const PRIVACY_CONTENT = [
  { h: '1. What we collect',
    p: 'We collect the information you provide when you register (name, email, phone, role) and the content you create on ToWin (profile, help requests, messages, reviews). We also collect basic device information to keep the service secure.' },
  { h: '2. Location',
    p: 'If you share your location, we use it only to match you with nearby helpers or elders. You can turn location off at any time in your device settings. Your account will continue to work, just without distance-based matching.' },
  { h: '3. How we use your data',
    p: 'Your data is used to operate ToWin: showing nearby members, enabling messaging, calculating trust scores, and keeping the community safe. We do not sell your personal data to advertisers.' },
  { h: '4. Who can see what',
    p: 'Other members can see your name, role, city, bio, interests, and trust score. Your email and phone are visible to a connection only after the trust journey reaches the “Phone Ready” stage. Admins may access account data when investigating safety reports.' },
  { h: '5. Messages',
    p: 'Messages between members are stored so you can read your history. Admins may review messages flagged for safety. We do not use the content of your messages for advertising.' },
  { h: '6. Data retention',
    p: 'We keep your account data while your account is active. If you delete your account, we remove your profile within 30 days. Anonymized records of past interactions may be retained for safety investigations.' },
  { h: '7. Your rights',
    p: 'You can edit or delete your profile information at any time from the Profile page. You can request a copy of your data or full deletion by contacting support@towin.example.' },
  { h: '8. Security',
    p: 'We use industry-standard encryption in transit and at rest. No system is perfectly secure, so please use a strong, unique password and report anything suspicious.' },
  { h: '9. Children',
    p: 'ToWin is not directed at children under 18. If we learn we have collected data from a minor, we will delete it.' },
  { h: '10. Contact',
    p: 'Privacy questions can be sent to privacy@towin.example. Last updated: May 2026.' },
];

function LegalModal({ title, sections, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(20,55,80,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#ffffff', borderRadius: '18px',
          maxWidth: '640px', width: '100%', maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(20,55,80,0.25)',
          fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
        }}
      >
        <div style={{
          padding: '24px 32px', borderBottom: '1px solid #ececef',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
        }}>
          <h3 style={{
            margin: 0, fontSize: '22px', fontWeight: 600, color: '#1d1d1f',
            fontFamily: '-apple-system, "SF Pro Display", system-ui, sans-serif',
            letterSpacing: '-0.3px',
          }}>{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: '32px', height: '32px', borderRadius: '50%',
              border: '1px solid #e0e0e0', background: '#ffffff',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '18px', color: '#7a7a7a',
            }}
          >×</button>
        </div>
        <div style={{ padding: '20px 32px 28px', overflowY: 'auto' }}>
          <p style={{
            fontSize: '12px', color: '#a0a0a5', textTransform: 'uppercase',
            letterSpacing: '0.5px', fontWeight: 600, margin: '0 0 18px',
          }}>
            Placeholder document, prototype only
          </p>
          {sections.map(s => (
            <div key={s.h} style={{ marginBottom: '20px' }}>
              <h4 style={{
                fontSize: '15px', fontWeight: 600, color: '#1d1d1f',
                margin: '0 0 6px',
              }}>{s.h}</h4>
              <p style={{
                fontSize: '14px', color: '#5a6b75', lineHeight: 1.6, margin: 0,
              }}>{s.p}</p>
            </div>
          ))}
        </div>
        <div style={{
          padding: '16px 32px', borderTop: '1px solid #ececef',
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            style={{
              height: '40px', padding: '0 22px',
              background: '#4FA3CE', color: '#ffffff',
              border: 'none', borderRadius: '9999px',
              fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function HeroPanel() {
  return (
    <div className="auth-hero" style={{
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      padding: '52px 44px',
      background:
        'radial-gradient(ellipse at 25% 15%, rgba(255,255,255,0.55) 0%, transparent 55%),' +
        'radial-gradient(ellipse at 80% 85%, #BFD9EA 0%, transparent 60%),' +
        'linear-gradient(160deg, #EAF5FB 0%, #BFD9EA 45%, #4FA3CE 100%)',
    }}>
      {/* Hero photo — elder and younger person walking hand in hand */}
      <img
        src="/walking.png"
        alt="An elder and younger person walking together hand in hand"
        draggable="false"
        onDragStart={e => e.preventDefault()}
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: 'center', zIndex: 0,
          userSelect: 'none', WebkitUserDrag: 'none',
        }}
      />

      {/* Turtle logo + wordmark — back to the landing story */}
      <Link to="/" style={{
        position: 'absolute', top: '32px', left: '44px', zIndex: 2,
        display: 'flex', alignItems: 'center', gap: '10px',
        textDecoration: 'none',
      }}>
        <img src="/tortoise-logo-alpha.png" alt="ToWin logo" style={{ width: 40, height: 40, objectFit: 'contain', filter: 'brightness(0) invert(1) sepia(1) saturate(4) hue-rotate(100deg) brightness(0.33)' }} />
        <p style={{
          fontSize: '21px', fontWeight: 600, color: '#14532d', letterSpacing: '-0.374px',
          fontFamily: '-apple-system, "SF Pro Display", system-ui, sans-serif',
          margin: 0,
        }}>ToWin</p>
      </Link>

      {/* Hero text — sits at the top of the photo, clear of the logo */}
      <div style={{ position: 'relative', zIndex: 2, marginTop: '64px' }}>
        <h1 style={{
          fontFamily: '-apple-system, "SF Pro Display", system-ui, sans-serif',
          fontSize: '40px', lineHeight: 1.15, color: '#0d1a0f',
          marginBottom: '14px', fontWeight: 600,
        }}>
          Your community<br />is waiting<br />for you.
        </h1>

        <p style={{
          fontSize: '14px', color: '#0d1a0f', lineHeight: 1.7,
          marginBottom: '28px', maxWidth: '260px',
          fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
        }}>
          Join thousands of elders and helpers building real, trusted connections every day.
        </p>

        {/* Feature bullets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {['Free to join, no credit card', 'Verified and safe community', 'Your data stays private'].map((text) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
                background: '#0d1a0f',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="9" height="7" viewBox="0 0 7 5" fill="none">
                  <path d="M1 2.5L2.8 4L6 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span style={{
                fontSize: '13px', color: '#0d1a0f',
                fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
              }}>{text}</span>
            </div>
          ))}
        </div>
      </div>
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
  const [form, setForm] = useState({
    email: '', phone: '', password: '', confirmPassword: '',
    role: 'ELDER',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [legalOpen, setLegalOpen] = useState(null);
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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
        (data.role === 'ELDER' || data.role === 'BOTH') ? '/streaks' : '/dashboard',
        { replace: true }
      );
    } catch {
      setError('Could not start demo session. Please try again.');
    } finally {
      setGuestLoading('');
    }
  };

  const eyeBtn = {
    position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', cursor: 'pointer', padding: '6px',
    color: '#7a7a7a', display: 'flex',
  };

  const linkBtn = {
    color: '#4FA3CE', background: 'none', border: 'none', padding: 0,
    cursor: 'pointer', font: 'inherit', textDecoration: 'underline',
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const errs = {};
    if (!form.email.includes('@')) errs.email = 'Enter a valid email address';
    // Same shape the backend enforces: optional +, then 10-15 digits
    const phoneDigits = form.phone.replace(/[\s()-]/g, '');
    if (!/^\+?[0-9]{10,15}$/.test(phoneDigits)) errs.phone = 'Enter a valid phone number (10 to 15 digits)';
    if (form.password.length < 8) errs.password = 'Password must be at least 8 characters';
    if (form.confirmPassword !== form.password) errs.confirmPassword = 'Passwords do not match';
    if (Object.keys(errs).length) { setFieldErrors(errs); setLoading(false); return; }
    setFieldErrors({});
    try {
      const { email, password, role } = form;
      const { data } = await api.post('/auth/register', { email, phone: phoneDigits, password, role });
      login(data.token);
      navigate(
        data.role === 'ADMIN' ? '/admin' :
        (data.role === 'ELDER' || data.role === 'BOTH') ? '/streaks' :
        '/dashboard',
        { replace: true }
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const ROLES = [
    { value: 'ELDER', label: 'Elder', desc: 'Looking for friends or help' },
    { value: 'HELPER', label: 'Helper', desc: 'Want to help others' },
  ];

  return (
    <div className="auth-shell">
      <HeroPanel />

      {/* Right panel */}
      <div className="auth-form" style={{
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        overflowY: 'auto',
        padding: 0,
      }}>
        {/* Light hero band */}
        <div className="register-head" style={{
          width: '100%',
          background: '#ffffff',
          borderBottom: '1px solid #ececef',
        }}>
          <h2 className="register-title">
            Join ToWin.
          </h2>
          <p style={{
            fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
            fontSize: '17px', color: '#7a7a7a',
          }}>
            Create your free account in minutes.
          </p>
        </div>

        {/* Form area */}
        <div style={{
          width: '100%', maxWidth: '440px',
          padding: '40px 24px 48px',
        }}>
          {/* Role selector — standalone at the top */}
          <div style={{
            marginBottom: '24px', background: '#ffffff',
            border: '1px solid rgba(191,217,234,0.6)', borderRadius: '18px',
            padding: '20px 20px 18px',
            boxShadow: '0 1px 2px rgba(16,42,67,0.04), 0 10px 28px rgba(16,42,67,0.07)',
          }}>
            <label style={{
              display: 'block', fontSize: '13px', fontWeight: 600,
              color: '#1d1d1f', marginBottom: '10px',
              fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
            }}>
              I am joining as
            </label>
            <div className="role-grid">
              {ROLES.map(({ value, label, desc }) => {
                const active = form.role === value;
                return (
                  <button key={value} type="button" onClick={() => setForm({ ...form, role: value })}
                    style={{
                      padding: '14px 12px', borderRadius: '11px',
                      border: active ? '2px solid #4FA3CE' : '1.5px solid #e0e0e0',
                      background: active ? '#EAF5FB' : '#ffffff',
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.15s',
                    }}>
                    <div style={{
                      fontSize: '14px', fontWeight: 600,
                      color: active ? '#4FA3CE' : '#1d1d1f',
                      marginBottom: '4px',
                      fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
                    }}>
                      {label}
                    </div>
                    <div style={{
                      fontSize: '12px', lineHeight: 1.3,
                      color: active ? '#7BB8D6' : '#a0a0a5',
                      fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
                    }}>
                      {desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form card */}
          <div className="register-form-card" style={{
            background: '#ffffff',
            borderRadius: '18px',
            border: '1px solid rgba(191,217,234,0.6)',
            boxShadow: '0 1px 2px rgba(16,42,67,0.04), 0 10px 28px rgba(16,42,67,0.07), 0 26px 56px rgba(79,163,206,0.12)',
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
                  type="tel" autoComplete="tel" required
                  className="field"
                  value={form.phone}
                  onChange={e => { setForm({ ...form, phone: e.target.value }); setFieldErrors(f => ({ ...f, phone: '' })); }}
                  placeholder="+1 416 555 0123"
                  style={{ borderColor: fieldErrors.phone ? '#fca5a5' : undefined }}
                />
                {fieldErrors.phone && <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px', fontFamily: 'inherit' }}>{fieldErrors.phone}</p>}
                <p style={{ fontSize: '12px', color: '#a0a0a5', marginTop: '4px', fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif' }}>
                  Only shared with a connection after you both reach the Phone Ready trust stage.
                </p>
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
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPwd ? 'text' : 'password'} autoComplete="new-password" required
                    className="field"
                    value={form.password}
                    onChange={e => { setForm({ ...form, password: e.target.value }); setFieldErrors(f => ({ ...f, password: '' })); }}
                    placeholder="Create a password"
                    style={{ borderColor: fieldErrors.password ? '#fca5a5' : undefined, paddingRight: '44px' }}
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    aria-label={showPwd ? 'Hide password' : 'Show password'} style={eyeBtn}>
                    {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {fieldErrors.password && <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px', fontFamily: 'inherit' }}>{fieldErrors.password}</p>}
                {form.password && (
                  <div style={{ marginTop: '6px', display: 'flex', gap: '3px', alignItems: 'center' }}>
                    {[1,2,3,4].map(i => (
                      <div key={i} style={{
                        flex: 1, height: '3px', borderRadius: '9999px',
                        background: i <= pwdStrength(form.password)
                          ? ['#ff3b30','#ff9500','#4FA3CE','#4FA3CE'][pwdStrength(form.password)-1]
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

              {/* Confirm Password */}
              <div>
                <label style={{
                  display: 'block', fontSize: '13px', fontWeight: 600,
                  color: '#1d1d1f', marginBottom: '6px',
                  fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
                }}>
                  Re-enter password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirm ? 'text' : 'password'} autoComplete="new-password" required
                    className="field"
                    value={form.confirmPassword}
                    onChange={e => { setForm({ ...form, confirmPassword: e.target.value }); setFieldErrors(f => ({ ...f, confirmPassword: '' })); }}
                    placeholder="Type the same password again"
                    style={{ borderColor: fieldErrors.confirmPassword ? '#fca5a5' : undefined, paddingRight: '44px' }}
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'} style={eyeBtn}>
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {fieldErrors.confirmPassword && <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px', fontFamily: 'inherit' }}>{fieldErrors.confirmPassword}</p>}
                {form.confirmPassword && form.password && form.confirmPassword === form.password && (
                  <p style={{ fontSize: '12px', color: '#5FA670', marginTop: '4px', fontFamily: 'inherit' }}>Passwords match</p>
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
                  style={{ marginTop: '2px', accentColor: '#4FA3CE', flexShrink: 0 }}
                />
                <span style={{
                  fontSize: '13px', color: '#7a7a7a', lineHeight: 1.5,
                  fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
                }}>
                  I agree to the{' '}
                  <button type="button" onClick={() => setLegalOpen('terms')} style={linkBtn}>Terms of Service</button>
                  {' '}and{' '}
                  <button type="button" onClick={() => setLegalOpen('privacy')} style={linkBtn}>Privacy Policy</button>
                </span>
              </label>

              {/* Blue pill Create Account button */}
              <button
                type="submit"
                disabled={loading || !agreed}
                style={{
                  width: '100%', height: '48px',
                  background: loading || !agreed ? '#BFD9EA' : '#4FA3CE',
                  color: '#ffffff',
                  border: 'none', borderRadius: '9999px',
                  fontSize: '17px', fontWeight: 400,
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
            <Link to="/login" style={{ color: '#4FA3CE', fontWeight: 600, textDecoration: 'none' }}>
              Sign In
            </Link>
          </p>

          {/* Demo accounts — at the bottom, same as login page */}
          <div style={{
            marginTop: '24px', background: '#EAF5FB',
            border: '1px solid #BFD9EA', borderRadius: '16px',
            padding: '18px 18px 16px',
          }}>
            <p style={{
              fontSize: '15px', fontWeight: 600, color: '#1d1d1f', textAlign: 'center',
              fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
              margin: '0 0 4px',
            }}>
              Just want to see how it works?
            </p>
            <p style={{
              fontSize: '13px', color: '#5a6470', textAlign: 'center',
              fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
              margin: '0 0 14px', lineHeight: 1.5,
            }}>
              Look around with a sample account, no sign-up needed.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { role: 'ELDER', label: 'Try as an Elder', sub: 'See ToWin as Margaret, 72' },
                { role: 'HELPER', label: 'Try as a Helper', sub: 'See ToWin as James, 28' },
              ].map(({ role, label, sub }) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => handleGuest(role)}
                  disabled={!!guestLoading}
                  style={{
                    width: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: '#ffffff',
                    border: '1.5px solid #BFD9EA',
                    borderRadius: '11px',
                    padding: '13px 16px',
                    cursor: guestLoading ? 'not-allowed' : 'pointer',
                    opacity: guestLoading && guestLoading !== role ? 0.5 : 1,
                    textAlign: 'left',
                    transition: 'border-color 0.15s, background 0.15s',
                    fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
                  }}
                  onMouseEnter={e => { if (!guestLoading) e.currentTarget.style.borderColor = '#4FA3CE'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#BFD9EA'; }}
                >
                  <span>
                    <span style={{ display: 'block', fontSize: '15px', fontWeight: 600, color: '#3D8AB0' }}>
                      {guestLoading === role ? 'Opening…' : label}
                    </span>
                    <span style={{ display: 'block', fontSize: '12px', color: '#7a7a7a', marginTop: '2px' }}>
                      {sub}
                    </span>
                  </span>
                  <span aria-hidden="true" style={{ fontSize: '17px', color: '#4FA3CE', fontWeight: 700 }}>→</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '14px' }}>
            <Link to="/how-it-works" style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: '#4FA3CE', color: '#ffffff', textDecoration: 'none',
              borderRadius: '9999px', padding: '11px 24px',
              fontSize: '15px', fontWeight: 400,
              fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
              boxShadow: '0 4px 16px rgba(79,163,206,0.35)',
            }}>
              How It Works
            </Link>
          </div>
        </div>
      </div>

      {legalOpen === 'terms' && (
        <LegalModal title="Terms of Service" sections={TERMS_CONTENT} onClose={() => setLegalOpen(null)} />
      )}
      {legalOpen === 'privacy' && (
        <LegalModal title="Privacy Policy" sections={PRIVACY_CONTENT} onClose={() => setLegalOpen(null)} />
      )}
    </div>
  );
}
