import { Users } from 'lucide-react';
import { mutualFriendsText } from '../lib/mutualFriends';

// "You both know Sarah (your daughter) and Grace" under a suggested person.
// Only people the viewer already knows are ever named (MutualFriendsService).
export default function MutualFriends({ person, style }) {
  const text = mutualFriendsText(person?.mutualFriends, person?.mutualCount);
  if (!text) return null;
  return (
    <p style={{
      display: 'flex', alignItems: 'flex-start', gap: '7px',
      fontSize: 'var(--text-sm)', color: 'var(--ink-slate-dark)', fontWeight: 500,
      margin: '8px 0 0', lineHeight: 1.45, ...style,
    }}>
      <Users size={16} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0, marginTop: '2px', color: 'var(--blue-deep)' }} />
      <span>{text}</span>
    </p>
  );
}
