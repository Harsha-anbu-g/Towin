import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { SLIDES } from '../data/landingContent';

const SFD = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SF = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const SKY = '#4FA3CE';
const BORDER = '#BFD9EA';

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

export default function Landing() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const total = SLIDES.length;
  const slide = SLIDES[index];
  const isLast = index === total - 1;

  return (
    <div style={{
      minHeight: '100svh', display: 'flex', flexDirection: 'column',
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
          fontFamily: SFD, fontSize: '21px', fontWeight: 800, color: '#1d1d1f',
          letterSpacing: '-0.3px',
        }}>
          <img
            src="/tortoise-logo.png"
            alt=""
            style={{ width: 34, height: 34, objectFit: 'contain', mixBlendMode: 'multiply' }}
          />
          ToWin
        </span>
        <Link to="/login" style={{
          fontFamily: SF, fontSize: '15px', fontWeight: 600, color: SKY,
          textDecoration: 'none', padding: '14px 6px',
        }}>
          Already a member? Log in
        </Link>
      </header>

      {/* Slide content — key remounts the wrapper so .bf re-animates per slide */}
      <main className="landing-main" style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px 40px',
      }}>
        <div key={slide.id} className="bf" style={{ width: '100%', maxWidth: '680px' }}>
          {slide.render()}
        </div>
      </main>

      {/* Footer: dots + navigation */}
      <footer className="landing-footer" style={{ padding: '0 40px 36px' }}>
        <ProgressDots count={total} current={index} onJump={setIndex} />
        <p style={{
          fontFamily: SF, fontSize: '13px', color: '#a0a0a5',
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
                fontFamily: SF, fontSize: '18px', fontWeight: 700,
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
                  fontFamily: SF, fontSize: '15px', fontWeight: 600,
                  color: '#5a6470', padding: '8px 4px',
                }}
              >
                Back
              </button>
              <Link to="/how-it-works" style={{
                fontFamily: SF, fontSize: '15px', fontWeight: 600,
                color: SKY, textDecoration: 'none', padding: '8px 4px',
              }}>
                Read the full guide
              </Link>
            </div>
          </div>
        ) : (
          <div style={{
            display: 'flex', justifyContent: 'space-between', gap: '12px',
            maxWidth: '480px', margin: '0 auto',
          }}>
            <button
              onClick={() => setIndex(i => Math.max(0, i - 1))}
              disabled={index === 0}
              style={{
                padding: '13px 28px', fontFamily: SF, fontSize: '16px', fontWeight: 600,
                borderRadius: '9999px', cursor: index === 0 ? 'default' : 'pointer',
                background: '#fff', color: index === 0 ? '#c8c8cd' : '#1d1d1f',
                border: '1px solid #e0e0e0',
              }}
            >
              Back
            </button>
            <button
              onClick={() => setIndex(i => Math.min(total - 1, i + 1))}
              style={{
                padding: '13px 32px', fontFamily: SF, fontSize: '16px', fontWeight: 700,
                borderRadius: '9999px', cursor: 'pointer', background: SKY, color: '#fff',
                border: 'none', boxShadow: '0 4px 16px rgba(79,163,206,0.3)',
              }}
            >
              {slide.nextLabel || 'Next'}
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}
