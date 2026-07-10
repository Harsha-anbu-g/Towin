import { createContext, useContext } from 'react';

// The context object and hook live here (not in AuthContext.jsx) so the
// provider file exports only a component — mixed exports break Fast Refresh
// (react-refresh/only-export-components).
export const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);
