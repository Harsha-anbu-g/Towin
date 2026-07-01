import { LiquidButton } from './ui/liquid-glass-button';

/* ─── Dashboard tab ───────────────────────────────────────────────────────
   The active tab is a translucent "liquid glass" pill (LiquidButton): a
   frosted, refracting glass edge with no colour fill, so page content shows
   softly through it. Label + icon are dark ink so they stay readable on the
   clear glass. Inactive tabs are the plain transparent button. */

const inactiveStyle = {
  flex: '1 1 auto',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
  height: '44px', padding: '0 16px',
  fontSize: '16px', letterSpacing: '-0.1px',
  borderRadius: '9999px',
  cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
  position: 'relative',
  fontWeight: 600,
  color: '#5a6470',
  background: 'transparent',
  border: 'none',
  transition: 'background 0.15s, color 0.15s',
};

const activeStyle = {
  flex: '1 1 auto',
  height: '44px', padding: '0 20px',
  fontSize: '16px', letterSpacing: '-0.1px', fontWeight: 700,
  color: '#1f2937', whiteSpace: 'nowrap', fontFamily: 'inherit',
  borderRadius: '9999px',
  background: 'transparent',
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
