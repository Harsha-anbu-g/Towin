import { Link } from 'react-router-dom';
import { Gamepad2 } from 'lucide-react';

const SF = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

// Peekaboo used to live in the top nav. It now lives here as a friendly tile
// on the dashboard, keeping the game one tap away without cluttering the bar.
export default function PeekabooCard() {
  return (
    <Link to="/game" style={{
      display: 'flex', alignItems: 'center', gap: '14px',
      textDecoration: 'none',
      background: '#EBF6EE',
      border: '1.5px solid #BFE0C9',
      borderRadius: '16px',
      padding: '14px 18px',
    }}>
      <div style={{
        width: '44px', height: '44px', borderRadius: '12px',
        background: '#3D8B5A', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Gamepad2 size={22} strokeWidth={2.2} aria-hidden="true" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '16px', fontWeight: 700, color: '#1a5c2e', fontFamily: SF, margin: 0 }}>
          Play Peekaboo
        </p>
        <p style={{ fontSize: '13px', color: '#3D8B5A', fontFamily: SF, margin: '2px 0 0' }}>
          A gentle memory game — take a break and have fun.
        </p>
      </div>
      <span style={{
        flexShrink: 0,
        fontSize: '14px', fontWeight: 700, fontFamily: SF,
        color: '#fff', background: '#3D8B5A',
        borderRadius: '9999px', padding: '8px 18px',
      }}>
        Play
      </span>
    </Link>
  );
}
