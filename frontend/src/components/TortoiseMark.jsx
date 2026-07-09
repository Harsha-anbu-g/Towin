import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DRAW, CELLS, VIEWBOX, STROKE } from './tortoiseMarkPaths';
import { useLogoIntro } from './useLogoIntro';

/**
 * The ToWin tortoise, as vector geometry rather than a raster.
 *
 * Traced from the original artwork (assets/logos/final logo.PNG) and verified
 * against it — mean edge error 0.91px on the artwork's own 1254px canvas. The
 * left half is mirrored about x=625, so the mark is exactly symmetric.
 *
 * The parts are separate paths because the intro draws them in sequence:
 * the shell outline, the two head halves, four legs, then the seven shell
 * segments (centre hexagon, then clockwise from the top).
 *
 * `animated` primes the hidden state (paths ready to draw); `running` triggers
 * the beats. They are split so the reveal can be held one frame past the page's
 * first paint — see IntroBrandLockup — which stops the draw from stuttering
 * while the landing deck is still doing its initial layout. The CSS in index.css
 * drives all the timing, so a static mark costs nothing.
 */
export default function TortoiseMark({
  size = 160, animated = false, running = false, title, className = '', ...rest
}) {
  const cls = ['tortoise-mark', animated && 'is-drawing', running && 'is-running', className]
    .filter(Boolean).join(' ');
  return (
    <svg
      viewBox={VIEWBOX}
      width={size}
      height={size}
      className={cls}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
      {...rest}
    >
      <g fill="none" stroke="var(--logo-green)" strokeWidth={STROKE}
         strokeLinecap="round" strokeLinejoin="round">
        {DRAW.map(([id, d]) => (
          <path
            key={id}
            className={`tm-draw tm-${id}`}
            /* the heart's cleft and its bottom point are mitred in the artwork;
               a round join can't reach them (measured: 484.5 vs the ink's 488) */
            {...(id === 'shell' ? { strokeLinejoin: 'miter', strokeMiterlimit: 4 } : null)}
            /* pathLength=1 lets the dash pattern be expressed as a fraction,
               so no JS has to measure the path at runtime */
            pathLength="1"
            d={d}
          />
        ))}
        {CELLS.map(([id, d], i) => (
          <path key={id} className={`tm-cell tm-${id}`} style={{ '--i': i }} d={d} />
        ))}
      </g>
    </svg>
  );
}

/**
 * The slide-1 hero lockup — the tortoise mark and the "ToWin" wordmark as one
 * unit — wired to play the intro on the first landing view of a session.
 *
 * The gate hook is called once, here, and drives both halves: the mark draws
 * itself in, then the wordmark wipes in from the left (see the .logo-wordmark
 * rule in index.css). On every later view — and for reduced-motion visitors —
 * both render finished and static. Styling comes from the caller so the content
 * file stays the source of truth for the brand type.
 */
export function IntroBrandLockup({ wrapStyle, wordStyle, size = 104, gap = 16, markClassName = 'tortoise-lit' }) {
  const play = useLogoIntro();
  const wordRef = useRef(null);
  const [shift, setShift] = useState(0);
  const [running, setRunning] = useState(false);

  // While it draws, the tortoise sits centred over the whole lockup; when
  // "ToWin" arrives it slides back left into place, so the wordmark reads as
  // pushing it aside. The slide distance is half of (gap + wordmark width) —
  // measured, so it stays exact at any mark size or rendered text width.
  useLayoutEffect(() => {
    if (!play || !wordRef.current) return;
    setShift((gap + wordRef.current.getBoundingClientRect().width) / 2);
  }, [play, gap]);

  // Hold the beats until the page has painted once. The landing deck's initial
  // layout/paint is the heaviest main-thread moment; starting the draw into it
  // is what made it stutter. Two rAFs guarantee a clean first frame, then run.
  useEffect(() => {
    if (!play) return undefined;
    let f2 = 0;
    const f1 = requestAnimationFrame(() => { f2 = requestAnimationFrame(() => setRunning(true)); });
    return () => { cancelAnimationFrame(f1); cancelAnimationFrame(f2); };
  }, [play]);

  return (
    <div style={{ ...wrapStyle, gap: `${gap}px` }}>
      <TortoiseMark
        className={`${markClassName}${play ? ' logo-mark--intro' : ''}`}
        size={size}
        animated={play}
        running={running}
        title="ToWin tortoise logo"
        style={{ objectFit: 'contain', ...(play ? { '--intro-shift': `${shift}px` } : null) }}
      />
      <span
        ref={wordRef}
        className={play ? `logo-wordmark${running ? ' is-writing' : ''}` : undefined}
        style={wordStyle}
      >
        ToWin
      </span>
    </div>
  );
}
