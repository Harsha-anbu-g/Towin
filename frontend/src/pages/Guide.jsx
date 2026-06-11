import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NavBar from '../components/NavBar';
import { STEPS } from '../data/guideContent';

const SFD = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SF = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const SKY = '#4FA3CE';
const BORDER = '#BFD9EA';

// Simple header shown to logged-out visitors (logged-in users get the NavBar).
function PublicHeader() {
  return (
    <header style={{
      background: '#ffffff', height: '72px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', padding: '0 32px', borderBottom: '1px solid #ececef',
    }}>
      <Link to="/" style={{
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        fontFamily: SFD, fontSize: '24px', fontWeight: 800, color: '#1a5c2e',
        letterSpacing: '-0.4px', textDecoration: 'none',
      }}>
        <img src="/logo.png" alt="ToWin logo" style={{ width: 44, height: 44, objectFit: 'contain' }} />
        ToWin
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
        <Link to="/login" style={{ fontFamily: SF, fontSize: '15px', color: '#5a6470', textDecoration: 'none' }}>
          Sign in
        </Link>
        <Link to="/register" style={{
          fontFamily: SF, fontSize: '15px', fontWeight: 600, color: '#fff', background: SKY,
          padding: '9px 20px', borderRadius: '9999px', textDecoration: 'none',
        }}>
          Get started
        </Link>
      </div>
    </header>
  );
}

function RoleTab({ role, setRole }) {
  const Tab = ({ value, label }) => {
    const active = role === value;
    return (
      <button
        onClick={() => setRole(value)}
        style={{
          flex: 1, padding: '12px 0', fontFamily: SF, fontSize: '16px',
          fontWeight: active ? 700 : 500,
          color: active ? '#fff' : '#5a6470',
          background: active ? SKY : '#fff',
          border: `1px solid ${active ? SKY : '#e0e0e0'}`,
          borderRadius: '9999px', cursor: 'pointer', transition: 'all 0.15s',
        }}
      >
        {label}
      </button>
    );
  };
  return (
    <div style={{ display: 'flex', gap: '10px', marginBottom: '22px' }}>
      <Tab value="ELDER" label="I'm an Elder" />
      <Tab value="HELPER" label="I'm a Helper" />
    </div>
  );
}

function ProgressDots({ count, current, onJump }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginBottom: '8px' }}>
      {Array.from({ length: count }).map((_, i) => {
        const done = i < current;
        const here = i === current;
        return (
          <button
            key={i}
            onClick={() => onJump(i)}
            aria-label={`Go to step ${i + 1}`}
            style={{
              width: here ? '26px' : '11px', height: '11px', borderRadius: '9999px',
              border: 'none', cursor: 'pointer', padding: 0,
              background: here ? SKY : done ? BORDER : '#e0e0e0',
              transition: 'width 0.2s, background 0.2s',
            }}
          />
        );
      })}
    </div>
  );
}

export default function Guide() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isLoggedIn = !!user;

  const [step, setStep] = useState(0);
  const [role, setRole] = useState(user?.role === 'HELPER' ? 'HELPER' : 'ELDER');

  const total = STEPS.length;
  const current = STEPS[step];
  const isLast = step === total - 1;

  const ctx = { role, isLoggedIn, navigate, restart: () => setStep(0) };

  return (
    <div style={{ minHeight: '100svh', background: '#fafafc' }}>
      {isLoggedIn ? <NavBar /> : <PublicHeader />}

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* Page heading */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{
            fontFamily: SFD, fontSize: '34px', fontWeight: 700, color: '#1d1d1f',
            letterSpacing: '-0.5px', margin: '0 0 8px',
          }}>
            How It Works
          </h1>
          <p style={{ fontFamily: SF, fontSize: '16px', color: '#7a7a7a', margin: 0, lineHeight: 1.5 }}>
            A short, step-by-step tour of the platform. Use Back and Next, or tap a dot to jump.
          </p>
        </div>

        {/* Role tab */}
        <RoleTab role={role} setRole={setRole} />

        {/* Progress */}
        <ProgressDots count={total} current={step} onJump={setStep} />
        <p style={{
          fontFamily: SF, fontSize: '13px', color: '#a0a0a5', textAlign: 'center',
          margin: '0 0 20px',
        }}>
          Step {step + 1} of {total} · {current.navLabel}
        </p>

        {/* Step card */}
        <div style={{
          background: '#fff', borderRadius: '18px', border: '1px solid #e0e0e0',
          padding: '32px 36px', boxShadow: '0 2px 16px rgba(0,0,0,0.04)',
          minHeight: '320px',
        }}>
          {current.render(ctx)}
        </div>

        {/* Back / Next */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '20px' }}>
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            style={{
              padding: '13px 28px', fontFamily: SF, fontSize: '16px', fontWeight: 600,
              borderRadius: '9999px', cursor: step === 0 ? 'default' : 'pointer',
              background: '#fff', color: step === 0 ? '#c8c8cd' : '#1d1d1f',
              border: '1px solid #e0e0e0',
            }}
          >
            Back
          </button>
          {!isLast && (
            <button
              onClick={() => setStep(s => Math.min(total - 1, s + 1))}
              style={{
                padding: '13px 32px', fontFamily: SF, fontSize: '16px', fontWeight: 700,
                borderRadius: '9999px', cursor: 'pointer', background: SKY, color: '#fff',
                border: 'none', boxShadow: '0 4px 16px rgba(79,163,206,0.3)',
              }}
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
