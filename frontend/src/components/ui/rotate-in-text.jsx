// rotate-in-text — a one-shot 3D entrance for a fixed word (e.g. the ToWin
// wordmark). Each letter starts edge-on (rotateY -90°) a little back in depth
// and swivels forward to face the viewer, left → right, sharpening from a soft
// blur. Plays once on mount. Letters inherit the surrounding typography/colour,
// so brand fonts/colours flow through untouched — style it from the parent.
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export function RotateInText({
  text,
  className,
  letterDuration = 0.5,
  staggerDelay = 0.06,
}) {
  const letters = useMemo(() => text.split(''), [text]);

  return (
    <div className={cn('flex justify-center', className)}>
      {/* perspective sits on the direct parent of the letters so their
          rotateY/translateZ read as real depth, not a flat skew. */}
      <motion.span
        className="flex"
        style={{ perspective: '800px' }}
        initial="initial"
        animate="animate"
        variants={{ animate: { transition: { staggerChildren: staggerDelay } } }}
      >
        {letters.map((char, i) => (
          <motion.span
            key={`${char}-${i}`}
            style={{ display: 'inline-block', transformStyle: 'preserve-3d' }}
            variants={{
              initial: { rotateY: -90, z: -30, opacity: 0, filter: 'blur(5px)' },
              animate: {
                rotateY: 0,
                z: 0,
                opacity: 1,
                filter: 'blur(0px)',
                transition: { duration: letterDuration, ease: [0.2, 0.7, 0.3, 1] },
              },
            }}
          >
            {char === ' ' ? ' ' : char}
          </motion.span>
        ))}
      </motion.span>
    </div>
  );
}

export default RotateInText;
