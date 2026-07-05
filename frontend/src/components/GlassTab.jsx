import LiquidGlass from 'liquid-glass-react';

/* ─── Liquid-glass tab ────────────────────────────────────────────────────
   The active dashboard tab is rendered as Apple-style "liquid glass".

   The real light-refraction (rdev/liquid-glass-react) is built on SVG
   displacement used as a backdrop-filter, which only Chromium ships — Safari
   and Firefox would show no refraction. So we use the library only where it
   actually works and fall back to a hand-rolled CSS frosted-glass everywhere
   else. Inactive tabs are always the plain transparent button.

   Most of ToWin's audience is on iPhone/Safari, where the CSS path renders —
   the library is a progressive enhancement for Chromium users. */

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
const isSafari  = /^((?!chrome|android).)*safari/i.test(ua);
const isFirefox = /firefox|fxios/i.test(ua);
// Chromium-based engines (Chrome, Edge, Opera, Brave, Chrome-Android) support
// SVG filters as backdrop-filter; Safari and Firefox do not.
const SUPPORTS_REFRACTION = !isSafari && !isFirefox;

const baseStyle = {
  flex: '1 1 auto',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
  height: '44px', padding: '0 16px',
  fontSize: '16px', letterSpacing: '-0.1px',
  borderRadius: '12px',
  cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
  position: 'relative',
};

export default function GlassTab({ active, onClick, children }) {
  // Chromium + active → genuine liquid-glass lens via the library.
  if (active && SUPPORTS_REFRACTION) {
    return (
      <LiquidGlass
        onClick={onClick}
        cornerRadius={12}
        padding="0 18px"
        displacementScale={60}
        blurAmount={0.06}
        saturation={150}
        aberrationIntensity={2}
        elasticity={0.12}
        style={{ flex: '1 1 auto' }}
      >
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          height: '44px', fontSize: '16px', letterSpacing: '-0.1px', fontWeight: 700,
          color: '#ffffff', whiteSpace: 'nowrap', fontFamily: 'inherit',
        }}>
          {children}
        </span>
      </LiquidGlass>
    );
  }

  // Everyone else (and every inactive tab) → CSS frosted glass / plain button.
  return (
    <button
      onClick={onClick}
      style={{
        ...baseStyle,
        fontWeight: active ? 700 : 600,
        color: active ? '#ffffff' : 'var(--ink-slate)',
        background: active
          ? 'radial-gradient(125% 85% at 50% -10%, rgba(255,255,255,0.55), rgba(255,255,255,0) 55%), linear-gradient(180deg, #5FB2D8 0%, #3E8AB0 100%)'
          : 'transparent',
        border: active ? '1px solid rgba(255,255,255,0.45)' : '1px solid transparent',
        boxShadow: active
          ? 'inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -3px 7px rgba(0,0,0,0.13), 0 6px 16px -5px rgba(46,125,166,0.5)'
          : 'none',
        backdropFilter: active ? 'blur(6px) saturate(150%)' : 'none',
        WebkitBackdropFilter: active ? 'blur(6px) saturate(150%)' : 'none',
        transition: 'background 0.15s, color 0.15s, box-shadow 0.2s',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--grey-fill-3)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
}
