import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

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
    // Role and userId come from the signed JWT — not from writable localStorage
    return { token, role: payload.role, userId: payload.sub };
  });

  const login = (token) => {
    const payload = parseJwtPayload(token);
    if (!payload) return;
    localStorage.setItem('token', token);
    // Only the token is persisted; role/userId are always derived from it
    setUser({ token, role: payload.role, userId: payload.sub });
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
