import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { SLIDES } from '../data/landingContent';

const SFD = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SF = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const SKY = '#4FA3CE';
const BORDER = '#BFD9EA';

// Progress as a slim "trail" — the guided walk, one segment per step. The bar is
// thin for calm, but each button pads out to a comfortable tap target (elders).
function Trail({ count, current, onJump }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', justifyContent: 'center' }}>
      {Array.from({ length: count }).map((_, i) => {
        const done = i < current;
        const here = i === current;
        return (
          <button
            key={i}
            onClick={() => onJump(i)}
            aria-label={`Go to step ${i + 1}`}
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer', padding: '9px 0',
              display: 'inline-flex', alignItems: 'center',
            }}
          >
            <span style={{
              display: 'block', width: here ? '34px' : '18px', height: '4px', borderRadius: '9999px',
              background: here ? SKY : done ? BORDER : '#dfe6ec',
              // GPU-only: animate paint, not layout (width). Emil #7 / Impeccable layout-transition.
              transition: 'background 0.28s cubic-bezier(0.16,1,0.3,1)',
            }} />
          </button>
        );
      })}
    </div>
  );
}

// Primary Next/Start action — always tappable. (The old read-gate that locked
// this button for a few seconds tested badly for elders: a disabled primary
// button reads as broken, and it added friction right before sign-up.)
function NextButton({ label, onAdvance }) {
  return (
    <button
      type="button"
      onClick={onAdvance}
      style={{
        padding: '13px 32px', minWidth: '150px',
        fontFamily: SF, fontSize: '17px', fontWeight: 400,
        borderRadius: '9999px', cursor: 'pointer',
        background: SKY, color: '#fff', border: 'none',
        boxShadow: '0 4px 16px rgba(79,163,206,0.3)',
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
    >
      {label}
    </button>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const total = SLIDES.length;
  const slide = SLIDES[index];
  const isLast = index === total - 1;

  return (
    <div style={{
      height: '100svh', minHeight: 0, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      // Warm paper canvas with a whisper of sky top-right — editorial, not clinical.
      // (User-approved 2026-07-05: warm parchment over near-neutral.)
      background:
        'radial-gradient(ellipse at 82% -8%, #E9F2F7 0%, transparent 42%),' +
        'linear-gradient(168deg, #FAF8F3 0%, #F4F1E9 100%)',
    }}>
      {/* Top bar: brand left, escape hatch right */}
      <header className="landing-topbar" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 40px',
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '9px',
          fontFamily: SFD, fontSize: '21px', fontWeight: 600, color: 'var(--ink)',
          letterSpacing: '-0.374px',
        }}>
          <img
            src="/tortoise-logo-alpha.png"
            alt=""
            style={{ width: 34, height: 34, objectFit: 'contain' }}
          />
          ToWin
        </span>
        <Link to="/login" style={{
          fontFamily: SF, fontSize: '16px', fontWeight: 600, color: SKY,
          textDecoration: 'none', padding: '14px 6px',
        }}>
          Already a member? Log in
        </Link>
      </header>

      {/* Slide content — key remounts the wrapper so .bf re-animates per slide.
          The middle scrolls on its own only when a slide is taller than the
          viewport, so the header and the Back/Next footer stay visible on every
          screen size (the inner min-height:100% keeps content centred when it
          fits, and lets it grow + scroll when it doesn't). */}
      <main className="landing-main" style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        padding: '24px 40px',
      }}>
        <div style={{
          minHeight: '100%', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <div key={slide.id} className="bf" style={{ width: '100%', maxWidth: slide.wide ? '880px' : '760px' }}>
            {slide.render()}
          </div>
        </div>
      </main>

      {/* Footer: dots + navigation */}
      <footer className="landing-footer" style={{ padding: '0 40px 36px' }}>
        <Trail count={total} current={index} onJump={setIndex} />
        <p style={{
          fontFamily: SF, fontSize: '13px', fontWeight: 600, color: 'var(--ink-4)',
          textAlign: 'center', margin: '6px 0 18px',
          fontVariantNumeric: 'tabular-nums', letterSpacing: '1px',
        }}>
          {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </p>

        {isLast ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', gap: '12px',
              maxWidth: '480px', width: '100%', margin: '0 auto',
            }}>
              <button
                onClick={() => setIndex(i => Math.max(0, i - 1))}
                style={{
                  padding: '13px 28px', fontFamily: SF, fontSize: '17px', fontWeight: 400,
                  borderRadius: '9999px', cursor: 'pointer',
                  background: '#fff', color: '#1d1d1f',
                  border: '1px solid #e0e0e0',
                }}
              >
                Back
              </button>
              <NextButton label="Start" onAdvance={() => navigate('/login')} />
            </div>
            <Link to="/how-it-works" style={{
              fontFamily: SF, fontSize: '16px', fontWeight: 600,
              color: SKY, textDecoration: 'none', padding: '8px 4px',
            }}>
              Read the full guide
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', gap: '12px',
              maxWidth: '480px', width: '100%', margin: '0 auto',
            }}>
              <button
                onClick={() => setIndex(i => Math.max(0, i - 1))}
                disabled={index === 0}
                style={{
                  padding: '13px 28px', fontFamily: SF, fontSize: '17px', fontWeight: 400,
                  borderRadius: '9999px', cursor: index === 0 ? 'default' : 'pointer',
                  background: '#fff', color: index === 0 ? '#c8c8cd' : '#1d1d1f',
                  border: '1px solid #e0e0e0',
                }}
              >
                Back
              </button>
              <NextButton
                label={slide.nextLabel || 'Next'}
                onAdvance={() => setIndex(i => Math.min(total - 1, i + 1))}
              />
            </div>
          </div>
        )}

      </footer>
    </div>
  );
}
