import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import SiteFooter from '../components/SiteFooter';
import SmoothInput from '../components/SmoothInput';

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
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
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
          padding: '24px 32px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
        }}>
          <h3 style={{
            margin: 0, fontSize: 'var(--text-lg)', fontWeight: 400, color: 'var(--ink)',
            fontFamily: 'var(--font-display)',
            letterSpacing: '-0.02em',
          }}>{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: '32px', height: '32px', borderRadius: '50%',
              border: '1px solid var(--border)', background: '#ffffff',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 'var(--text-base)', color: 'var(--ink-3)',
            }}
          >×</button>
        </div>
        <div style={{ padding: '20px 32px 28px', overflowY: 'auto' }}>
          <p style={{
            fontSize: '12px', color: 'var(--ink-4)', textTransform: 'uppercase',
            letterSpacing: '0.5px', fontWeight: 600, margin: '0 0 18px',
          }}>
            Placeholder document, prototype only
          </p>
          {sections.map(s => (
            <div key={s.h} style={{ marginBottom: '20px' }}>
              <h4 style={{
                fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink)',
                margin: '0 0 6px',
              }}>{s.h}</h4>
              <p style={{
                fontSize: 'var(--text-sm)', color: '#5a6b75', lineHeight: 1.6, margin: 0,
              }}>{s.p}</p>
            </div>
          ))}
        </div>
        <div style={{
          padding: '16px 32px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            style={{
              height: '40px', padding: '0 22px',
              background: 'var(--blue)', color: '#ffffff',
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
      padding: '52px 48px',
      background:
        'radial-gradient(ellipse at 25% 15%, rgba(255,255,255,0.55) 0%, transparent 55%),' +
        'radial-gradient(ellipse at 80% 85%, #BFD9EA 0%, transparent 60%),' +
        'linear-gradient(160deg, #EAF5FB 0%, #BFD9EA 45%, #4FA3CE 100%)',
    }}>
      {/* Hero photo — elder and younger person walking hand in hand */}
      <img
        src="/walking.jpg"
        alt="An elder and younger person walking together hand in hand"
        draggable="false"
        onDragStart={e => e.preventDefault()}
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: 'center', zIndex: 0,
          userSelect: 'none', WebkitUserDrag: 'none',
          // walking.jpg is hazier than the Login hero photo; lift it so both
          // auth pages feel equally vivid under the same readability wash.
          filter: 'brightness(1.15) saturate(1.45) contrast(1.03)',
        }}
      />

      {/* Soft readability wash — keeps the calm, never harsh black */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background:
          'linear-gradient(to top, rgba(20,55,80,0.62) 0%, rgba(20,55,80,0.30) 45%, rgba(20,55,80,0.05) 100%)',
      }} />

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
        }}>ToWin</p>
      </Link>

      {/* Content — pushed below logo, matches the Login hero treatment */}
      <div style={{ position: 'relative', zIndex: 2, marginTop: '44px' }}>
        <span style={{
          display: 'inline-block', marginBottom: '14px',
          background: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.35)', borderRadius: '9999px',
          padding: '7px 18px', fontSize: 'var(--text-xs)', fontWeight: 600,
          letterSpacing: '0.4px', color: '#fff',
          fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
        }}>
          It takes two To Win.
        </span>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-3xl)', lineHeight: 1.12, color: '#fff',
          marginBottom: '16px', letterSpacing: '-0.02em', fontWeight: 400,
          textShadow: '0 2px 24px rgba(20,55,80,0.45)',
        }}>
          Your community<br />is waiting <span style={{ color: 'var(--trust-gold)' }}>for you</span>.
        </h1>
        <p style={{
          fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
          fontSize: '17px', color: 'rgba(255,255,255,0.94)', maxWidth: '420px',
          lineHeight: 1.55, margin: '0 0 26px',
          textShadow: '0 1px 12px rgba(20,55,80,0.5)',
        }}>
          Join elders and helpers building real, trusted connections every day.
        </p>

        {/* Feature bullets — restyled light to read on the wash */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {['Free to join, no credit card', 'Verified and safe community', 'Your data stays private'].map((text) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                background: 'rgba(255,255,255,0.22)',
                border: '1px solid rgba(255,255,255,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="10" height="8" viewBox="0 0 7 5" fill="none">
                  <path d="M1 2.5L2.8 4L6 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span style={{
                fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.94)',
                textShadow: '0 1px 10px rgba(20,55,80,0.5)',
                fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
              }}>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const BACKEND_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api').replace(/\/api$/, '');

function GoogleButton() {
  const SF = '-apple-system, "SF Pro Text", system-ui, sans-serif';
  return (
    <a
      href={`${BACKEND_URL}/oauth2/authorization/google`}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
        width: '100%', height: '48px',
        background: '#ffffff', border: '1.5px solid var(--border)',
        borderRadius: '9999px', textDecoration: 'none',
        fontSize: '16px', fontWeight: 500, color: 'var(--ink)',
        fontFamily: SF, cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#4FA3CE'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      <svg width="20" height="20" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z"/>
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.4 19 12 24 12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5.1l-6.2-5.2C29.4 35.5 26.8 36 24 36c-5.2 0-9.7-3.3-11.3-8H6.5C9.9 35.7 16.4 44 24 44z"/>
        <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C41 36.2 44 30.5 44 24c0-1.3-.1-2.7-.4-3.9z"/>
      </svg>
      Sign up with Google
    </a>
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
    username: '', email: '', password: '', confirmPassword: '',
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

  const eyeBtn = {
    position: 'absolute', right: '2px', top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', cursor: 'pointer',
    minWidth: '44px', minHeight: '44px',
    color: 'var(--ink-3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  const linkBtn = {
    color: 'var(--blue)', background: 'none', border: 'none', padding: 0,
    cursor: 'pointer', font: 'inherit', textDecoration: 'underline',
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const errs = {};
    if (!/^[a-z0-9_]{3,20}$/.test(form.username)) errs.username = 'Username must be 3-20 characters: lowercase letters, numbers, underscores only';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Enter a valid email address';
    if (form.password.length < 8) errs.password = 'Password must be at least 8 characters';
    if (form.confirmPassword !== form.password) errs.confirmPassword = 'Passwords do not match';
    if (Object.keys(errs).length) { setFieldErrors(errs); setLoading(false); return; }
    setFieldErrors({});
    try {
      const { username, email, password, role } = form;
      // No account is created yet — the backend holds the signup until the user
      // opens the email link. So we don't log in here; we send them to check email.
      await api.post('/auth/register', { username, email, password, role });
      navigate('/check-email', { replace: true, state: { email } });
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
      <div className="auth-form" style={{ flexDirection: 'column', paddingBottom: 0 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: 0, padding: '32px 0' }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          {/* Demo accounts — shown first so users don't miss it (matches Login) */}
          <div style={{
            marginBottom: '20px', background: 'var(--blue-wash)',
            border: '1.5px solid #4FA3CE', borderRadius: '16px',
            padding: '18px 18px 16px',
            position: 'relative',
          }}>
            <span style={{
              position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)',
              background: '#4FA3CE', color: '#fff',
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
                { role: 'ELDER', label: 'Try as an Elder', sub: 'Margaret, 72' },
                { role: 'HELPER', label: 'Try as a Helper', sub: 'Harsha, 23' },
              ].map(({ role, label, sub }) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => handleGuest(role)}
                  disabled={!!guestLoading}
                  style={{
                    flex: 1,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    background: '#ffffff',
                    border: '1.5px solid #BFD9EA',
                    borderRadius: '11px',
                    padding: '12px 10px',
                    cursor: guestLoading ? 'not-allowed' : 'pointer',
                    opacity: guestLoading && guestLoading !== role ? 0.5 : 1,
                    textAlign: 'center',
                    transition: 'border-color 0.15s, background 0.15s',
                    fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
                  }}
                  onMouseEnter={e => { if (!guestLoading) e.currentTarget.style.borderColor = '#4FA3CE'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#BFD9EA'; }}
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

          {/* Form card — same shell as Login */}
          <div className="auth-card" style={{
            background: '#ffffff',
            borderRadius: '18px',
            padding: '40px 36px',
            border: '1px solid var(--border)',
          }}>
            {/* Log in / Create account switcher */}
            <div style={{ display: 'flex', gap: '6px', background: 'var(--surface-2)', borderRadius: '9999px', padding: '5px', marginBottom: '24px' }}>
              <button type="button" onClick={() => navigate('/login')} style={{
                flex: 1, height: '40px', border: 'none', borderRadius: '9999px',
                fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                background: 'transparent', color: 'var(--ink-3)',
              }}>Log in</button>
              <button type="button" style={{
                flex: 1, height: '40px', border: 'none', borderRadius: '9999px',
                fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'default', fontFamily: 'inherit',
                background: '#ffffff', color: 'var(--blue)', boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
              }}>Create account</button>
            </div>

            {/* Headline */}
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '28px', fontWeight: 400, color: 'var(--ink)',
              marginBottom: '6px', letterSpacing: '-0.02em',
            }}>
              Join ToWin.
            </h2>
            <p style={{
              fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
              fontSize: '16px', color: 'var(--ink-3)', marginBottom: '20px',
            }}>
              Create your free account in minutes.
            </p>

            {/* Google sign-up — the easiest path, especially for new users */}
            <GoogleButton />
            <p style={{ textAlign: 'center', fontSize: '14px', color: 'var(--ink-4)', marginTop: '8px', fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif' }}>
              Fastest way in, no password to remember.
            </p>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '22px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              <span style={{ fontSize: '14px', color: 'var(--ink-4)', fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif' }}>or sign up with username</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            </div>

            {/* Role selector */}
            <div style={{
              marginBottom: '20px', background: '#F4FAFD',
              border: '1.5px solid #D8EAF4', borderRadius: '16px',
              padding: '18px',
            }}>
              <label style={{
                display: 'block', fontSize: 'var(--text-sm)', fontWeight: 700,
                color: 'var(--ink)', marginBottom: '3px', letterSpacing: '-0.2px',
                fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
              }}>
                First, who are you joining as?
              </label>
              <div className="role-grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: '12px' }}>
                {ROLES.map(({ value, label, desc }) => {
                  const active = form.role === value;
                  return (
                    <button key={value} type="button" onClick={() => setForm({ ...form, role: value })}
                      style={{
                        padding: '14px 12px', borderRadius: '11px',
                        border: active ? '2px solid #4FA3CE' : '1.5px solid var(--border)',
                        background: active ? '#EAF5FB' : '#ffffff',
                        cursor: 'pointer', textAlign: 'left',
                        transition: 'all 0.15s',
                      }}>
                      <div style={{
                        fontSize: 'var(--text-sm)', fontWeight: 600,
                        color: active ? '#4FA3CE' : '#1d1d1f',
                        marginBottom: '4px',
                        fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
                      }}>
                        {label}
                      </div>
                      <div style={{
                        fontSize: 'var(--text-xs)', lineHeight: 1.3,
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

            {/* Error state */}
            {error && (
              <div style={{
                background: 'var(--red-tint)', border: '1px solid #fecaca',
                borderRadius: '11px', padding: '12px 16px',
                fontSize: 'var(--text-sm)', color: 'var(--red-error)', marginBottom: '20px',
                fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Username */}
              <div>
                <label style={{
                  display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600,
                  color: 'var(--ink)', marginBottom: '6px',
                  fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
                }}>
                  Username
                </label>
                <SmoothInput
                  type="text" autoComplete="username" required
                  className="field"
                  value={form.username}
                  onChange={e => { setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }); setFieldErrors(f => ({ ...f, username: '' })); }}
                  style={{ borderColor: fieldErrors.username ? '#fca5a5' : undefined }}
                />
                {fieldErrors.username && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--red-error)', marginTop: '4px', fontFamily: 'inherit' }}>{fieldErrors.username}</p>}
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-4)', marginTop: '4px', fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif' }}>
                  3-20 characters. Letters, numbers, underscores. Visible to others.
                </p>
              </div>

              {/* Email */}
              <div>
                <label style={{
                  display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600,
                  color: 'var(--ink)', marginBottom: '6px',
                  fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
                }}>
                  Email
                </label>
                <SmoothInput
                  type="email" autoComplete="email" required
                  className="field"
                  value={form.email}
                  onChange={e => { setForm({ ...form, email: e.target.value }); setFieldErrors(f => ({ ...f, email: '' })); }}
                  style={{ borderColor: fieldErrors.email ? '#fca5a5' : undefined }}
                />
                {fieldErrors.email && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--red-error)', marginTop: '4px', fontFamily: 'inherit' }}>{fieldErrors.email}</p>}
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-4)', marginTop: '4px', fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif' }}>
                  We'll send a link to confirm it's really you.
                </p>
              </div>

              {/* Password */}
              <div>
                <label style={{
                  display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600,
                  color: 'var(--ink)', marginBottom: '6px',
                  fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
                }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <SmoothInput
                    type={showPwd ? 'text' : 'password'} autoComplete="new-password" required
                    className="field"
                    value={form.password}
                    onChange={e => { setForm({ ...form, password: e.target.value }); setFieldErrors(f => ({ ...f, password: '' })); }}
                    style={{ borderColor: fieldErrors.password ? '#fca5a5' : undefined, paddingRight: '44px' }}
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    aria-label={showPwd ? 'Hide password' : 'Show password'} style={eyeBtn}>
                    {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {fieldErrors.password && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--red-error)', marginTop: '4px', fontFamily: 'inherit' }}>{fieldErrors.password}</p>}
                {form.password && (
                  <div style={{ marginTop: '6px', display: 'flex', gap: '3px', alignItems: 'center' }}>
                    {[1,2,3,4].map(i => (
                      <div key={i} style={{
                        flex: 1, height: '3px', borderRadius: '9999px',
                        background: i <= pwdStrength(form.password)
                          ? ['#ff3b30','#ff9500','#4FA3CE','#4FA3CE'][pwdStrength(form.password)-1]
                          : 'var(--border)',
                        transition: 'background 0.2s',
                      }} />
                    ))}
                    <span style={{ fontSize: '12px', color: 'var(--ink-3)', marginLeft: '6px', fontFamily: 'inherit' }}>
                      {['','Weak','Fair','Good','Strong'][pwdStrength(form.password)]}
                    </span>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label style={{
                  display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600,
                  color: 'var(--ink)', marginBottom: '6px',
                  fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
                }}>
                  Re-enter password
                </label>
                <div style={{ position: 'relative' }}>
                  <SmoothInput
                    type={showConfirm ? 'text' : 'password'} autoComplete="new-password" required
                    className="field"
                    value={form.confirmPassword}
                    onChange={e => { setForm({ ...form, confirmPassword: e.target.value }); setFieldErrors(f => ({ ...f, confirmPassword: '' })); }}
                    style={{ borderColor: fieldErrors.confirmPassword ? '#fca5a5' : undefined, paddingRight: '44px' }}
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'} style={eyeBtn}>
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {fieldErrors.confirmPassword && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--red-error)', marginTop: '4px', fontFamily: 'inherit' }}>{fieldErrors.confirmPassword}</p>}
                {form.confirmPassword && form.password && form.confirmPassword === form.password && (
                  <p style={{ fontSize: 'var(--text-xs)', color: '#5FA670', marginTop: '4px', fontFamily: 'inherit' }}>Passwords match</p>
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
                  fontSize: '14px', color: 'var(--ink-3)', lineHeight: 1.5,
                  fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
                }}>
                  I agree to the{' '}
                  <button type="button" onClick={() => setLegalOpen('terms')} style={linkBtn}>Terms of Service</button>
                  {' '}and{' '}
                  <button type="button" onClick={() => setLegalOpen('privacy')} style={linkBtn}>Privacy Policy</button>
                </span>
              </label>

              {/* Blue pill Sign In button */}
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

          {/* Log in link — returning users */}
          <p style={{
            textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--ink-3)',
            marginTop: '20px',
            fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
          }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--blue)', fontWeight: 600, textDecoration: 'none' }}>
              Log in
            </Link>
          </p>

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
        </div>
        </div>
        <SiteFooter style={{ marginTop: 'auto' }} />
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
