import Avatar from './ui/Avatar';
import MutualFriends from './MutualFriends';

// One suggested person on Add Friends: who they are, how far, who you both
// know, and the one action. Shared by the helper, elder and helper-friend lists
// so the three never drift apart.
//
// status: 'connected' | 'requested' | any other string (an error to show) | null
export default function DiscoverCard({ person, index = 0, fallbackName, tags = [], status, adding, onAdd, onView }) {
  const pill = (text, color) => (
    <span style={{ fontSize: 'var(--text-xs)', background: 'var(--surface-2)', color, padding: '12px 18px', borderRadius: '9999px', fontWeight: 700, textAlign: 'center' }}>{text}</span>
  );
  return (
    <div style={{ background: 'var(--canvas)', borderRadius: '18px', padding: '20px', border: '1px solid var(--border)', animation: `fadeSlideUp 0.24s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.05}s both` }}>
      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
        <Avatar name={person.name} photoUrl={person.photoUrl} size={50} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <p style={{ fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--ink)', margin: 0 }}>{person.name || fallbackName}</p>
            {person.age != null && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-slate)', fontWeight: 500 }}>Age {person.age}</span>
            )}
            {(person.trustScore != null || person.trustTier) && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'var(--slate-tint)', padding: '3px 10px', borderRadius: '9999px', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--ink-slate)' }}>
                ★ {person.trustScore != null ? `${person.trustScore} points` : '-'}{person.trustTier ? ` · ${person.trustTier}` : ''}
              </span>
            )}
          </div>
          {(person.city || person.distanceKm > 0) && (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-slate)', margin: '4px 0 0' }}>
              {person.city}{person.city && person.distanceKm > 0 ? ' · ' : ''}{person.distanceKm > 0 ? `${Math.round(person.distanceKm * 10) / 10} km away` : ''}
            </p>
          )}
          <MutualFriends person={person} />
          {person.bio && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-slate-dark)', margin: '8px 0 0', lineHeight: 1.5 }}>{person.bio}</p>}
          {tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
              {tags.map(s => (
                <span key={s} style={{ fontSize: 'var(--text-xs)', fontWeight: 600, background: 'var(--surface-2)', color: 'var(--ink-slate)', padding: '4px 11px', borderRadius: '9999px' }}>{s}</span>
              ))}
            </div>
          )}
        </div>
        <div className="card-actions" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'stretch', flexShrink: 0 }}>
          {status === 'connected' ? pill('Friends', 'var(--green-deep)')
            : status === 'requested' ? pill('Requested', 'var(--ink-slate)')
            : status ? pill(status, 'var(--ink-slate)')
            : (
              <button onClick={onAdd} disabled={adding}
                style={{ minHeight: '44px', padding: '0 22px', background: 'var(--blue-wash)', color: 'var(--blue-deep)', border: '1px solid var(--blue-soft)', borderRadius: '9999px', fontSize: 'var(--text-sm)', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                {adding ? 'Sending…' : 'Add Friend'}
              </button>
            )}
          <button onClick={onView}
            style={{ height: '44px', padding: '0 14px', background: 'var(--canvas)', color: 'var(--ink-slate)', border: '1px solid var(--border)', borderRadius: '9999px', fontSize: '14px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
            View Profile
          </button>
        </div>
      </div>
    </div>
  );
}
