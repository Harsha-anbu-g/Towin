/**
 * ToWin brand mark — the heart-shell turtle logo, rendered from the
 * original artwork in /public (same file every screen uses).
 * Use `alpha` when placing it on a tinted/dark background.
 */
export default function TurtleLogo({ size = 28, alpha = false, alt = 'ToWin logo', ...rest }) {
  return (
    <img
      src={alpha ? '/tortoise-logo-alpha.png' : '/logo.png'}
      alt={alt}
      width={size}
      height={size}
      style={{ objectFit: 'contain', ...rest.style }}
      {...rest}
    />
  );
}
