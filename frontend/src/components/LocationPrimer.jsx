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
    <div style={{ background: '#ffffff', borderRadius: '18px', border: '1px solid #e0e0e0', padding: '32px 24px', textAlign: 'center' }}>
      <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--blue-wash)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2E7DA6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>
      <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 6px' }}>
        See people near you
      </p>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)', lineHeight: 1.5, maxWidth: '320px', margin: '0 auto 20px' }}>
        Turn on location so we can show elders and helpers close to you. We only use it to show distance — never your exact spot.
      </p>
      <button onClick={onEnable} className="btn-primary" style={{ padding: '12px 28px', fontSize: '16px' }}>
        Enable location
      </button>
      <div>
        <button onClick={onManual} className="btn-ghost" style={{ marginTop: '12px', fontSize: 'var(--text-sm)' }}>
          Enter my town instead
        </button>
      </div>
    </div>
  );
}
