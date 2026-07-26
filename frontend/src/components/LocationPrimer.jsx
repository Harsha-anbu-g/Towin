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
    <div style={{ background: 'var(--canvas)', borderRadius: '18px', border: '1px solid var(--hairline-2)', padding: '18px 20px', textAlign: 'center' }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--blue-wash)', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--blue-deep)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>
      <p style={{ fontSize: '17px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 4px' }}>
        See people near you
      </p>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-slate)', lineHeight: 1.5, maxWidth: '380px', margin: '0 auto 14px' }}>
        Turn on location so we can show elders and helpers close to you. We only use it to show distance — never your exact spot.
      </p>
      <button onClick={onEnable} className="btn-primary" style={{ padding: '12px 24px', fontSize: '16px' }}>
        Enable location
      </button>
      <div>
        <button onClick={onManual} className="btn-ghost" style={{ marginTop: '6px', fontSize: 'var(--text-sm)' }}>
          Enter my town instead
        </button>
      </div>
    </div>
  );
}
