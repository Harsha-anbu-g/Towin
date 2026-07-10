import { useEffect, useState } from 'react';
import TortoiseMark from './TortoiseMark';

const SEEN_KEY = 'towin:intro-seen';
const RUN_MS = 3000;   // the five beats
const FADE_MS = 400;   // hold, then lift

/** Someone who has already watched it this visit shouldn't watch it again, and
 *  reduced-motion users shouldn't watch it at all. Checked before the first
 *  paint so the overlay never flashes. */
function shouldPlay() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  try {
    return !sessionStorage.getItem(SEEN_KEY);
  } catch {
    return true; // private mode / storage disabled — play it, don't crash
  }
}

/**
 * The mark drawing itself, once, over the landing page.
 *
 * Deliberately NOT skippable: no click, key, scroll or touch cancels it. The
 * one exception is prefers-reduced-motion, which isn't a user skipping the
 * intro — it's an accessibility setting, and those people get the finished
 * logo with no draw. Note that index.css has a global reduced-motion killswitch
 * (`animation-duration: 0.01ms !important`) that would otherwise cram all five
 * beats into a single frame; checking the media query here and never mounting
 * avoids that flash entirely.
 */
export default function LogoIntro() {
  const [phase, setPhase] = useState(() => (shouldPlay() ? 'running' : 'done'));

  useEffect(() => {
    if (phase !== 'running') return undefined;
    // Marked seen BEFORE the animation, not after: a reload part-way through
    // shouldn't start it over.
    try {
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch { /* storage disabled — it just replays next navigation */ }
    const t = setTimeout(() => setPhase('leaving'), RUN_MS);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'leaving') return undefined;
    const t = setTimeout(() => setPhase('done'), FADE_MS);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === 'done') return null;

  return (
    <div className={`logo-intro${phase === 'leaving' ? ' is-leaving' : ''}`} aria-hidden="true">
      <div className="logo-intro-stack">
        {/* the disc keeps the mark's dark green legible on the night canvas,
            the same trick .tortoise-lit plays for the PNG */}
        <span className="logo-intro-bed">
          <TortoiseMark size={168} animated />
        </span>
        <span className="logo-intro-word">ToWin</span>
      </div>
    </div>
  );
}
