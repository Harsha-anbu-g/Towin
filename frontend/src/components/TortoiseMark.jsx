import { useLayoutEffect, useRef, useState } from 'react';
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
 * `animated` only tags the root with a class — LogoIntro's stylesheet drives
 * the timing, so a static mark costs nothing.
 */
export default function TortoiseMark({ size = 160, animated = false, title, className = '', ...rest }) {
  return (
    <svg
      viewBox={VIEWBOX}
      width={size}
      height={size}
      className={`tortoise-mark${animated ? ' is-drawing' : ''}${className ? ` ${className}` : ''}`}
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
export function IntroBrandLockup({ wrapStyle, wordStyle, size = 62, gap = 13, markClassName = 'tortoise-lit' }) {
  const play = useLogoIntro();
  const wordRef = useRef(null);
  const [shift, setShift] = useState(0);

  // While it draws, the tortoise sits centred over the whole lockup; when
  // "ToWin" arrives it slides back left into place, so the wordmark reads as
  // pushing it aside. The slide distance is half of (gap + wordmark width) —
  // measured, so it stays exact whatever the rendered text width is.
  useLayoutEffect(() => {
    if (!play || !wordRef.current) return;
    setShift((gap + wordRef.current.getBoundingClientRect().width) / 2);
  }, [play, gap]);

  return (
    <div style={{ ...wrapStyle, gap: `${gap}px` }}>
      <TortoiseMark
        className={`${markClassName}${play ? ' logo-mark--intro' : ''}`}
        size={size}
        animated={play}
        title="ToWin tortoise logo"
        style={{ objectFit: 'contain', ...(play ? { '--intro-shift': `${shift}px` } : null) }}
      />
      <span ref={wordRef} className={play ? 'logo-wordmark is-writing' : undefined} style={wordStyle}>
        ToWin
      </span>
    </div>
  );
}
