const SF = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

// Owner details — kept in sync with the contact block on the Feedback page.
const OWNER = 'Harshavardhan Anbuchezhian Gowri';
const YEAR = 2026;
const COPYRIGHT = `© ${YEAR} ${OWNER}. All rights reserved.`;

// lucide-react ships no brand icons, so the two glyphs are drawn here in the
// same 24px, 2px-stroke line style the rest of the site's icons use.
const iconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  style: { flexShrink: 0 },
};

const InstagramIcon = () => (
  <svg {...iconProps}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

const LinkedInIcon = () => (
  <svg {...iconProps}>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <line x1="8" y1="11" x2="8" y2="17" />
    <line x1="8" y1="7.5" x2="8.01" y2="7.5" />
    <line x1="12" y1="17" x2="12" y2="11" />
    <path d="M17 17v-3.5a2.5 2.5 0 0 0-5 0" />
  </svg>
);

const SOCIAL_LINKS = [
  { label: 'Instagram', href: 'https://www.instagram.com/towinly.trust/', Icon: InstagramIcon },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/towinly/', Icon: LinkedInIcon },
];

const TEXT_STYLE = {
  fontFamily: SF,
  fontSize: 'var(--text-xs)',
  color: 'var(--footer-text)',
  letterSpacing: '0.1px',
};

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
      <nav aria-label="Towinly on social media" style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '20px',
        marginBottom: '6px',
      }}>
        {SOCIAL_LINKS.map(({ label, href, Icon }) => (
          <a key={label} href={href} target="_blank" rel="noopener noreferrer"
            style={{
              ...TEXT_STYLE,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              textDecoration: 'underline',
            }}>
            <Icon />
            {label}
          </a>
        ))}
      </nav>
      <span style={TEXT_STYLE}>
        {COPYRIGHT}
      </span>
    </footer>
  );
}
