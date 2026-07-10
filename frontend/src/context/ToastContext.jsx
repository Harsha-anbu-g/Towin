import { useCallback, useRef, useState } from 'react';
import { ToastContext } from './useToast';

const ICONS = {
  success: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="7" fill="#4FA3CE"/>
      <path d="M3.5 7L5.8 9.3L10.5 4.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  error: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="7" fill="#ff3b30"/>
      <path d="M4.5 4.5L9.5 9.5M9.5 4.5L4.5 9.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  info: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="7" fill="#4FA3CE"/>
      <path d="M7 6.5V10M7 4.5V5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  warn: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1.5L13 12.5H1L7 1.5Z" fill="#ff9500" stroke="#ff9500" strokeWidth="0.5" strokeLinejoin="round"/>
      <path d="M7 5.5V8.5M7 10V10.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
};

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 320);
  }, []);

  const addToast = useCallback((type, message, opts = {}) => {
    const id = ++idCounter;
    setToasts(prev => [...prev.slice(-2), { id, type, message, exiting: false, undo: opts.undo }]);
    const delay = opts.duration ?? 4000;
    timers.current[id] = setTimeout(() => dismiss(id), delay);
    return id;
  }, [dismiss]);

  const toast = {
    success: (msg, opts) => addToast('success', msg, opts),
    error:   (msg, opts) => addToast('error',   msg, { duration: 6000, ...opts }),
    info:    (msg, opts) => addToast('info',     msg, opts),
    warn:    (msg, opts) => addToast('warn',     msg, opts),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastStack toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastStack({ toasts, dismiss }) {
  if (!toasts.length) return null;
  return (
    <div style={{
      position: 'fixed', bottom: '28px', left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: '8px',
      alignItems: 'center', pointerEvents: 'none',
    }}>
      {toasts.map(t => <ToastItem key={t.id} toast={t} dismiss={dismiss} />)}
    </div>
  );
}

function ToastItem({ toast: t, dismiss }) {
  return (
    <div style={{
      pointerEvents: 'all',
      display: 'flex', alignItems: 'center', gap: '10px',
      background: '#1d1d1f',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '9999px',
      padding: '10px 16px 10px 12px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.2)',
      minWidth: '240px', maxWidth: '380px',
      animation: t.exiting
        ? 'toastOut 0.3s cubic-bezier(0.4,0,1,1) forwards'
        : 'toastIn 0.35s cubic-bezier(0,0,0.2,1) forwards',
      willChange: 'transform, opacity',
    }}>
      <span style={{ flexShrink: 0 }}>{ICONS[t.type]}</span>
      <span style={{
        flex: 1, fontSize: '14px', fontWeight: 400, color: '#f5f5f7',
        fontFamily: `-apple-system, 'SF Pro Text', system-ui, sans-serif`,
        letterSpacing: '-0.2px', lineHeight: 1.4,
      }}>{t.message}</span>
      {t.undo && (
        <button onClick={() => { t.undo(); dismiss(t.id); }} style={{
          fontSize: '13px', fontWeight: 600, color: '#4FA3CE',
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: `-apple-system, 'SF Pro Text', system-ui, sans-serif`,
          padding: '0 4px', flexShrink: 0,
        }}>Undo</button>
      )}
      <button onClick={() => dismiss(t.id)} style={{
        width: '18px', height: '18px', borderRadius: '50%',
        background: 'rgba(255,255,255,0.12)',
        border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
          <path d="M1.5 1.5L6.5 6.5M6.5 1.5L1.5 6.5" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      </button>
      <style>{`
        @keyframes toastIn  { from { opacity:0; transform:translateY(16px) scale(0.95) } to { opacity:1; transform:translateY(0) scale(1) } }
        @keyframes toastOut { from { opacity:1; transform:scale(1) } to { opacity:0; transform:scale(0.9) } }
      `}</style>
    </div>
  );
}

