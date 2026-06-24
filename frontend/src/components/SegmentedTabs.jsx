// Segmented sub-navigation for the dashboard tabs. Splits a single mixed list
// into status-based segments so people see only what's relevant, with a count
// on each segment. Pure presentation — the parent owns the active value.
//
// Visual spec — a light underline tab strip, deliberately a level quieter than
// the solid filled section tabs above it. This makes the navigation read as a
// clear hierarchy (global nav → solid section tabs → these flat sub-filters)
// instead of three stacked rows competing for the same weight:
//   strip:     flex row on a hairline rail (#ececef bottom border), 4px gap
//   segment:   flex:1, height 44. active = bold accent text + 3px accent
//              underline; inactive = #7a7a7a, no underline
//   badge:     shown ONLY when a segment opts in with notify:true and has
//              count > 0 — so status tabs (Active, Building Trust, In
//              Progress, Completed) stay quiet, and only actionable ones
//              (New Invites, Pending Request) draw the eye.
// A segment may pass its own `color` to tint the active label + underline.

export default function SegmentedTabs({ segments, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #ececef' }}>
      {segments.map(seg => {
        const active = value === seg.id;
        const accent = seg.color || '#4FA3CE';
        const textColor = active ? accent : '#7a7a7a';
        return (
          <button
            key={seg.id}
            type="button"
            onClick={() => onChange(seg.id)}
            className="seg-tab"
            style={{
              flex: 1, minWidth: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              height: '44px', padding: '0 10px',
              border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
              fontWeight: active ? 700 : 600,
              color: textColor,
              borderBottom: active ? `3px solid ${accent}` : '3px solid transparent',
              marginBottom: '-1px',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seg.label}</span>
            {seg.notify && seg.count > 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: '22px', height: '22px', padding: '0 7px', boxSizing: 'border-box',
                borderRadius: '9999px', fontSize: 'var(--text-xs)', fontWeight: 700, lineHeight: 1, flexShrink: 0,
                color: active ? '#ffffff' : '#9aa4af',
                background: active ? '#4FA3CE' : '#e6e8ec',
              }}>{seg.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Friendly per-segment empty state — shown when the active segment has no cards.
export function SegmentEmpty({ icon, children }) {
  return (
    <div style={{ background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: '18px', padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'var(--blue-wash)', margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <p style={{ fontSize: '16px', color: 'var(--ink-slate)', lineHeight: 1.6, maxWidth: '380px', margin: '0 auto' }}>{children}</p>
    </div>
  );
}
