import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { SLIDES } from '../data/landingContent';

const SFD = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SF = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const SKY = 'var(--blue)';

// The deck is SCRUBBED, not stepped. A tall invisible runway (one viewport per
// page) gives the browser real native scrolling — momentum, stop-anywhere,
// reverse-anytime — and every frame we map scroll progress onto the horizontal
// track, the walked line, and the tortoise. It feels like one long page that
// happens to move sideways, with the user in full control.

// The journey line — one path from page 1 to page 6, like a map, with the
// tortoise walking along it as you scroll. The walked line and the tortoise
// are driven per-frame through refs (no transitions — they track the finger);
// the dots are discrete state (nearest page) and stay tappable for elders.
function TortoiseTrail({ count, current, onJump, walkedRef, tortoiseRef }) {
  return (
    <div style={{ position: 'relative', maxWidth: '720px', margin: '0 auto', height: '56px' }}>
      {/* the full path */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: '17px', height: '2px',
        borderRadius: '9999px', background: 'var(--dot-idle)',
      }} />
      {/* the part already walked — scaleX, not width, to stay on the GPU */}
      <div ref={walkedRef} style={{
        position: 'absolute', left: 0, right: 0, bottom: '17px', height: '2px',
        borderRadius: '9999px', background: SKY,
        transformOrigin: 'left center', willChange: 'transform',
      }} />
      {/* stops along the path */}
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          onClick={() => onJump(i)}
          aria-label={`Go to page ${i + 1}`}
          aria-current={i === current ? 'step' : undefined}
          style={{
            position: 'absolute', left: `${(i / (count - 1)) * 100}%`, bottom: 0,
            transform: 'translateX(-50%)',
            border: 'none', background: 'transparent', cursor: 'pointer',
            // 44x44 tap target (elders); 14px bottom pad centers the 8px dot
            // exactly on the line (line center sits 18px up from the bottom).
            padding: '22px 18px 14px', display: 'inline-flex',
          }}
        >
          <span style={{
            display: 'block', width: '8px', height: '8px', borderRadius: '50%',
            // Stops stay quiet waypoints — the tortoise itself is the position
            // marker, so the stop it is standing on fades out underneath it.
            background: 'var(--dot-idle)',
            opacity: i === current ? 0 : 1,
            transition: 'opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
          }} />
        </button>
      ))}
      {/* the tortoise — walking ON the line (the trail runs through it, like a
          marker on a map). The mover spans the whole line, so translateX(%) —
          which is relative to the mover's own width — lands exactly on each
          stop. */}
      <div ref={tortoiseRef} style={{
        position: 'absolute', left: 0, right: 0, bottom: '18px', height: 0,
        pointerEvents: 'none', willChange: 'transform',
      }}>
        <img
          className="tortoise-lit"
          src="/tortoise-logo-alpha.png"
          alt=""
          style={{
            position: 'absolute', left: '-16px', bottom: '-16px',
            width: '32px', height: '32px', objectFit: 'contain',
            // The mark is drawn head-up; face the head along the direction of travel.
            transform: 'rotate(90deg)',
          }}
        />
      </div>
    </div>
  );
}

function StartButton({ onStart }) {
  return (
    <button
      type="button"
      onClick={onStart}
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
      Start
    </button>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const total = SLIDES.length;
  // index = nearest page; drives the dots, counter, inert, and the Start swap.
  const [index, setIndex] = useState(0);
  const isLast = index === total - 1;

  const scrollerRef = useRef(null);
  const trackRef = useRef(null);
  const walkedRef = useRef(null);
  const tortoiseRef = useRef(null);
  const rafPending = useRef(false);

  // Map scroll progress (0..1 over the runway) onto the deck + tortoise.
  // Direct per-frame style writes — no transitions in the way — so the deck
  // tracks the user's scrolling exactly, momentum and all.
  const paint = () => {
    rafPending.current = false;
    const sc = scrollerRef.current;
    if (!sc || !trackRef.current) return;
    const range = sc.scrollHeight - sc.clientHeight;
    const p = range > 0 ? Math.min(1, Math.max(0, sc.scrollTop / range)) : 0;
    trackRef.current.style.transform = `translateX(${-p * (total - 1) * 100}%)`;
    if (walkedRef.current) walkedRef.current.style.transform = `scaleX(${p})`;
    if (tortoiseRef.current) tortoiseRef.current.style.transform = `translateX(${p * 100}%)`;
    setIndex(Math.round(p * (total - 1)));
  };

  const onScroll = () => {
    if (rafPending.current) return;
    rafPending.current = true;
    requestAnimationFrame(paint);
  };

  // Reduced-motion users get instant jumps; CSS can't override an explicit
  // JS behavior option, so honor the preference here.
  const scrollBehavior = () =>
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

  // Tapping a stop rides the same native scroll, so the deck and tortoise
  // scrub through the pages in between instead of teleporting.
  const go = (i) => {
    const sc = scrollerRef.current;
    if (!sc) return;
    const range = sc.scrollHeight - sc.clientHeight;
    const target = Math.max(0, Math.min(total - 1, i));
    sc.scrollTo({ top: (target / (total - 1)) * range, behavior: scrollBehavior() });
  };

  useEffect(() => {
    paint();
    // Keyboard: arrows / PageUp / PageDown scroll one page's worth, since
    // the runway div itself never holds focus. Handlers only touch refs.
    const onKey = (e) => {
      if (e.altKey || e.metaKey || e.ctrlKey) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      const fwd = e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'PageDown';
      const back = e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'PageUp';
      if (!fwd && !back) return;
      const sc = scrollerRef.current;
      if (!sc) return;
      e.preventDefault();
      sc.scrollBy({ top: (fwd ? 1 : -1) * sc.clientHeight, behavior: scrollBehavior() });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="landing-canvas"
      ref={scrollerRef}
      onScroll={onScroll}
      style={{
        /* 100% of the app shell's scroll area — not 100svh — so when the beta
           banner is up the footer still fits on screen on phones. This element
           IS the scroll container; the runway below gives it its length. */
        height: '100%', minHeight: 0,
        overflowY: 'auto', overflowX: 'hidden',
        // The rule: the deck always comes to rest ON a page. While scrolling
        // the user has full control (the scrub follows the finger); on release
        // the browser's own physics settle to the nearest page, one at a time.
        scrollSnapType: 'y mandatory',
        // Warm paper canvas with a whisper of sky top-right — editorial, not clinical.
        // (User-approved 2026-07-05: warm parchment over near-neutral.)
        // Background gradient lives in .landing-canvas (theme-aware); the
        // default background-attachment keeps it pinned to the box, not the runway.
      }}
    >
      {/* The runway: one viewport of scroll length per page. Everything the
          user sees rides inside the sticky screen below. */}
      <div style={{ height: `${total * 100}%`, position: 'relative' }}>
        {/* Snap markers — one per page. scroll-snap-stop: always means even a
            big fling rests on the very next page, never skipping one. */}
        {SLIDES.map((s, i) => (
          <div
            key={s.id}
            aria-hidden="true"
            style={{
              position: 'absolute', left: 0, right: 0,
              top: `${(i / total) * 100}%`, height: `${100 / total}%`,
              scrollSnapAlign: 'start', scrollSnapStop: 'always',
              pointerEvents: 'none',
            }}
          />
        ))}
        <div style={{
          position: 'sticky', top: 0, height: `${100 / total}%`,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
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
                className="tortoise-lit"
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

          {/* Slide content — all pages sit side by side; scroll progress is
              painted onto the track's translateX every frame, so the deck
              moves exactly with the user's scrolling. Each panel scrolls
              vertically on its own only when a slide is taller than the
              viewport (native scroll chaining hands off to the runway at its
              edges). Off-screen panels are inert + aria-hidden so their links
              can't catch keyboard focus. */}
          <main className="landing-main" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <div className="landing-track" ref={trackRef} style={{ display: 'flex', height: '100%' }}>
              {SLIDES.map((s, i) => (
                <section
                  key={s.id}
                  aria-hidden={i !== index}
                  inert={i !== index}
                  style={{
                    flex: '0 0 100%', minWidth: 0, height: '100%',
                    overflowY: 'auto', padding: '24px 40px',
                  }}
                >
                  <div style={{
                    minHeight: '100%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div className="bf" style={{ width: '100%', maxWidth: s.wide ? '880px' : '760px' }}>
                      {s.render()}
                    </div>
                  </div>
                </section>
              ))}
            </div>
          </main>

          {/* Footer: the tortoise journey line, page counter, and either the
              scroll cue or — on the last page — the Start action. */}
          <footer className="landing-footer" style={{ padding: '0 40px 28px' }}>
            <TortoiseTrail
              count={total}
              current={index}
              onJump={go}
              walkedRef={walkedRef}
              tortoiseRef={tortoiseRef}
            />
            <p style={{
              fontFamily: SF, fontSize: '13px', fontWeight: 600, color: 'var(--ink-4)',
              textAlign: 'center', margin: '4px 0 14px',
              fontVariantNumeric: 'tabular-nums', letterSpacing: '1px',
            }}>
              {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
            </p>

            {isLast ? (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <StartButton onStart={() => navigate('/login')} />
              </div>
            ) : (
              <div aria-hidden="true" style={{
                height: '49px', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '1px',
                color: 'var(--ink-4)',
              }}>
                <span style={{ fontFamily: SF, fontSize: '14px', fontWeight: 600, letterSpacing: '0.4px' }}>
                  Scroll
                </span>
                <svg
                  className="hint-bob"
                  width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
            )}
          </footer>
        </div>
      </div>
    </div>
  );
}
