const SF = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

// Owner details — kept in sync with the contact block on the Feedback page.
const OWNER = 'Harshavardhan Anbuchezhian Gowri';
const YEAR = 2026;
const COPYRIGHT = `© ${YEAR} ${OWNER}. All rights reserved.`;

/**
 * Ultra-subtle copyright line pinned to the very bottom edge of the screen.
 * Used only on Login, Register and Feedback. It is `position: fixed` so it
 * sits at the laptop-screen edge regardless of page scroll, and
 * `pointer-events: none` so it never blocks anything beneath it.
 */
export default function SiteFooter() {
  return (
    <p style={{
      position: 'fixed',
      left: 0, right: 0, bottom: 0,
      margin: 0,
      padding: '2px 8px',
      textAlign: 'center',
      fontFamily: SF,
      fontSize: '10px',
      lineHeight: 1.3,
      letterSpacing: '0.1px',
      color: '#c2c2c8',
      pointerEvents: 'none',
      zIndex: 20,
    }}>
      {COPYRIGHT}
    </p>
  );
}
