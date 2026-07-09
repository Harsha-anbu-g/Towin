import { useEffect, useState } from 'react';

const SEEN_KEY = 'towin:intro-seen';

function shouldPlay() {
  if (typeof window === 'undefined') return false;
  // Reduced motion isn't "skip the intro" — it's a health setting. Those
  // visitors get the finished mark, drawn instantly, and we don't even burn
  // the once-per-session flag (so turning the setting off still shows it).
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  try {
    return !sessionStorage.getItem(SEEN_KEY);
  } catch {
    return true; // private mode / storage disabled — play it, don't crash
  }
}

/**
 * True only on the first landing view of a session. The tortoise mark that
 * already sits in the top bar uses this to draw itself in, once, on open —
 * in place, over nothing. Everything else on the page stays exactly put.
 *
 * The visit is marked seen on mount (before the draw finishes), so a reload
 * part-way through the animation doesn't replay it.
 */
export function useLogoIntro() {
  const [play] = useState(shouldPlay);
  useEffect(() => {
    if (!play) return;
    try {
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* storage disabled — it just plays again next navigation */
    }
  }, [play]);
  return play;
}
