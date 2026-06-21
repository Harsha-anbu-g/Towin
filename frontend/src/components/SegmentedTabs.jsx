// Segmented sub-navigation for the dashboard tabs. Splits a single mixed list
// into status-based segments so people see only what's relevant, with a count
// on each segment. Pure presentation — the parent owns the active value.
//
// Visual spec — matches the login / create-account switcher so these sub-tabs
// read as a segmented control, clearly distinct from the heading tabs above:
//   container: #eef1f4 fully-rounded pill, padding 5, flex with 6px gap
//   segment:   flex:1, height 46, fully rounded. active = white + soft shadow +
//              bold #4FA3CE; inactive = transparent + #7a7a7a
//   count:     active = white on #4FA3CE; inactive = #9aa4af on #e6e8ec
// A segment may pass its own `color` to tint the label.

export default function SegmentedTabs({ segments, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '6px', background: '#eef1f4', borderRadius: '9999px', padding: '5px' }}>
      {segments.map(seg => {
        const active = value === seg.id;
        const textColor = seg.color || (active ? '#4FA3CE' : '#7a7a7a');
        return (
          <button
            key={seg.id}
            type="button"
            onClick={() => onChange(seg.id)}
            className="seg-tab"
            style={{
              flex: 1, minWidth: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              height: '46px', padding: '0 10px',
              border: 'none', borderRadius: '9999px', cursor: 'pointer', fontFamily: 'inherit',
              fontWeight: active ? 700 : 600,
              color: textColor,
              background: active ? '#ffffff' : 'transparent',
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seg.label}</span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              minWidth: '22px', height: '22px', padding: '0 7px', boxSizing: 'border-box',
              borderRadius: '9999px', fontSize: '12px', fontWeight: 700, lineHeight: 1, flexShrink: 0,
              color: active ? '#ffffff' : '#9aa4af',
              background: active ? '#4FA3CE' : '#e6e8ec',
            }}>{seg.count}</span>
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
      <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#EAF5FB', margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <p style={{ fontSize: '15px', color: '#5a6470', lineHeight: 1.6, maxWidth: '380px', margin: '0 auto' }}>{children}</p>
    </div>
  );
}
