// Segmented sub-navigation for the dashboard tabs. Splits a single mixed list
// into status-based segments so people see only what's relevant, with a count
// on each segment. Pure presentation — the parent owns the active value.
//
// Visual spec — a light underline tab strip, deliberately a level quieter than
// the solid filled section tabs above it. This makes the navigation read as a
// clear hierarchy (global nav → solid section tabs → these flat sub-filters)
// instead of three stacked rows competing for the same weight:
//   strip:     flex row on a hairline rail (var(--rail-line) bottom border), 4px gap
//   segment:   flex:1, height 44. active = bold ink label + 3px accent
//              underline (the label stays ink for contrast; the accent lives
//              in the underline); inactive = var(--ink-slate), no underline
//   badge:     shown ONLY when a segment opts in with notify:true and has
//              count > 0 — so status tabs (Active, Building Trust, In
//              Progress, Completed) stay quiet, and only actionable ones
//              (New Invites, Pending Request) draw the eye.
// A segment may pass its own `color` to tint the active underline.
//
// Semantics: a real tab strip (tablist/tab/aria-selected) with roving focus —
// Left/Right/Home/End move between segments for keyboard users.

export default function SegmentedTabs({ segments, value, onChange, label = 'Filter' }) {
  const onKeyDown = (e) => {
    const ids = segments.map(s => s.id);
    const i = ids.indexOf(value);
    let next = null;
    if (e.key === 'ArrowRight') next = ids[(i + 1) % ids.length];
    else if (e.key === 'ArrowLeft') next = ids[(i - 1 + ids.length) % ids.length];
    else if (e.key === 'Home') next = ids[0];
    else if (e.key === 'End') next = ids[ids.length - 1];
    if (next != null) {
      e.preventDefault();
      onChange(next);
      e.currentTarget.closest('[role="tablist"]')?.querySelector(`[data-seg="${next}"]`)?.focus();
    }
  };
  return (
    <div role="tablist" aria-label={label} style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--rail-line)' }}>
      {segments.map(seg => {
        const active = value === seg.id;
        const accent = seg.color || 'var(--blue)';
        return (
          <button
            key={seg.id}
            type="button"
            role="tab"
            data-seg={seg.id}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            aria-label={seg.notify && seg.count > 0 ? `${seg.label}, ${seg.count} waiting` : undefined}
            onClick={() => onChange(seg.id)}
            onKeyDown={onKeyDown}
            className="seg-tab"
            style={{
              flex: 1, minWidth: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              height: '44px', padding: '0 10px',
              border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
              fontWeight: active ? 700 : 600,
              color: active ? 'var(--ink)' : 'var(--ink-slate)',
              borderBottom: active ? `3px solid ${accent}` : '3px solid transparent',
              marginBottom: '-1px',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seg.label}</span>
            {seg.notify && seg.count > 0 && (
              <span aria-hidden="true" style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: '22px', height: '22px', padding: '0 7px', boxSizing: 'border-box',
                borderRadius: '9999px', fontSize: 'var(--text-xs)', fontWeight: 700, lineHeight: 1, flexShrink: 0,
                color: 'var(--action-ink)',
                background: 'var(--action-fill)',
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
    <div style={{ background: 'var(--canvas)', border: '1px solid var(--hairline-2)', borderRadius: '18px', padding: '40px 24px', textAlign: 'center' }}>
      <div aria-hidden="true" style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'var(--blue-wash)', margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <p style={{ fontSize: '16px', color: 'var(--ink-slate)', lineHeight: 1.6, maxWidth: '380px', margin: '0 auto' }}>{children}</p>
    </div>
  );
}
