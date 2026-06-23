import { useEffect, useRef } from 'react';

const SFD = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFT = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

/**
 * One shared confirmation dialog for the whole app.
 *
 * Covers several usability heuristics in one place:
 *  - Error prevention (H5): confirm before a consequential action.
 *  - User control & freedom (H3): Cancel button, backdrop click, and Esc all back out.
 *  - Consistency & standards (H4): every confirm in ToWin looks and behaves the same.
 *  - Flexibility & efficiency (H7): Esc to cancel, Enter to confirm for keyboard users.
 *
 * Controlled component — render it with `open` and handle `onConfirm` / `onCancel`.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}) {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    // Move focus to the confirm button so keyboard users land in the dialog.
    confirmRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); if (!loading) onCancel?.(); }
      if (e.key === 'Enter')  { e.preventDefault(); if (!loading) onConfirm?.(); }
    };
    window.addEventListener('keydown', onKey);
    // Lock background scroll while the dialog is up.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, loading, onConfirm, onCancel]);

  if (!open) return null;

  const accent = danger ? '#9b3535' : '#4FA3CE';

  return (
    <div
      onClick={() => { if (!loading) onCancel?.(); }}
      role="presentation"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(20,55,80,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        animation: 'confirmFade 0.15s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        style={{
          background: '#ffffff', borderRadius: '18px',
          maxWidth: '380px', width: '100%',
          boxShadow: '0 20px 60px rgba(20,55,80,0.25)',
          fontFamily: SFT, overflow: 'hidden',
          animation: 'confirmPop 0.18s cubic-bezier(0,0,0.2,1)',
        }}
      >
        <div style={{ padding: '26px 26px 20px' }}>
          <h3 id="confirm-title" style={{
            margin: '0 0 8px', fontSize: '20px', fontWeight: 600,
            color: 'var(--ink)', fontFamily: SFD, letterSpacing: '-0.3px',
          }}>
            {title}
          </h3>
          {message && (
            <p style={{ margin: 0, fontSize: '16px', color: '#5a6b75', lineHeight: 1.5 }}>
              {message}
            </p>
          )}
        </div>
        <div style={{
          display: 'flex', gap: '10px',
          padding: '0 26px 24px',
        }}>
          <button
            onClick={() => { if (!loading) onCancel?.(); }}
            disabled={loading}
            style={{
              flex: 1, height: '44px',
              background: '#ffffff', color: 'var(--ink-slate)',
              border: '1.5px solid #e0e0e0', borderRadius: '9999px',
              fontSize: '16px', fontWeight: 600, fontFamily: SFT,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={() => { if (!loading) onConfirm?.(); }}
            disabled={loading}
            style={{
              flex: 1, height: '44px',
              background: accent, color: '#ffffff',
              border: 'none', borderRadius: '9999px',
              fontSize: '16px', fontWeight: 600, fontFamily: SFT,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes confirmFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes confirmPop  { from { opacity: 0; transform: scale(0.96) translateY(8px) } to { opacity: 1; transform: none } }
      `}</style>
    </div>
  );
}
