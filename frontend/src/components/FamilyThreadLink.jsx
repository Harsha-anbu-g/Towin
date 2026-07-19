import { useNavigate } from 'react-router-dom';

const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

/* Doorway to the family updates group thread — the notes themselves live in
   Messages now (user call 2026-07-19), read the same way by all three people. */
export default function FamilyThreadLink({ connectionId, label = 'Open family updates' }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(`/messages/${connectionId}?channel=family`)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '7px',
        height: '44px', padding: '0 18px', borderRadius: '9999px',
        background: 'var(--blue-wash)', color: 'var(--blue-deep)',
        border: '1px solid var(--blue-soft)', fontSize: 'var(--text-sm)',
        fontWeight: 600, fontFamily: SFText, cursor: 'pointer',
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      {label} →
    </button>
  );
}
