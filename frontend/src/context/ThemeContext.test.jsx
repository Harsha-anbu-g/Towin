import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from './ThemeContext';
import { useTheme } from './useTheme';
import { AuthContext } from './useAuth';

function Probe() {
  const { theme, toggleTheme } = useTheme();
  return <button onClick={toggleTheme}>theme:{theme}</button>;
}

// Night mode is members-only, so every case runs inside an auth context.
// `signedIn` toggles whether a user is present (elder/helper/sample) or not.
function renderThemed({ signedIn }) {
  const user = signedIn ? { userId: 'u1', role: 'ELDER' } : null;
  return render(
    <AuthContext.Provider value={{ user, login() {}, logout() {} }}>
      <ThemeProvider><Probe /></ThemeProvider>
    </AuthContext.Provider>
  );
}

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it('defaults to light with no data-theme attribute', () => {
    renderThemed({ signedIn: true });
    expect(screen.getByText('theme:light')).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it('signed-in toggle switches to dark, sets data-theme and persists', async () => {
    const user = userEvent.setup();
    renderThemed({ signedIn: true });
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('theme:dark')).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('towin-theme')).toBe('dark');
  });

  it('toggling back to light clears the attribute and stores light', async () => {
    const user = userEvent.setup();
    renderThemed({ signedIn: true });
    await user.click(screen.getByRole('button'));
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('theme:light')).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(localStorage.getItem('towin-theme')).toBe('light');
  });

  it('signed-in user with a saved dark choice starts in dark', () => {
    localStorage.setItem('towin-theme', 'dark');
    renderThemed({ signedIn: true });
    expect(screen.getByText('theme:dark')).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('signed-OUT visitor is forced to light even with a saved dark choice', () => {
    localStorage.setItem('towin-theme', 'dark');
    renderThemed({ signedIn: false });
    expect(screen.getByText('theme:light')).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it('a stray pre-paint dark attribute is cleared when signed out', () => {
    // index.html should not set this while signed out, but if it ever leaks
    // through the provider must scrub it back to light on the public pages.
    localStorage.setItem('towin-theme', 'dark');
    document.documentElement.dataset.theme = 'dark';
    renderThemed({ signedIn: false });
    expect(screen.getByText('theme:light')).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});
