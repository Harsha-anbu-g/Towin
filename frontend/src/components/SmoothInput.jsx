import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'framer-motion';
import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';

// Capitalized alias so the JSX usage counts (project ESLint has no jsx-uses-vars).
const MotionSpan = motion.span;

// Types where a single-line horizontal caret makes sense. Note: `email` is
// intentionally excluded — email/number/date inputs return null for
// selectionStart/selectionEnd (no text-selection API), so the caret index can't
// be tracked; those fall back to the native caret. text/tel/url/search/password
// all support selection.
const SMOOTH_TYPES = new Set(['text', 'password', 'tel', 'url', 'search']);
const SPRING = { stiffness: 500, damping: 30, mass: 0.5 };

// Firefox masks passwords with a slightly different bullet glyph.
const PASSWORD_CHAR =
  typeof navigator !== 'undefined' && /firefox|fxios/i.test(navigator.userAgent)
    ? '●'
    : '•';

const SmoothInput = forwardRef(function SmoothInput(
  {
    type = 'text',
    className,
    style,
    wrapperStyle, // for inputs that are flex/grid children (e.g. flex:1 in a row)
    value,
    defaultValue,
    onChange,
    onBlur,
    caretColor = 'var(--blue)',
    ...props
  },
  forwardedRef,
) {
  const prefersReducedMotion = useReducedMotion();
  const smooth = SMOOTH_TYPES.has(type) && !prefersReducedMotion;

  const [internalValue, setInternalValue] = useState(defaultValue ?? '');
  const [caretHeight, setCaretHeight] = useState(18);

  const caretX = useMotionValue(0);
  const caretOpacity = useMotionValue(0);
  const springCaretX = useSpring(caretX, SPRING);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const measureRef = useRef(null);
  const prevValueRef = useRef('');

  const isControlled = value !== undefined;
  const inputValue = isControlled ? value : internalValue;

  const setRefs = useCallback(
    (node) => {
      inputRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );

  const getCaretIndex = (target) => {
    const start = target.selectionStart ?? 0;
    const end = target.selectionEnd ?? 0;
    if (start === end) return start;
    return target.selectionDirection === 'backward' ? start : end;
  };

  // Position the caret. Reads getComputedStyle ONCE and reuses it, and inlines
  // what used to be three helpers — this avoids the layout thrashing (~4
  // getComputedStyle calls) that made fast typing lag.
  const updateCaretFromInput = (target) => {
    const span = measureRef.current;
    if (!target || !span) return;
    const cs = window.getComputedStyle(target);

    const start = target.selectionStart ?? 0;
    const end = target.selectionEnd ?? 0;
    const hasSelection = start !== end;
    const caretIndex = getCaretIndex(target);
    const isPassword = target.type === 'password';
    const textBeforeCaret = isPassword
      ? PASSWORD_CHAR.repeat(caretIndex)
      : target.value.slice(0, caretIndex);

    // Mirror the input's font onto the hidden span and measure the prefix width.
    span.style.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    span.style.letterSpacing = cs.letterSpacing;
    span.style.fontFeatureSettings = cs.fontFeatureSettings;
    span.style.fontVariationSettings = cs.fontVariationSettings;
    span.textContent = textBeforeCaret;

    const paddingLeft = parseFloat(cs.paddingLeft) || 0;
    const paddingRight = parseFloat(cs.paddingRight) || 0;
    const absoluteWidth =
      textBeforeCaret.length > 0 ? span.offsetWidth + paddingLeft : paddingLeft - 1;

    // Keep the caret in view when the text overflows.
    const maxScroll = Math.max(0, target.scrollWidth - target.clientWidth);
    const visibleRight = target.scrollLeft + target.clientWidth - paddingRight;
    const visibleLeft = target.scrollLeft + paddingLeft;
    if (absoluteWidth > visibleRight) {
      target.scrollLeft = Math.min(absoluteWidth - target.clientWidth + paddingRight, maxScroll);
    } else if (absoluteWidth < visibleLeft) {
      target.scrollLeft = Math.max(0, absoluteWidth - paddingLeft);
    }

    const fontSize = parseFloat(cs.fontSize) || 16;
    setCaretHeight(Math.round(fontSize * 1.1)); // sibling span doesn't inherit input font-size

    const caretPosition = absoluteWidth - target.scrollLeft;
    const minX = paddingLeft - 1;
    const maxX = target.clientWidth - paddingRight;
    const isVisible = caretPosition >= minX && caretPosition <= maxX + 1;

    const nextX = Math.min(caretPosition, maxX);
    caretX.set(nextX);
    // While typing (the value changed) snap the caret to the text so it never
    // trails behind the last letter. Only glide the spring when the caret moves
    // without the text changing — arrow keys, or clicking to reposition.
    if (target.value !== prevValueRef.current) springCaretX.jump(nextX);
    prevValueRef.current = target.value;
    caretOpacity.set(!isVisible || hasSelection ? 0 : 1);
  };

  // Keep the latest closure in a ref so listeners never need to re-subscribe.
  // Assigned in an effect (not during render) per react-hooks rules; ordered
  // first so later effects in this component see the fresh value.
  const updateCaretRef = useRef(updateCaretFromInput);
  useEffect(() => {
    updateCaretRef.current = updateCaretFromInput;
  });

  // Coalesce every trigger (typing, selection, scroll, resize) into at most one
  // caret update per animation frame. Without this the caret was recomputed
  // ~3x per keystroke, forcing repeated synchronous layout and lagging typing.
  const rafRef = useRef(0);
  const scheduleCaretUpdate = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const input = inputRef.current;
      if (input && document.activeElement === input) updateCaretRef.current(input);
    });
  }, []);

  // Re-measure when the value / type changes while focused.
  useEffect(() => {
    if (smooth) scheduleCaretUpdate();
  }, [inputValue, type, smooth, scheduleCaretUpdate]);

  // Listeners: selection, scroll, font-load, resize.
  useEffect(() => {
    if (!smooth) return;
    const input = inputRef.current;
    const container = containerRef.current;
    if (!input || !container) return;

    const onSelection = () => {
      if (document.activeElement === input) scheduleCaretUpdate();
    };
    const onLocal = () => scheduleCaretUpdate();

    document.addEventListener('selectionchange', onSelection);
    document.fonts?.addEventListener('loadingdone', onLocal);
    void document.fonts?.ready.then(onLocal);
    input.addEventListener('scroll', onLocal);

    const resizeObserver = new ResizeObserver(onLocal);
    resizeObserver.observe(container);
    scheduleCaretUpdate();

    return () => {
      document.removeEventListener('selectionchange', onSelection);
      document.fonts?.removeEventListener('loadingdone', onLocal);
      input.removeEventListener('scroll', onLocal);
      resizeObserver.disconnect();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [smooth, scheduleCaretUpdate]);

  const handleChange = (e) => {
    if (!isControlled) setInternalValue(e.target.value);
    onChange?.(e);
    if (smooth) scheduleCaretUpdate();
  };

  // Native passthrough — identical markup to a plain <input>.
  if (!smooth) {
    return (
      <input
        {...props}
        ref={setRefs}
        type={type}
        className={className}
        style={style}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        onBlur={onBlur}
      />
    );
  }

  return (
    <span
      ref={containerRef}
      style={{ position: 'relative', display: 'block', width: '100%', ...wrapperStyle }}
    >
      <input
        {...props}
        ref={setRefs}
        type={type}
        className={className}
        style={{ ...style, caretColor: 'transparent' }}
        value={inputValue}
        onChange={handleChange}
        onBlur={(e) => {
          caretOpacity.set(0);
          onBlur?.(e);
        }}
      />
      <span
        ref={measureRef}
        aria-hidden
        style={{
          position: 'absolute',
          visibility: 'hidden',
          whiteSpace: 'pre',
          top: 0,
          left: 0,
          pointerEvents: 'none',
        }}
      />
      <MotionSpan
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          margin: 'auto 0',
          width: 2,
          height: caretHeight,
          borderRadius: 1,
          background: caretColor,
          pointerEvents: 'none',
          x: springCaretX,
          opacity: caretOpacity,
        }}
      />
    </span>
  );
});

export default SmoothInput;
