import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from './ThemeContext';
import { useTheme } from './useTheme';

function Probe() {
  const { theme, toggleTheme } = useTheme();
  return <button onClick={toggleTheme}>theme:{theme}</button>;
}

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it('defaults to light with no data-theme attribute', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByText('theme:light')).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it('toggle switches to dark, sets data-theme and persists', async () => {
    const user = userEvent.setup();
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('theme:dark')).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('towin-theme')).toBe('dark');
  });

  it('toggling back to light clears the attribute and stores light', async () => {
    const user = userEvent.setup();
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await user.click(screen.getByRole('button'));
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('theme:light')).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(localStorage.getItem('towin-theme')).toBe('light');
  });

  it('picks up dark set pre-paint (index.html script) on mount', () => {
    document.documentElement.dataset.theme = 'dark';
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByText('theme:dark')).toBeInTheDocument();
  });
});
