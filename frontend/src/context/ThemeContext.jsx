import { useCallback, useEffect, useState } from 'react';
import { ThemeContext } from './useTheme';
import { useAuth } from './useAuth';

// Night mode is opt-in AND members-only: it only takes effect once you're
// signed in (elder, helper or a sample account). Signed-out visitors — the
// landing, login and create-account pages — always see light, no matter what
// choice is saved. The choice is remembered and restored the moment they log
// back in. We never follow the OS preference: older users shouldn't have the
// app change look on its own. The inline script in index.html mirrors this
// (dark before first paint only when a token is present) to avoid a flash.
const STORAGE_KEY = 'towin-theme';
const THEME_COLOR = { light: '#4FA3CE', dark: '#201f1d' };

function readSavedPreference() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light'; // private mode / storage blocked
  }
}

// Paint the given theme onto the document (attribute + browser UI colour).
function paintTheme(theme) {
  if (theme === 'dark') document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[theme]);
}

export function ThemeProvider({ children }) {
  // `?.` keeps this safe if ever rendered without an AuthProvider (e.g. tests
  // or a stray mount) — no auth means signed-out means light.
  const auth = useAuth();
  const isSignedIn = Boolean(auth?.user);

  // The saved preference persists across sessions; the *effective* theme is
  // that preference gated by sign-in. Signed out always resolves to light.
  const [preference, setPreference] = useState(readSavedPreference);
  const effective = isSignedIn && preference === 'dark' ? 'dark' : 'light';

  // Keep the DOM in sync whenever the effective theme changes — this is what
  // blocks dark mode on the public pages (sign out → light) and restores it on
  // sign-in, as well as reflecting a manual toggle.
  useEffect(() => { paintTheme(effective); }, [effective]);

  const toggleTheme = useCallback(() => {
    setPreference(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(STORAGE_KEY, next); } catch { /* private mode */ }
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: effective, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
