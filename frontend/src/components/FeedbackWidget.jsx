import { useNavigate, useLocation } from 'react-router-dom';
import { Pencil } from 'lucide-react';

export default function FeedbackWidget() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Hidden where the fixed button would overlap a primary action:
  // the landing Next/Start, the chat composer, and the Streaks check-in CTA.
  if (
    pathname === '/feedback' ||
    pathname === '/' ||
    pathname === '/streaks' ||
    pathname.startsWith('/messages/')
  ) return null;

  return (
    <button
      onClick={() => navigate('/feedback')}
      aria-label="Give feedback"
      className="feedback-fab"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        background: 'var(--blue)',
        color: '#fff',
        border: 'none',
        borderRadius: '9999px',
        padding: '12px 20px',
        fontSize: 'var(--text-sm)',
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: `-apple-system, 'SF Pro Text', system-ui, sans-serif`,
        boxShadow: '0 4px 20px rgba(79,163,206,0.4)',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'scale(1.04)';
        e.currentTarget.style.boxShadow = '0 6px 24px rgba(79,163,206,0.55)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(79,163,206,0.4)';
      }}
    >
      <Pencil size={15} />
      <span className="feedback-fab-label">Give Feedback</span>
    </button>
  );
}
