import { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { SLIDES } from '../data/landingContent';

const SFD = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SF = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const SKY = '#4FA3CE';
const BORDER = '#BFD9EA';

// Aliased so the JSX usage counts as a real use of `motion` under this repo's
// flat eslint config (no eslint-plugin-react ⇒ no jsx-uses-vars), and the
// capitalized names are exempt from no-unused-vars' varsIgnorePattern.
const MotionButton = motion.button;
const MotionSpan = motion.span;

function ProgressDots({ count, current, onJump }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
      {Array.from({ length: count }).map((_, i) => {
        const done = i < current;
        const here = i === current;
        return (
          <button
            key={i}
            onClick={() => onJump(i)}
            aria-label={`Go to slide ${i + 1}`}
            style={{
              width: here ? '26px' : '11px', height: '11px', borderRadius: '9999px',
              border: 'none', cursor: 'pointer', padding: 0,
              background: here ? SKY : done ? BORDER : '#dfe6ec',
              transition: 'width 0.2s, background 0.2s',
            }}
          />
        );
      })}
    </div>
  );
}

// The Next button "fills like water" before it unlocks, giving people a beat to
// actually read the slide. Once a slide has been read through once it never
// re-locks (the parent's `seen` set), and reduced-motion users skip the gate
// entirely — so nobody who's already read, or who can't see the motion, is
// ever trapped waiting.
function ChargingNext({ slideKey, durationMs, label, onAdvance, alreadySeen, onCharged }) {
  const reduce = useReducedMotion();
  const instant = reduce || alreadySeen;     // no gate: unlock immediately
  // The parent remounts this via key={slide.id}, so initial state resets per slide.
  const [ready, setReady] = useState(instant);
  const [justReady, setJustReady] = useState(false);

  // Clear the one-shot "unlocked!" pulse after it plays.
  useEffect(() => {
    if (!justReady) return undefined;
    const t = setTimeout(() => setJustReady(false), 450);
    return () => clearTimeout(t);
  }, [justReady]);

  const handleFilled = () => {
    setReady(true);
    setJustReady(true);
    onCharged();
  };

  return (
    <MotionButton
      type="button"
      onClick={() => ready && onAdvance()}
      disabled={!ready}
      aria-label={ready ? label : 'Take a moment to read — this unlocks shortly'}
      animate={{ scale: justReady ? [1, 1.05, 1] : 1 }}
      transition={{ duration: 0.45 }}
      style={{
        position: 'relative', overflow: 'hidden',
        padding: '13px 32px', minWidth: '150px',
        fontFamily: SF, fontSize: '17px', fontWeight: 400,
        borderRadius: '9999px',
        cursor: ready ? 'pointer' : 'default',
        background: ready ? SKY : '#E3F1F9',
        color: ready ? '#fff' : '#5E7C8C',
        border: ready ? 'none' : `1px solid ${BORDER}`,
        boxShadow: ready ? '0 4px 16px rgba(79,163,206,0.3)' : 'none',
        transition: 'background 0.3s, color 0.3s, box-shadow 0.3s',
      }}
    >
      {/* The rising water — only while this slide is still charging. */}
      {!instant && !ready && (
        <MotionSpan
          key={slideKey}
          aria-hidden
          initial={{ height: '0%' }}
          animate={{ height: '100%' }}
          transition={{ duration: durationMs / 1000, ease: 'linear' }}
          onAnimationComplete={handleFilled}
          style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            background: 'rgba(79,163,206,0.5)',
            zIndex: 0,
          }}
        />
      )}
      <span style={{ position: 'relative', zIndex: 1 }}>
        {ready ? label : 'Read this…'}
      </span>
    </MotionButton>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  // Slides whose read-gate has already been completed — revisiting these
  // unlocks Next instantly so Back/forward never re-traps the reader.
  const [seen, setSeen] = useState(() => new Set());
  const total = SLIDES.length;
  const slide = SLIDES[index];
  const isLast = index === total - 1;

  return (
    <div style={{
      height: '100svh', minHeight: 0, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      background:
        'radial-gradient(ellipse at 20% 10%, rgba(255,255,255,0.8) 0%, transparent 55%),' +
        'linear-gradient(165deg, #F4FAFD 0%, #EAF5FB 55%, #D9EBF5 100%)',
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
        <ProgressDots count={total} current={index} onJump={setIndex} />
        <p style={{
          fontFamily: SF, fontSize: '14px', color: 'var(--ink-4)',
          textAlign: 'center', margin: '10px 0 18px',
        }}>
          {index + 1} of {total}
        </p>

        {isLast ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <button
              onClick={() => navigate('/login')}
              style={{
                minWidth: '260px', height: '54px', background: SKY, color: '#fff',
                border: 'none', borderRadius: '9999px', cursor: 'pointer',
                fontFamily: SF, fontSize: '17px', fontWeight: 400,
                boxShadow: '0 6px 20px rgba(79,163,206,0.4)',
              }}
            >
              Start
            </button>
            <div style={{ display: 'flex', gap: '22px', alignItems: 'center' }}>
              <button
                onClick={() => setIndex(i => Math.max(0, i - 1))}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: SF, fontSize: '16px', fontWeight: 600,
                  color: 'var(--ink-slate)', padding: '8px 4px',
                }}
              >
                Back
              </button>
              <Link to="/how-it-works" style={{
                fontFamily: SF, fontSize: '16px', fontWeight: 600,
                color: SKY, textDecoration: 'none', padding: '8px 4px',
              }}>
                Read the full guide
              </Link>
            </div>
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
              <ChargingNext
                key={slide.id}
                slideKey={slide.id}
                durationMs={slide.readMs || 3000}
                label={slide.nextLabel || 'Next'}
                alreadySeen={seen.has(index)}
                onCharged={() => setSeen(s => new Set(s).add(index))}
                onAdvance={() => setIndex(i => Math.min(total - 1, i + 1))}
              />
            </div>
            {/* Always-visible real exit, so a confused tapper can reach the app immediately. */}
            <button
              onClick={() => navigate('/login')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: SF, fontSize: '15px', fontWeight: 600,
                color: 'var(--ink-4)', padding: '6px 4px',
              }}
            >
              Skip the tour →
            </button>
          </div>
        )}

      </footer>
    </div>
  );
}
