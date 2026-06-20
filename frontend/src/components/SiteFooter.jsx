import { Mail, Briefcase, Code2, Camera, Globe } from 'lucide-react';

const SFD = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SF = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const SKY = '#4FA3CE';
const GOLD = '#9C7A3C';

// Owner details — kept in sync with the contact block on the Feedback page.
const OWNER = 'Harshavardhan Anbuchezhian Gowri';
const YEAR = 2026;
const COPYRIGHT = `© ${YEAR} ${OWNER}. All rights reserved.`;

const LINKS = [
  { icon: Globe, label: 'Portfolio', href: 'https://portfolioharsha.vercel.app/', gold: true },
  { icon: Briefcase, label: 'LinkedIn', href: 'https://www.linkedin.com/in/harsha-anbu-gowri/' },
  { icon: Code2, label: 'GitHub', href: 'https://github.com/Harsha-anbu-g' },
  { icon: Camera, label: 'Instagram', href: 'https://www.instagram.com/harsha._.ag' },
  { icon: Mail, label: 'Email', href: 'mailto:agharsha.anbu@gmail.com' },
];

/**
 * Shared footer used across the public pages.
 *  - variant="full" — brand, creator links and the copyright line.
 *  - variant="line" — just the "All rights reserved" line, for the tight
 *    fixed-height pages (Landing slideshow, Login, Register) where a full
 *    footer would not fit.
 */
export default function SiteFooter({ variant = 'full' }) {
  if (variant === 'line') {
    return (
      <p style={{
        fontFamily: SF, fontSize: '12px', color: '#a0a0a5',
        textAlign: 'center', margin: 0, padding: '12px 16px',
      }}>
        {COPYRIGHT}
      </p>
    );
  }

  return (
    <footer style={{
      borderTop: '1px solid #ececef',
      padding: '32px 24px 36px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px',
    }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '9px',
        fontFamily: SFD, fontSize: '18px', fontWeight: 600, color: '#1d1d1f',
        letterSpacing: '-0.3px',
      }}>
        <img src="/logo.png" alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />
        ToWin
      </span>
      <p style={{ fontFamily: SF, fontSize: '14px', color: '#7a7a7a', margin: 0 }}>
        It takes two To Win.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '18px' }}>
        {LINKS.map(({ icon: Icon, label, href, gold }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              fontFamily: SF, fontSize: '13px', fontWeight: gold ? 700 : 500,
              color: gold ? GOLD : '#5a6470', textDecoration: 'none',
            }}
          >
            <Icon size={15} color={gold ? GOLD : SKY} />
            {label}
          </a>
        ))}
      </div>

      <p style={{
        fontFamily: SF, fontSize: '12px', color: '#a0a0a5',
        textAlign: 'center', margin: 0,
      }}>
        {COPYRIGHT}
      </p>
    </footer>
  );
}
