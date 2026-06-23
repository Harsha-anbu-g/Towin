const SF = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

// Owner details — kept in sync with the contact block on the Feedback page.
const OWNER = 'Harshavardhan Anbuchezhian Gowri';
const YEAR = 2026;
const COPYRIGHT = `© ${YEAR} ${OWNER}. All rights reserved.`;

/**
 * Regular in-flow footer shown at the bottom-right END of the page (Login,
 * Register, Feedback). It scrolls with the content like a normal footer —
 * you only see it once you reach the end of the page, not pinned to the
 * screen. Pass `style` (e.g. `{ marginTop: 'auto' }`) to let it sink to the
 * bottom of a flex-column container.
 */
export default function SiteFooter({ style }) {
  return (
    <footer style={{
      width: '100%',
      boxSizing: 'border-box',
      padding: '24px 28px 6px',
      textAlign: 'right',
      ...style,
    }}>
      <span style={{
        fontFamily: SF,
        fontSize: '13px',
        color: '#8e8e93',
        letterSpacing: '0.1px',
      }}>
        {COPYRIGHT}
      </span>
    </footer>
  );
}
