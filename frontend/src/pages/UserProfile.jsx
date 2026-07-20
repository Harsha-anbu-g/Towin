import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import Avatar from '../components/ui/Avatar';
import TrustBadge from '../components/TrustBadge';
import api from '../api/axios';

const CARD = {
  background: 'var(--canvas)', borderRadius: '18px',
  border: '1px solid var(--border)', padding: '24px 28px',
};

const ENTER = (delay) =>
  `fadeSlideUp 0.24s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s both`;

function Chip({ label }) {
  return (
    <span style={{
      fontSize: 'var(--text-xs)', fontWeight: 600,
      background: 'var(--surface-2)', color: 'var(--ink-slate)',
      padding: '4px 11px', borderRadius: '9999px', whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

function VerifiedChip({ label }) {
  return (
    <span style={{
      fontSize: 'var(--text-xs)', fontWeight: 600,
      background: 'var(--green-tint)', color: 'var(--green-deep)',
      border: '1px solid var(--green-line)',
      borderRadius: '9999px', padding: '3px 10px 3px 8px', whiteSpace: 'nowrap',
      display: 'inline-flex', alignItems: 'center', gap: '5px',
    }}>
      <svg aria-hidden width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      {label}
    </span>
  );
}

function Stars({ rating }) {
  return (
    <span aria-label={`${rating} out of 5 stars`} className="star-lit" style={{ letterSpacing: '-1px', fontSize: '16px' }}>
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  );
}

function Section({ title, delay = 0, children }) {
  return (
    <section style={{ ...CARD, animation: ENTER(delay) }}>
      <h2 style={{ fontSize: 'var(--text-lg)', margin: '0 0 16px' }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function timeAgo(isoString) {
  const secs = Math.floor((Date.now() - new Date(isoString)) / 1000);
  if (secs < 60)   return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  const d = Math.floor(secs / 86400);
  if (d < 30)  return `${d}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

function SkeletonCard({ tall }) {
  const bar = (w, h) => (
    <div style={{ width: w, height: h, borderRadius: '8px', background: 'var(--surface)', animation: 'skeleton-pulse 1.5s ease-in-out infinite' }} />
  );
  return (
    <div style={CARD} aria-hidden>
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
        {tall && <div style={{ width: '84px', height: '84px', borderRadius: '50%', background: 'var(--surface)', animation: 'skeleton-pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
          {bar('45%', '20px')}
          {bar('70%', '14px')}
          {!tall && bar('55%', '14px')}
        </div>
      </div>
    </div>
  );
}

export default function UserProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile]   = useState(null);
  const [reviews, setReviews]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  useEffect(() => {
    Promise.all([
      api.get(`/profile/${id}`),
      api.get(`/reviews/user/${id}`),
    ])
      .then(([p, r]) => { setProfile(p.data); setReviews(r.data || []); })
      .catch(() => setError('Could not load this profile.'))
      .finally(() => setLoading(false));
  }, [id]);

  const roleLabel = profile?.role
    ? profile.role.charAt(0) + profile.role.slice(1).toLowerCase()
    : null;
  const metaLine = profile
    ? [roleLabel, profile.occupation, profile.age ? `Age ${profile.age}` : null, profile.city]
        .filter(Boolean).join(' · ')
    : '';
  const hasTrust = profile && (profile.trustScore != null || profile.trustTier);
  const isVerified = profile?.verificationStatus === 'VERIFIED';

  const tagGroups = profile ? [
    { label: 'Can help with', items: profile.skillsOffered },
    { label: 'Interests',     items: profile.interests },
    { label: 'Hobbies',       items: profile.hobbies },
    { label: 'Languages',     items: profile.languages },
  ].filter(g => g.items?.length > 0) : [];

  return (
    <div style={{ minHeight: '100svh', background: 'var(--surface-pearl)' }}>
      <NavBar />
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '32px 20px 80px' }}>

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px',
            fontFamily: 'inherit', fontSize: 'var(--text-sm)', color: 'var(--blue-deep)', fontWeight: 600,
            marginBottom: '16px', padding: 0, minHeight: '44px',
          }}
        >
          <svg aria-hidden width="10" height="16" viewBox="0 0 10 16" fill="none">
            <path d="M8.5 1L1.5 8L8.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <SkeletonCard tall />
            <SkeletonCard />
          </div>
        )}

        {error && (
          <div role="alert" style={{
            background: 'var(--red-tint)', border: '1px solid var(--red-line)',
            borderRadius: '14px', padding: '16px 20px',
            fontSize: 'var(--text-sm)', color: 'var(--red-error)',
          }}>
            {error}
          </div>
        )}

        {profile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Identity */}
            <section style={{ ...CARD, padding: '28px', animation: ENTER(0) }}>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <Avatar name={profile.name} photoUrl={profile.photoUrl} size={84} />
                <div style={{ minWidth: 0 }}>
                  <h1 style={{ fontSize: 'var(--text-xl)', lineHeight: 1.2, margin: 0, overflowWrap: 'anywhere' }}>
                    {profile.name || 'User'}
                  </h1>
                  {profile.username && (
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-4)', margin: '4px 0 0' }}>
                      @{profile.username}
                    </p>
                  )}
                  {metaLine && (
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-slate)', margin: '6px 0 0', lineHeight: 1.45 }}>
                      {metaLine}
                    </p>
                  )}
                </div>
              </div>

              {(hasTrust || isVerified || profile.phoneVerified) && (
                <div style={{
                  borderTop: '1px solid var(--hairline)', marginTop: '20px', paddingTop: '16px',
                  display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
                }}>
                  {hasTrust && (
                    <>
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span aria-hidden className="star-lit">★</span>
                        {profile.trustScore ?? 0} points
                      </span>
                      <TrustBadge tier={profile.trustTier} />
                    </>
                  )}
                  {isVerified && <VerifiedChip label="ID verified" />}
                  {profile.phoneVerified && <VerifiedChip label="Phone verified" />}
                </div>
              )}
            </section>

            {/* Bio */}
            {profile.bio && (
              <Section title="About" delay={0.05}>
                <p style={{ fontSize: 'var(--text-base)', color: 'var(--ink-soft)', lineHeight: 1.6, margin: 0, maxWidth: '65ch' }}>
                  {profile.bio}
                </p>
              </Section>
            )}

            {/* Skills / Interests / Hobbies / Languages */}
            {tagGroups.length > 0 && (() => {
              const sectionTitle = profile.role === 'HELPER' ? 'Skills & Interests' : 'Interests';
              return (
                <Section title={sectionTitle} delay={0.1}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {tagGroups.map(group => (
                      <div key={group.label}>
                        {group.label !== sectionTitle && (
                          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink-slate)', margin: '0 0 8px' }}>
                            {group.label}
                          </p>
                        )}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {group.items.map(item => <Chip key={item} label={item} />)}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              );
            })()}

            {/* Reviews */}
            <Section title={`Reviews${reviews.length > 0 ? ` (${reviews.length})` : ''}`} delay={0.15}>
              {reviews.length === 0 ? (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-4)', margin: 0 }}>
                  No reviews yet.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {reviews.map((rv, i) => (
                    <div key={rv.id} style={{
                      paddingBottom: i < reviews.length - 1 ? '16px' : 0,
                      borderBottom: i < reviews.length - 1 ? '1px solid var(--hairline)' : 'none',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink)', overflowWrap: 'anywhere' }}>
                            {rv.safetyConcern ? 'Anonymous' : (rv.reviewerName || 'Elder')}
                          </span>
                          {/* Written by a family member for them. Safety reports stay
                              anonymous — the server sends no name for those, so there
                              is simply nothing here to show. */}
                          {rv.actedByName && (
                            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gold-deep)', overflowWrap: 'anywhere' }}>
                              written by {rv.actedByName}
                            </span>
                          )}
                          <Stars rating={rv.rating} />
                        </div>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-4)', flexShrink: 0 }}>
                          {timeAgo(rv.createdAt)}
                        </span>
                      </div>
                      {rv.tags?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '6px' }}>
                          {rv.tags.map(t => <Chip key={t} label={t} />)}
                        </div>
                      )}
                      {rv.comment && (
                        <p style={{ fontSize: '16px', color: 'var(--ink-mid)', margin: 0, lineHeight: 1.55, maxWidth: '65ch' }}>
                          {rv.comment}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>

          </div>
        )}
      </div>
    </div>
  );
}
