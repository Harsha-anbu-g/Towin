/**
 * Shown when the browser has BLOCKED location for this site (permission denied) —
 * as opposed to GPS merely failing to get a fix. Makes clear it's a permission
 * setting, not a broken app, and shows how to turn it back on, then lets the user
 * retry GPS or fall back to typing a town. Shared by the Elder and Helper dashboards.
 *
 * Props:
 *   onRetry  — re-attempt GPS (i.e. call requestLocation again)
 *   onManual — switch to the type-your-town fallback
 */
export default function LocationBlocked({ onRetry, onManual }) {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const steps = isIOS
    ? 'tap "aA" in the address bar → Website Settings → Location → Allow, then reload.'
    : isAndroid
      ? 'tap the lock icon in the address bar → Permissions → Location → Allow, then reload.'
      : 'click the lock icon in the address bar → Site settings → Location → Allow, then reload.';

  return (
    <div style={{ background: 'var(--canvas)', borderRadius: '14px', padding: '16px', border: '1px solid var(--hairline-2)' }}>
      <p style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--ink-slate-dark)', margin: '0 0 6px' }}>
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /><line x1="3" y1="3" x2="21" y2="21" />
        </svg>
        Location is turned off for this site
      </p>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-slate)', margin: '0 0 12px', lineHeight: 1.5 }}>
        To see people near you, turn location back on: {steps}
      </p>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button type="button" onClick={onRetry} className="btn-primary" style={{ padding: '0 22px', height: '40px', fontSize: 'var(--text-sm)', whiteSpace: 'nowrap' }}>
          Try again
        </button>
        <button type="button" onClick={onManual} style={{ padding: '0 22px', height: '40px', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--blue-deep)', background: 'transparent', border: '1px solid var(--blue-soft)', borderRadius: '9999px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          Enter my town instead
        </button>
      </div>
    </div>
  );
}
