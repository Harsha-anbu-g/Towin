import { createContext, useContext } from 'react';

// The context object and hook live here (not in ThemeContext.jsx) so the
// provider file exports only a component — mixed exports break Fast Refresh
// (react-refresh/only-export-components).
export const ThemeContext = createContext({ theme: 'light', toggleTheme: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}
