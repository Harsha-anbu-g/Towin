import { Link } from 'react-router-dom';
import { Gamepad2 } from 'lucide-react';

const SF = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

// Peekaboo used to live in the top nav. It now floats as a friendly button
// in the bottom-left corner — mirroring the Feedback widget (bottom-right) —
// so the game stays one tap away without cluttering the bar.
export default function PeekabooCard() {
  return (
    <Link
      to="/game"
      aria-label="Play Peekaboo"
      className="peekaboo-fab"
      style={{
        position: 'fixed',
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        background: 'var(--green-tint)',
        color: '#3D8B5A',
        border: '1.5px solid #BFE0C9',
        borderRadius: '9999px',
        padding: '12px 20px',
        fontSize: 'var(--text-sm)',
        fontWeight: 600,
        textDecoration: 'none',
        fontFamily: SF,
        boxShadow: '0 4px 20px rgba(61,139,90,0.18)',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'scale(1.04)';
        e.currentTarget.style.boxShadow = '0 6px 24px rgba(61,139,90,0.3)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(61,139,90,0.18)';
      }}
    >
      <Gamepad2 size={15} />
      <span className="peekaboo-fab-label">Play Peekaboo</span>
    </Link>
  );
}
