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

  // Mirror the input's font onto the hidden measuring span.
  const syncMeasureSpan = () => {
    const input = inputRef.current;
    const span = measureRef.current;
    if (!input || !span) return;
    const s = window.getComputedStyle(input);
    span.style.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
    span.style.letterSpacing = s.letterSpacing;
    span.style.fontFeatureSettings = s.fontFeatureSettings;
    span.style.fontVariationSettings = s.fontVariationSettings;
  };

  // Absolute x (within the input box) of the caret for the given prefix text.
  const measurePrefixWidth = (text) => {
    const input = inputRef.current;
    const span = measureRef.current;
    if (!input || !span) return null;
    syncMeasureSpan();
    span.textContent = text;
    const paddingLeft = parseFloat(window.getComputedStyle(input).paddingLeft) || 0;
    return text.length > 0 ? span.offsetWidth + paddingLeft : paddingLeft - 1;
  };

  const scrollCaretIntoView = (target, absoluteWidth) => {
    const s = window.getComputedStyle(target);
    const paddingLeft = parseFloat(s.paddingLeft) || 0;
    const paddingRight = parseFloat(s.paddingRight) || 0;
    const maxScroll = Math.max(0, target.scrollWidth - target.clientWidth);
    const visibleRight = target.scrollLeft + target.clientWidth - paddingRight;
    const visibleLeft = target.scrollLeft + paddingLeft;
    if (absoluteWidth > visibleRight) {
      target.scrollLeft = Math.min(absoluteWidth - target.clientWidth + paddingRight, maxScroll);
      return;
    }
    if (absoluteWidth < visibleLeft) {
      target.scrollLeft = Math.max(0, absoluteWidth - paddingLeft);
    }
  };

  const getCaretIndex = (target) => {
    const start = target.selectionStart ?? 0;
    const end = target.selectionEnd ?? 0;
    if (start === end) return start;
    return target.selectionDirection === 'backward' ? start : end;
  };

  const updateCaretFromInput = (target) => {
    const start = target.selectionStart ?? 0;
    const end = target.selectionEnd ?? 0;
    const hasSelection = start !== end;
    const caretIndex = getCaretIndex(target);
    const isPassword = target.type === 'password';
    const textBeforeCaret = isPassword
      ? PASSWORD_CHAR.repeat(caretIndex)
      : target.value.slice(0, caretIndex);

    const absoluteWidth = measurePrefixWidth(textBeforeCaret);
    if (absoluteWidth === null) return;

    scrollCaretIntoView(target, absoluteWidth);

    const s = window.getComputedStyle(target);
    const paddingLeft = parseFloat(s.paddingLeft) || 0;
    const paddingRight = parseFloat(s.paddingRight) || 0;
    const fontSize = parseFloat(s.fontSize) || 16;
    setCaretHeight(Math.round(fontSize * 1.1)); // sibling span doesn't inherit input font-size

    const caretPosition = absoluteWidth - target.scrollLeft;
    const minX = paddingLeft - 1;
    const maxX = target.clientWidth - paddingRight;
    const isVisible = caretPosition >= minX && caretPosition <= maxX + 1;

    caretX.set(Math.min(caretPosition, maxX));
    caretOpacity.set(!isVisible || hasSelection ? 0 : 1);
  };

  // Keep the latest closure in a ref so listeners never need to re-subscribe.
  // Assigned in an effect (not during render) per react-hooks rules; ordered
  // first so later effects in this component see the fresh value.
  const updateCaretRef = useRef(updateCaretFromInput);
  useEffect(() => {
    updateCaretRef.current = updateCaretFromInput;
  });

  // Re-measure when the value / type changes while focused.
  useEffect(() => {
    if (!smooth) return;
    const input = inputRef.current;
    if (input && document.activeElement === input) updateCaretRef.current(input);
  }, [inputValue, type, smooth]);

  // Listeners: selection, scroll, font-load, resize.
  useEffect(() => {
    if (!smooth) return;
    const input = inputRef.current;
    const container = containerRef.current;
    if (!input || !container) return;

    const updateIfFocused = () => {
      if (document.activeElement === input) updateCaretRef.current(input);
    };
    const handleSelectionChange = () => {
      if (document.activeElement !== input) return;
      requestAnimationFrame(() => {
        if (document.activeElement === input) updateCaretRef.current(input);
      });
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    document.fonts?.addEventListener('loadingdone', updateIfFocused);
    void document.fonts?.ready.then(updateIfFocused);
    input.addEventListener('scroll', updateIfFocused);

    const resizeObserver = new ResizeObserver(updateIfFocused);
    resizeObserver.observe(container);
    updateIfFocused();

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.fonts?.removeEventListener('loadingdone', updateIfFocused);
      input.removeEventListener('scroll', updateIfFocused);
      resizeObserver.disconnect();
    };
  }, [smooth]);

  const handleChange = (e) => {
    if (!isControlled) setInternalValue(e.target.value);
    onChange?.(e);
    if (smooth) requestAnimationFrame(() => updateCaretRef.current(e.target));
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
