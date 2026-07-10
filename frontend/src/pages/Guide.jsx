import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import NavBar from '../components/NavBar';
import { STEPS } from '../data/guideContent';

const SFD = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SF = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const SKY = 'var(--blue)';
const BORDER = 'var(--blue-soft)';

// Simple header shown to logged-out visitors (logged-in users get the NavBar).
function PublicHeader() {
  return (
    <header style={{
      background: 'var(--canvas)', height: '72px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', padding: '0 32px', borderBottom: '1px solid var(--border)',
    }}>
      <Link to="/" style={{
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        fontFamily: SFD, fontSize: '24px', fontWeight: 600, color: 'var(--green-deep)',
        letterSpacing: '-0.4px', textDecoration: 'none',
      }}>
        <img src="/logo.png" alt="ToWin logo" style={{ width: 44, height: 44, objectFit: 'contain' }} />
        ToWin
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
        <Link to="/login" style={{ fontFamily: SF, fontSize: '16px', color: 'var(--ink-slate)', textDecoration: 'none' }}>
          Log in
        </Link>
        <Link to="/register" style={{
          fontFamily: SF, fontSize: '16px', fontWeight: 600, color: '#fff', background: SKY,
          padding: '9px 20px', borderRadius: '9999px', textDecoration: 'none',
        }}>
          Get started
        </Link>
      </div>
    </header>
  );
}

// Hoisted out of RoleTab: components defined during a render are re-created
// on every render (react-hooks/static-components), losing DOM state.
function RoleTabButton({ value, label, role, setRole }) {
  const active = role === value;
  return (
    <button
      onClick={() => setRole(value)}
      style={{
        flex: 1, padding: '11px 0', fontFamily: SF, fontSize: '16px',
        fontWeight: active ? 700 : 500,
        color: active ? '#fff' : 'var(--ink-slate)',
        background: active ? SKY : 'var(--canvas)',
        border: `1px solid ${active ? SKY : 'var(--border)'}`,
        borderRadius: '9999px', cursor: 'pointer', transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );
}

function RoleTab({ role, setRole }) {
  return (
    <div style={{ display: 'flex', gap: '10px', marginBottom: '22px' }}>
      <RoleTabButton value="ELDER" label="I'm an Elder" role={role} setRole={setRole} />
      <RoleTabButton value="HELPER" label="I'm a Helper" role={role} setRole={setRole} />
    </div>
  );
}

function ProgressDots({ count, current, onJump }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
      {Array.from({ length: count }).map((_, i) => {
        const done = i < current;
        const here = i === current;
        return (
          <button
            key={i}
            onClick={() => onJump(i)}
            aria-label={`Go to step ${i + 1}`}
            style={{
              // 36x36 hit area (elders); the visual dot stays small inside.
              minWidth: '36px', minHeight: '36px',
              border: 'none', cursor: 'pointer', padding: 0,
              background: 'transparent',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{
              display: 'block',
              width: here ? '26px' : '11px', height: '11px', borderRadius: '9999px',
              background: here ? SKY : done ? BORDER : 'var(--border)',
              // GPU-only: the width change lands instantly; only paint animates.
              transition: 'background 0.2s ease-out',
            }} />
          </button>
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
    <div style={{ minHeight: '100svh', background: 'var(--surface-pearl)' }}>
      {isLoggedIn ? <NavBar /> : <PublicHeader />}

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* Page heading */}
        <div style={{ marginBottom: '22px' }}>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 400, color: 'var(--ink)',
            letterSpacing: '-0.02em', margin: '0 0 6px',
          }}>
            How It Works
          </h1>
          <p style={{ fontFamily: SF, fontSize: 'var(--text-sm)', color: 'var(--ink-3)', margin: 0, lineHeight: 1.5 }}>
            A short, step-by-step tour of the platform. Use Back and Next, or tap a dot to jump.
          </p>
        </div>

        {/* Role tab */}
        <RoleTab role={role} setRole={setRole} />

        {/* Progress */}
        <ProgressDots count={total} current={step} onJump={setStep} />
        <p style={{
          fontFamily: SF, fontSize: '14px', color: 'var(--ink-4)', textAlign: 'center',
          margin: '0 0 20px',
        }}>
          Step {step + 1} of {total} · {current.navLabel}
        </p>

        {/* Step card */}
        <div style={{
          background: 'var(--canvas)', borderRadius: '18px', border: '1px solid var(--border)',
          padding: '24px 28px',          minHeight: '280px',
        }}>
          {current.render(ctx)}
        </div>

        {/* Back / Next */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '20px' }}>
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            style={{
              padding: '11px 24px', fontFamily: SF, fontSize: '16px', fontWeight: 600,
              borderRadius: '9999px', cursor: step === 0 ? 'default' : 'pointer',
              background: 'var(--canvas)', color: step === 0 ? 'var(--ink-faint)' : 'var(--ink)',
              border: '1px solid var(--border)',
            }}
          >
            Back
          </button>
          {!isLast && (
            <button
              onClick={() => setStep(s => Math.min(total - 1, s + 1))}
              style={{
                padding: '11px 28px', fontFamily: SF, fontSize: '16px', fontWeight: 600,
                borderRadius: '9999px', cursor: 'pointer', background: SKY, color: '#fff',
                border: 'none', boxShadow: '0 2px 10px rgba(79,163,206,0.22)',
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
