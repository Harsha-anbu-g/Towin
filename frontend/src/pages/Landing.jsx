import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { SLIDES } from '../data/landingContent';
import TortoiseMark from '../components/TortoiseMark';

const SFD = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SF = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const SKY = 'var(--blue)';

// The trail tortoise's walk cycle moves ONLY the legs — the body glides level.
// Diagonal pairs swing in antiphase (a tortoise's actual gait), each leg
// pivoting around the point where it meets the shell. The head-up mark's
// attachment corners, per leg, with the pair each belongs to as a sign.
const TRAIL_LEGS = [
  ['.tm-leg-tl', 'bottom right', 1],
  ['.tm-leg-br', 'top left', 1],
  ['.tm-leg-tr', 'bottom left', -1],
  ['.tm-leg-bl', 'top right', -1],
];

// The deck is SCRUBBED, not stepped. A tall invisible runway (one viewport per
// page) gives the browser real native scrolling — momentum, stop-anywhere,
// reverse-anytime — and every frame we map scroll progress onto the horizontal
// track, the walked line, and the tortoise. It feels like one long page that
// happens to move sideways, with the user in full control.

// The journey line — one path from page 1 to page 6, like a map, with the
// tortoise walking along it as you scroll. The walked line and the tortoise
// are driven per-frame through refs (no transitions — they track the finger);
// the dots are discrete state (nearest page) and stay tappable for elders.
function TortoiseTrail({ count, current, arrived, onJump, walkedRef, tortoiseRef, flipRef }) {
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
      {/* Arrival: the last stop blooms green — the journey's "achieved" moment
          (green = achieved). Remounts, and so replays, on each arrival. */}
      {arrived && (
        <span aria-hidden="true" className="arrive-bloom" style={{
          position: 'absolute', left: 'calc(100% - 14px)', bottom: '4px',
          width: '28px', height: '28px', borderRadius: '50%',
          border: '2px solid var(--green-deep)', pointerEvents: 'none',
        }} />
      )}
      {/* the tortoise — walking ON the line (the trail runs through it, like a
          marker on a map). Three layers, one job each: the mover spans the whole
          line so translateX(%) — relative to its own width — lands exactly on
          each stop (per-frame); the flipper turns the head-up mark to face the
          direction of travel (rare writes, so its short transition reads as the
          tortoise turning around); the mark itself is the traced vector
          (TortoiseMark), whose leg paths the walk cycle moves (per-frame). */}
      <div ref={tortoiseRef} style={{
        position: 'absolute', left: 0, right: 0, bottom: '18px', height: 0,
        pointerEvents: 'none', willChange: 'transform',
      }}>
        <div ref={flipRef} style={{
          position: 'absolute', left: '-16px', bottom: '-16px',
          width: '32px', height: '32px',
          transform: 'rotate(90deg)',
          transition: 'transform 240ms cubic-bezier(0.23, 1, 0.32, 1)',
        }}>
          <TortoiseMark size={32} className="tortoise-lit" />
        </div>
      </div>
    </div>
  );
}

// Phone view: the SAME journey line, stood upright on the right edge. It stays
// put (position:fixed) while the story scrolls top-to-bottom, so the tortoise
// walking DOWN mirrors the reader's own downward scroll — no sideways trickery.
// The walked line + tortoise track the finger through refs (no transitions);
// the dots stay discrete, tappable stops for elders.
function MobileTrail({ count, current, arrived, onJump, walkedRef, tortoiseRef, flipRef }) {
  return (
    <div style={{
      position: 'fixed', top: '50%', right: 'max(6px, env(safe-area-inset-right))',
      transform: 'translateY(-50%)', height: 'min(60vh, 420px)', width: '34px',
      zIndex: 6, pointerEvents: 'none',
    }}>
      <div style={{ position: 'relative', height: '100%', width: '100%' }}>
        {/* the full path */}
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: 'calc(50% - 1px)', width: '2px',
          borderRadius: '9999px', background: 'var(--dot-idle)',
        }} />
        {/* the part already walked — scaleY from the top, grows downward as you
            scroll (line stays centered via a static left, so the transform is
            free for scaleY). */}
        <div ref={walkedRef} style={{
          position: 'absolute', top: 0, bottom: 0, left: 'calc(50% - 1px)', width: '2px',
          borderRadius: '9999px', background: SKY,
          transform: 'scaleY(0)', transformOrigin: 'top center', willChange: 'transform',
        }} />
        {/* stops along the path */}
        {Array.from({ length: count }).map((_, i) => (
          <button
            key={i}
            onClick={() => onJump(i)}
            aria-label={`Go to page ${i + 1}`}
            aria-current={i === current ? 'step' : undefined}
            style={{
              position: 'absolute', top: `${(i / (count - 1)) * 100}%`, left: '50%',
              transform: 'translate(-50%, -50%)', pointerEvents: 'auto',
              border: 'none', background: 'transparent', cursor: 'pointer',
              // 44px-tall tap target (elders); the 8px dot sits centered on the line.
              padding: '18px 13px', display: 'inline-flex',
            }}
          >
            <span style={{
              display: 'block', width: '8px', height: '8px', borderRadius: '50%',
              background: 'var(--dot-idle)',
              opacity: i === current ? 0 : 1,
              transition: 'opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
            }} />
          </button>
        ))}
        {/* Arrival: the last stop blooms green — the journey's "achieved"
            moment. Remounts, and so replays, on each arrival. */}
        {arrived && (
          <span aria-hidden="true" className="arrive-bloom" style={{
            position: 'absolute', left: 'calc(50% - 14px)', top: 'calc(100% - 14px)',
            width: '28px', height: '28px', borderRadius: '50%',
            border: '2px solid var(--green-deep)', pointerEvents: 'none',
          }} />
        )}
        {/* the tortoise — walking DOWN the line. Same three layers as the
            laptop trail: the mover spans the rail's full height, so
            translateY(%) — relative to its own height — lands it on each stop
            (per-frame); the flipper turns the head to face the direction of
            travel; the mark is the traced vector (TortoiseMark), whose leg
            paths the walk cycle moves (per-frame). */}
        <div ref={tortoiseRef} style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '100%',
          transform: 'translateY(0)', pointerEvents: 'none', willChange: 'transform',
        }}>
          <div ref={flipRef} style={{
            position: 'absolute', top: '-16px', left: '50%', marginLeft: '-16px',
            width: '32px', height: '32px',
            transform: 'rotate(180deg)',
            transition: 'transform 240ms cubic-bezier(0.23, 1, 0.32, 1)',
          }}>
            <TortoiseMark size={32} className="tortoise-lit" />
          </div>
        </div>
        {/* page counter, tucked just under the rail */}
        <p style={{
          position: 'absolute', bottom: '-28px', left: '50%', transform: 'translateX(-50%)',
          margin: 0, fontFamily: SF, fontSize: '13px', fontWeight: 600, color: 'var(--ink-4)',
          fontVariantNumeric: 'tabular-nums', letterSpacing: '0.5px', whiteSpace: 'nowrap',
        }}>
          {String(current + 1).padStart(2, '0')}/{String(count).padStart(2, '0')}
        </p>
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
  // arrived = the tortoise is actually standing on the last stop (index flips
  // at the halfway point, too early for an arrival moment).
  const [arrived, setArrived] = useState(false);

  // Phones get a plain vertical layout (scroll down = go down) with the journey
  // line stood upright on the side; laptops keep the sideways scrubbed deck.
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 640px)').matches,
  );

  const scrollerRef = useRef(null);
  const trackRef = useRef(null);
  const walkedRef = useRef(null);
  const tortoiseRef = useRef(null);
  const flipRef = useRef(null);
  const sectionsRef = useRef([]);
  const rafPending = useRef(false);

  // The walk itself: step phase advances with distance traveled, amplitude
  // decays back to still once the scrolling stops, and facing follows the
  // direction of travel. All of it lives outside React and is written straight
  // to styles. Reduced-motion visitors keep the original steady glide.
  const walk = useRef({
    primed: false, lastP: 0, phase: 0, amp: 0, raf: 0, dir: 1, legs: null,
    reduced: typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  });

  // The trail mark's leg paths, found once and re-found after the trail is
  // rebuilt (layout swap). Pivots are set here so each leg swings from its
  // shell attachment, not its middle.
  const getLegs = () => {
    const w = walk.current;
    if (w.legs && w.legs[0].el.isConnected) return w.legs;
    const root = flipRef.current;
    if (!root) return null;
    const legs = TRAIL_LEGS.map(([sel, origin, sign]) => {
      const el = root.querySelector(sel);
      if (el) {
        el.style.transformBox = 'fill-box';
        el.style.transformOrigin = origin;
      }
      return el ? { el, sign } : null;
    }).filter(Boolean);
    w.legs = legs.length ? legs : null;
    return w.legs;
  };

  // Its own little rAF loop: writes the leg swing every frame and decays the
  // amplitude, so the legs always come to rest in their drawn position no
  // matter where the finger stops. Scroll paints reset amp to 1, so the loop
  // idles itself out ~250ms after the last movement.
  const waddleTick = () => {
    const w = walk.current;
    const legs = getLegs();
    if (!legs) { w.amp = 0; w.raf = 0; return; }
    w.amp *= 0.82;
    if (w.amp < 0.04) {
      w.amp = 0;
      w.raf = 0;
      legs.forEach(({ el }) => { el.style.transform = 'rotate(0deg)'; });
      return;
    }
    const deg = Math.sin(w.phase * Math.PI * 2) * 16 * w.amp;
    legs.forEach(({ el, sign }) => {
      el.style.transform = `rotate(${(deg * sign).toFixed(2)}deg)`;
    });
    w.raf = requestAnimationFrame(waddleTick);
  };

  // Map scroll progress (0..1 over the runway) onto the deck + tortoise.
  // Direct per-frame style writes — no transitions in the way — so the deck
  // tracks the user's scrolling exactly, momentum and all.
  const paint = () => {
    rafPending.current = false;
    const sc = scrollerRef.current;
    if (!sc) return;
    const range = sc.scrollHeight - sc.clientHeight;
    const p = range > 0 ? Math.min(1, Math.max(0, sc.scrollTop / range)) : 0;

    // The walk: any movement advances the waddle phase (capped per frame so a
    // big fling can't alias into jitter) and turns the head to face the way
    // it's going. The first paint only primes lastP, so a restored scroll
    // position doesn't fake a step.
    const w = walk.current;
    if (!w.primed) { w.primed = true; w.lastP = p; }
    setArrived(p >= 0.985);
    const dp = p - w.lastP;
    w.lastP = p;
    if (!w.reduced && Math.abs(dp) > 0.00005) {
      // ~3 waddle cycles per page walked
      w.phase += Math.min(0.12, Math.abs(dp) * (total - 1) * 3);
      w.amp = 1;
      const dir = dp > 0 ? 1 : -1;
      if (dir !== w.dir && flipRef.current) {
        w.dir = dir;
        flipRef.current.style.transform = isMobile
          ? (dir === 1 ? 'rotate(180deg)' : 'rotate(0deg)')
          : (dir === 1 ? 'rotate(90deg)' : 'rotate(-90deg)');
      }
      if (!w.raf) w.raf = requestAnimationFrame(waddleTick);
    }

    // Phone: vertical scroll drives the upright rail. The walked line grows
    // downward (scaleY) and the tortoise walks down (translateY). The active
    // dot is the slide whose top has passed the viewport middle.
    if (isMobile) {
      if (walkedRef.current) walkedRef.current.style.transform = `scaleY(${p})`;
      if (tortoiseRef.current) tortoiseRef.current.style.transform = `translateY(${p * 100}%)`;
      const mid = sc.scrollTop + sc.clientHeight / 2;
      let active = 0;
      for (let i = 0; i < sectionsRef.current.length; i++) {
        const el = sectionsRef.current[i];
        if (el && el.offsetTop <= mid) active = i;
      }
      setIndex(active);
      return;
    }

    // Laptop: the sideways scrubbed deck (unchanged).
    if (!trackRef.current) return;
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
    const target = Math.max(0, Math.min(total - 1, i));
    // Phone: jump to the slide's real offset (slides are variable height, so a
    // proportional guess would miss). Laptop: proportional along the runway.
    if (isMobile) {
      const el = sectionsRef.current[target];
      if (el) sc.scrollTo({ top: el.offsetTop, behavior: scrollBehavior() });
      return;
    }
    const range = sc.scrollHeight - sc.clientHeight;
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
    const w = walk.current;
    return () => {
      window.removeEventListener('keydown', onKey);
      if (w.raf) cancelAnimationFrame(w.raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track the phone/laptop breakpoint and repaint once the layout swaps (the
  // scroll container is rebuilt, so its refs and metrics all change).
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  useEffect(() => {
    // The trail is rebuilt on a layout swap (fresh flipper with its default
    // facing, new scroll metrics), so re-prime the walk instead of carrying
    // stale direction/position across.
    const w = walk.current;
    w.primed = false;
    w.dir = 1;
    w.amp = 0;
    w.legs = null;
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  // Laptop: a sideways gesture (trackpad swipe, tilt wheel, Shift+wheel on
  // Windows) turns the deck one whole page — the map reads horizontal, so
  // sideways input is a natural ask. The turn rides the same smooth native
  // scroll the map stops use, so the deck and tortoise scrub through the
  // pages and always come to rest ON a page — no half-way states. One page
  // per gesture: once it turns, the rest of the swipe (momentum included) is
  // swallowed until the deltas go quiet. Vertical scrolling stays fully
  // native and snap is never touched. Native listener: React registers
  // wheel as passive, so preventDefault would be ignored through onWheel.
  useEffect(() => {
    if (isMobile) return undefined;
    const sc = scrollerRef.current;
    if (!sc) return undefined;
    const QUIET_MS = 220; // this much silence between deltas ends a gesture
    const COMMIT_PX = 90; // sideways travel needed before the page turns
    let acc = 0;
    let lastT = 0;
    let turned = false;
    const onWheel = (e) => {
      if (e.ctrlKey) return; // pinch-zoom arrives as ctrl+wheel
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; // vertical stays native
      e.preventDefault(); // sideways has no native home here — we own it
      if (e.timeStamp - lastT > QUIET_MS) { acc = 0; turned = false; }
      lastT = e.timeStamp;
      if (turned) return; // one page per gesture; momentum is swallowed
      // deltaMode: 0 = pixels (trackpads, most wheels), 1 = lines (Firefox
      // wheels), 2 = pages.
      const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? sc.clientHeight : 1;
      acc += e.deltaX * unit;
      if (Math.abs(acc) < COMMIT_PX) return;
      turned = true;
      const range = sc.scrollHeight - sc.clientHeight;
      if (range <= 0) return;
      const cur = Math.round((sc.scrollTop / range) * (total - 1));
      const target = Math.max(0, Math.min(total - 1, cur + (acc > 0 ? 1 : -1)));
      sc.scrollTo({ top: (target / (total - 1)) * range, behavior: scrollBehavior() });
    };
    sc.addEventListener('wheel', onWheel, { passive: false });
    return () => sc.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  // ── Phone: plain top-to-bottom story, journey line stood upright on the side ──
  if (isMobile) {
    return (
      <div
        className="landing-canvas landing-mobile"
        ref={scrollerRef}
        onScroll={onScroll}
        style={{
          position: 'relative',
          height: '100%', minHeight: 0,
          overflowY: 'auto', overflowX: 'hidden',
          // Vertical slide deck: each swipe down comes to rest on the next whole
          // slide, one at a time (scroll-snap-stop: always on each panel), the
          // same page-by-page feel the laptop deck has — just downward.
          //
          // The two problems an earlier snap attempt hit are fixed structurally,
          // not by dropping snap: (1) the brand bar + Log in now live INSIDE
          // slide 1, so scrollTop 0 is itself a snap start and the header is
          // never yanked off on load; (2) snap only settles on release — mid-
          // swipe the finger keeps full control.
          scrollSnapType: 'y mandatory',
        }}
      >
        {/* The map — stays put on the right edge while the story scrolls */}
        <MobileTrail
          count={total}
          current={index}
          arrived={arrived}
          onJump={go}
          walkedRef={walkedRef}
          tortoiseRef={tortoiseRef}
          flipRef={flipRef}
        />

        {/* The story — one whole screen per slide, read straight down; each one
            snaps to rest so a swipe down lands on the next. The right pad keeps
            the copy clear of the map rail. */}
        {SLIDES.map((s, i) => (
          <section
            key={s.id}
            ref={(el) => { sectionsRef.current[i] = el; }}
            style={{
              minHeight: '100%', display: 'flex', flexDirection: 'column',
              // Come to rest on this slide, one at a time — never fling past one.
              scrollSnapAlign: 'start', scrollSnapStop: 'always',
            }}
          >
            {/* Brand bar rides at the top of slide 1 (and scrolls away with it),
                so scrollTop 0 is a snap start and the header is never yanked off
                on load. */}
            {i === 0 && (
              <header className="landing-topbar" style={{
                flex: '0 0 auto', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', padding: '16px 20px',
              }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '9px',
                  fontFamily: SFD, fontSize: '20px', fontWeight: 600, color: 'var(--ink)',
                  letterSpacing: '-0.374px',
                }}>
                  <img
                    className="tortoise-lit"
                    src="/tortoise-logo-alpha.png"
                    alt=""
                    style={{ width: 32, height: 32, objectFit: 'contain' }}
                  />
                  ToWin
                </span>
                <Link to="/login" style={{
                  fontFamily: SF, fontSize: '15px', fontWeight: 600, color: SKY,
                  textDecoration: 'none', padding: '12px 4px',
                }}>
                  Log in
                </Link>
              </header>
            )}
            <div style={{
              flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: '40px 46px 40px 22px',
            }}>
              <div className="bf" style={{ width: '100%', maxWidth: s.wide ? '880px' : '760px' }}>
                {s.render()}
              </div>
              {i === total - 1 && (
                <div
                  // The rise plays when the reader arrives (class toggles on),
                  // just after the trail's green bloom — bloom leads, action follows.
                  className={index === total - 1 ? 'start-rise' : undefined}
                  style={{ marginTop: '28px', display: 'flex', justifyContent: 'center' }}
                >
                  <StartButton onStart={() => navigate('/login')} />
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
    );
  }

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
              arrived={arrived}
              onJump={go}
              walkedRef={walkedRef}
              tortoiseRef={tortoiseRef}
              flipRef={flipRef}
            />
            <p style={{
              fontFamily: SF, fontSize: '13px', fontWeight: 600, color: 'var(--ink-4)',
              textAlign: 'center', margin: '4px 0 14px',
              fontVariantNumeric: 'tabular-nums', letterSpacing: '1px',
            }}>
              {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
            </p>

            {isLast ? (
              // Mounts on arrival, so the rise plays just after the trail's
              // green bloom — bloom leads, action follows.
              <div className="start-rise" style={{ display: 'flex', justifyContent: 'center' }}>
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
