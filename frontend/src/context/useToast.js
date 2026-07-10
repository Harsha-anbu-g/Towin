import { createContext, useContext } from 'react';

// The context object and hook live here (not in ToastContext.jsx) so the
// provider file exports only a component — mixed exports break Fast Refresh
// (react-refresh/only-export-components).
export const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
