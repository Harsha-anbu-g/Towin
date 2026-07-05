import { Link } from 'react-router-dom';
import { Gamepad2 } from 'lucide-react';

const SF = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

// Peekaboo lives inline at the end of the dashboard content — a quiet row card
// (the floating pill cluttered the corners next to the Feedback / Ask AI FABs).
export default function PeekabooCard() {
  return (
    <Link
      to="/game"
      aria-label="Play Peekaboo"
      className="lift"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        background: 'var(--canvas)',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        padding: '14px 18px',
        textDecoration: 'none',
        fontFamily: SF,
        minHeight: '44px',
      }}
    >
      <span style={{
        width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
        background: 'var(--green-tint)', border: '1px solid var(--green-line)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--leaf)',
      }}>
        <Gamepad2 size={19} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--green-deep)' }}>
          Play Peekaboo
        </span>
        <span style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--ink-slate)', marginTop: '2px' }}>
          A one-minute memory game
        </span>
      </span>
      <span aria-hidden style={{ fontSize: '22px', color: 'var(--ink-4)', lineHeight: 1 }}>›</span>
    </Link>
  );
}
