import { LiquidButton } from './ui/liquid-glass-button';

/* ─── Dashboard tab ───────────────────────────────────────────────────────
   The active tab is rendered with the CSS/SVG LiquidButton (glass rim clipped
   to its own bounds — no lens bleed). It keeps ToWin's brand-blue selected
   look on top of that glass edge. Inactive tabs are the plain transparent
   button. This replaces the old liquid-glass-react GlassTab, whose refraction
   lens leaked a grey blob outside the tab. */

const inactiveStyle = {
  flex: '1 1 auto',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
  height: '44px', padding: '0 16px',
  fontSize: '16px', letterSpacing: '-0.1px',
  borderRadius: '12px',
  cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
  position: 'relative',
  fontWeight: 600,
  color: '#5a6470',
  background: 'transparent',
  border: '1px solid transparent',
  transition: 'background 0.15s, color 0.15s',
};

const activeStyle = {
  flex: '1 1 auto',
  height: '44px', padding: '0 18px',
  fontSize: '16px', letterSpacing: '-0.1px', fontWeight: 700,
  color: '#ffffff', whiteSpace: 'nowrap', fontFamily: 'inherit',
  borderRadius: '9999px',
  background:
    'radial-gradient(125% 85% at 50% -10%, rgba(255,255,255,0.55), rgba(255,255,255,0) 55%), linear-gradient(180deg, #5FB2D8 0%, #3E8AB0 100%)',
};

export default function DashTab({ active, onClick, children }) {
  if (active) {
    return (
      <LiquidButton onClick={onClick} size="default" style={activeStyle}>
        {children}
      </LiquidButton>
    );
  }

  return (
    <button
      onClick={onClick}
      style={inactiveStyle}
      onMouseEnter={e => { e.currentTarget.style.background = '#f0f0f3'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
}
