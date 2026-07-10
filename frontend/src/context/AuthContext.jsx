import { useState } from 'react';
import posthog from 'posthog-js';
import { AuthContext } from './useAuth';

function parseJwtPayload(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const payload = parseJwtPayload(token);
    if (!payload) return null;
    // An expired token would 401/403 on every call and render broken,
    // empty pages — treat it as logged out from the start
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem('token');
      return null;
    }
    // Role, userId and emailVerified come from the signed JWT — not from
    // writable localStorage. Absent `ev` (old/grandfathered tokens) = verified.
    return { token, role: payload.role, userId: payload.sub, emailVerified: payload.ev !== false };
  });

  const login = (token) => {
    const payload = parseJwtPayload(token);
    if (!payload) return;
    localStorage.setItem('token', token);
    // Only the token is persisted; the rest is always derived from it
    setUser({ token, role: payload.role, userId: payload.sub, emailVerified: payload.ev !== false });
    // Tie analytics events to this user (matches the backend distinct_id).
    posthog.identify(payload.sub, { role: payload.role });
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    posthog.reset();
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
