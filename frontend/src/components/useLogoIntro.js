import { useState } from 'react';

/**
 * True on every landing view — the tortoise mark plays its intro each time the
 * page mounts. There is deliberately NO once-per-session gate: the user wants
 * the animation every time they come to the landing page.
 *
 * The one exception is prefers-reduced-motion: those visitors get the finished
 * mark, static, with no draw.
 */
export function useLogoIntro() {
  const [play] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  });
  return play;
}
