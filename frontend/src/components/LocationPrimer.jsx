/**
 * Bumble-style permission primer: a friendly screen shown BEFORE the browser's
 * own location popup. Tapping "Enable location" is what triggers the real OS
 * prompt — warming the user up first so far more people allow it. Shown only
 * when permission hasn't been decided yet ("prompt" state).
 *
 * Props:
 *   onEnable() — trigger the real location request (and OS popup)
 *   onManual() — switch to typing a town/postcode instead
 */
export default function LocationPrimer({ onEnable, onManual }) {
  return (
    <div style={{ background: 'var(--canvas)', borderRadius: '14px', border: '1px solid var(--hairline-2)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--blue-wash)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blue-deep)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>
      <div style={{ flex: 1, minWidth: '200px' }}>
        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
          See people near you
        </p>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-slate)', lineHeight: 1.4, margin: '2px 0 0' }}>
          We only use your location to show distance — never your exact spot.
        </p>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button onClick={onEnable} className="btn-primary" style={{ height: '44px', padding: '0 18px', fontSize: 'var(--text-sm)' }}>
          Enable location
        </button>
        <button onClick={onManual} className="btn-ghost" style={{ height: '44px', padding: '0 14px', fontSize: 'var(--text-sm)' }}>
          Enter my town
        </button>
      </div>
    </div>
  );
}
