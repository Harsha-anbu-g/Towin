/**
 * Top-view turtle logo — shell scute pattern, head, four legs, tail visible.
 * Use as the ToWin mark anywhere a brand logo is needed.
 */
export default function TurtleLogo({ size = 28, color = '#4FA3CE', strokeWidth = 1.6, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {/* Head (top, peeking out from shell) */}
      <ellipse cx="16" cy="6" rx="2.4" ry="2.6" />

      {/* Front-left leg */}
      <ellipse cx="6.5" cy="12" rx="2.4" ry="1.8" transform="rotate(-30 6.5 12)" />
      {/* Front-right leg */}
      <ellipse cx="25.5" cy="12" rx="2.4" ry="1.8" transform="rotate(30 25.5 12)" />
      {/* Back-left leg */}
      <ellipse cx="6.5" cy="22" rx="2.4" ry="1.8" transform="rotate(30 6.5 22)" />
      {/* Back-right leg */}
      <ellipse cx="25.5" cy="22" rx="2.4" ry="1.8" transform="rotate(-30 25.5 22)" />

      {/* Tail (bottom) */}
      <path d="M14.8 25.5 L16 28.2 L17.2 25.5" />

      {/* Shell outline */}
      <ellipse cx="16" cy="17" rx="8" ry="8.5" />

      {/* Central hexagonal scute */}
      <path d="M16 11.5 L20 14 L20 20 L16 22.5 L12 20 L12 14 Z" />

      {/* Scute dividers radiating from hexagon to shell edge */}
      <path d="M20 14 L23.2 12.5" />
      <path d="M20 20 L23.2 21.5" />
      <path d="M12 20 L8.8 21.5" />
      <path d="M12 14 L8.8 12.5" />
    </svg>
  );
}
