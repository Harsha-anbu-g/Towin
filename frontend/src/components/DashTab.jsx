/* ─── Dashboard tab ───────────────────────────────────────────────────────
   The active tab is a smooth brand-blue glass pill: a soft top highlight and a
   soft outer shadow, no hard rim. (The liquid-glass refraction lens was dropped
   for the tabs — its heavy inset rim read as a dark, "hanging" bottom edge on a
   small solid-blue pill.) Inactive tabs are the plain transparent button. */

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
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
  height: '44px', padding: '0 20px',
  fontSize: '16px', letterSpacing: '-0.1px', fontWeight: 700,
  color: '#ffffff', whiteSpace: 'nowrap', fontFamily: 'inherit',
  border: 'none', cursor: 'pointer', position: 'relative',
  borderRadius: '9999px',
  background:
    'radial-gradient(120% 90% at 50% -20%, rgba(255,255,255,0.45), rgba(255,255,255,0) 60%), linear-gradient(180deg, #5FB2D8 0%, #3E8AB0 100%)',
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.5), 0 6px 16px -6px rgba(46,125,166,0.55)',
  transition: 'box-shadow 0.2s, transform 0.15s',
};

export default function DashTab({ active, onClick, children }) {
  if (active) {
    return (
      <button onClick={onClick} style={activeStyle}>
        {children}
      </button>
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
