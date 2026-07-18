import { useState } from 'react';
import api from '../api/axios';
import { useToast } from '../context/useToast';

const SFT = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

/* Motion rule: <300ms, custom curve, transform/opacity only (the knob slides
   with translateX; the track color swap is a non-animated paint).
   prefers-reduced-motion → gentler (shorter), not zero. */
const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';

/**
 * US-011 — the elder's per-friendship family visibility switch.
 * Rendered ONLY on the elder's side of a connection (ElderDashboard card);
 * helpers never get this control. Default off (kept private).
 */
export default function FamilyShareToggle({ connectionId, shared: initialShared = false }) {
  const { toast } = useToast();
  const [shared, setShared] = useState(Boolean(initialShared));
  const [saving, setSaving] = useState(false);

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const knobTransition = `transform ${reduceMotion ? 60 : 160}ms ${EASE}`;

  const flip = async () => {
    if (saving) return;
    const next = !shared;
    setShared(next); // optimistic — rolled back on failure
    setSaving(true);
    try {
      await api.post(`/connections/${connectionId}/family-visibility`, { shared: next });
    } catch {
      setShared(!next);
      toast.error("Couldn't save that change. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={shared}
      aria-label="Let my family see this friendship"
      onClick={flip}
      disabled={saving}
      style={{
        display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between',
        gap: '12px', minHeight: '44px', marginTop: '12px', padding: '10px 12px',
        background: 'none', border: '1px solid var(--sky-line-2)', borderRadius: '12px',
        cursor: saving ? 'wait' : 'pointer', fontFamily: SFT, textAlign: 'left',
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '16px', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35 }}>
          Let my family see this friendship
        </span>
        <span style={{ display: 'block', fontSize: '14px', color: 'var(--ink-slate)', lineHeight: 1.4, marginTop: '2px' }}>
          {shared
            ? 'Your family can see this friendship.'
            : 'Kept private from family. Only you can change this.'}
        </span>
      </span>
      {/* Track + knob — same geometry as the NavBar night-mode switch. */}
      <span aria-hidden="true" style={{
        display: 'inline-flex', alignItems: 'center', flexShrink: 0,
        width: 40, height: 24, padding: 3, borderRadius: 9999, boxSizing: 'content-box',
        background: shared ? 'var(--blue)' : 'var(--slate-soft)',
      }}>
        <span style={{
          width: 18, height: 18, borderRadius: '50%', background: 'var(--canvas)',
          transform: shared ? 'translateX(16px)' : 'translateX(0)',
          transition: knobTransition,
        }} />
      </span>
    </button>
  );
}
