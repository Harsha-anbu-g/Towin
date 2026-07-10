import { useCallback, useState } from 'react';
import { ThemeContext } from './useTheme';

// Night mode is opt-in: light is always the default and we never follow the
// OS preference — older users shouldn't have the app change look on its own.
// The inline script in index.html applies the saved theme before first paint;
// this context just takes over ownership of the attribute after mount.
const STORAGE_KEY = 'towin-theme';
const THEME_COLOR = { light: '#4FA3CE', dark: '#201f1d' };

function applyTheme(theme) {
  if (theme === 'dark') document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;
  try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* private mode */ }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[theme]);
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  );

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
