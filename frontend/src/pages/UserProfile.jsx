import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import api from '../api/axios';

const SF  = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const SFD = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SKY  = '#4FA3CE';
const BLUE = '#3D8AB0';
const BG   = '#EAF5FB';

const initials = (name) =>
  name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';

function Avatar({ name, photoUrl, size = 96 }) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        style={{
          width: `${size}px`, height: `${size}px`,
          borderRadius: '50%', objectFit: 'cover',
          border: '3px solid #fff', boxShadow: '0 2px 12px rgba(0,0,0,0.10)',
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div style={{
      width: `${size}px`, height: `${size}px`, borderRadius: '50%',
      background: BG, border: `3px solid #BFD9EA`,
      color: SKY, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: `${Math.round(size * 0.38)}px`, fontWeight: 700, fontFamily: SFD,
    }}>
      {initials(name)}
    </div>
  );
}

function Pill({ label }) {
  return (
    <span style={{
      fontFamily: SF, fontSize: '13px', fontWeight: 500,
      background: BG, color: BLUE,
      border: '1px solid #BFD9EA',
      borderRadius: '9999px', padding: '4px 12px',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

function Stars({ rating }) {
  return (
    <span style={{ color: '#F5B400', letterSpacing: '-1px', fontSize: '17px' }}>
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  );
}

const TIER_COLORS = {
  'Community Champion': { bg: '#FFF7E6', color: '#92400e', border: '#FDE68A' },
  'Highly Trusted':     { bg: BG, color: BLUE, border: '#A8D4EC' },
  'Reliable':           { bg: BG, color: BLUE, border: '#A8D4EC' },
  'Getting Started':    { bg: '#F3F4F6', color: '#5a6470', border: '#D1D5DB' },
  'New Member':         { bg: '#F3F4F6', color: '#9ca3af', border: '#E5E7EB' },
};

function ScoreRing({ score }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const pct = Math.min((score ?? 0) / 65, 1);
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" style={{ flexShrink: 0 }}>
      <circle cx="44" cy="44" r={r} fill="none" stroke="#ececef" strokeWidth="7" />
      <circle cx="44" cy="44" r={r} fill="none" stroke={SKY} strokeWidth="7"
        strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 44 44)"
        style={{ transition: 'stroke-dasharray 0.7s ease' }} />
      <text x="44" y="40" textAnchor="middle"
        style={{ fontFamily: SFD, fontSize: '18px', fontWeight: 700, fill: '#1d1d1f' }}>
        {score ?? 0}
      </text>
      <text x="44" y="54" textAnchor="middle"
        style={{ fontFamily: SF, fontSize: '9px', fill: '#9ca3af' }}>
        pts
      </text>
    </svg>
  );
}

function Section({ title, children }) {
  return (
    <div style={{
      background: '#fff', borderRadius: '18px', border: '1px solid #e0e0e0',
      padding: '24px 28px', boxShadow: '0 2px 16px rgba(0,0,0,0.04)',
    }}>
      <h3 style={{ fontFamily: SFD, fontSize: '16px', fontWeight: 700, color: '#1d1d1f', margin: '0 0 16px', letterSpacing: '-0.2px' }}>
        {title}
      </h3>
      {children}
    </div>
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

  return (
    <div style={{ minHeight: '100svh', background: '#fafafc' }}>
      <NavBar />
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '32px 20px 80px' }}>

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px',
            fontFamily: SF, fontSize: '14px', color: SKY, fontWeight: 600,
            marginBottom: '24px', padding: 0,
          }}
        >
          <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
            <path d="M8.5 1L1.5 8L8.5 15" stroke="#4FA3CE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>

        {loading && (
          <div style={{
            background: '#fff', borderRadius: '18px', border: '1px solid #e0e0e0',
            padding: '64px', textAlign: 'center', fontFamily: SF, fontSize: '15px', color: '#a0a0a5',
          }}>
            Loading profile…
          </div>
        )}

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: '14px', padding: '16px 20px',
            fontFamily: SF, fontSize: '14px', color: '#dc2626',
          }}>
            {error}
          </div>
        )}

        {profile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Hero card */}
            <div style={{
              background: '#fff', borderRadius: '18px', border: '1px solid #e0e0e0',
              padding: '28px 28px 24px', boxShadow: '0 2px 16px rgba(0,0,0,0.04)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '18px' }}>
                <Avatar name={profile.name} photoUrl={profile.photoUrl} size={80} />
                <div style={{ flex: 1 }}>
                  <h1 style={{ fontFamily: SFD, fontSize: '24px', fontWeight: 700, color: '#1d1d1f', margin: '0 0 10px', letterSpacing: '-0.3px' }}>
                    {profile.name || 'User'}
                  </h1>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {profile.verificationStatus === 'VERIFIED' && (
                      <span style={{ fontFamily: SF, fontSize: '12px', fontWeight: 600, color: BLUE, background: BG, border: '1px solid #BFD9EA', borderRadius: '9999px', padding: '3px 10px' }}>
                        ✓ ID Verified
                      </span>
                    )}
                    {profile.phoneVerified && (
                      <span style={{ fontFamily: SF, fontSize: '12px', fontWeight: 600, color: BLUE, background: BG, border: '1px solid #BFD9EA', borderRadius: '9999px', padding: '3px 10px' }}>
                        ✓ Phone Verified
                      </span>
                    )}
                  </div>
                </div>

                {/* Trust score — prominent right-side block */}
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flexShrink: 0,
                }}>
                  <ScoreRing score={profile.trustScore} />
                  {(() => {
                    const tier = profile.trustTier ?? 'New Member';
                    const tc = TIER_COLORS[tier] ?? TIER_COLORS['New Member'];
                    return (
                      <span style={{
                        fontFamily: SF, fontSize: '11px', fontWeight: 700,
                        background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`,
                        borderRadius: '9999px', padding: '3px 10px',
                      }}>
                        {tier}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Meta row */}
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                {profile.city && (
                  <span style={{ fontFamily: SF, fontSize: '13px', color: '#7a7a7a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {profile.city}
                  </span>
                )}
                {profile.age && (
                  <span style={{ fontFamily: SF, fontSize: '13px', color: '#7a7a7a' }}>
                    Age {profile.age}
                  </span>
                )}
                {profile.occupation && (
                  <span style={{ fontFamily: SF, fontSize: '13px', color: '#7a7a7a' }}>
                    {profile.occupation}
                  </span>
                )}
              </div>
            </div>

            {/* Bio */}
            {profile.bio && (
              <Section title="About">
                <p style={{ fontFamily: SF, fontSize: '15px', color: '#3a3a3c', lineHeight: 1.65, margin: 0 }}>
                  {profile.bio}
                </p>
              </Section>
            )}

            {/* Skills / Hobbies / Languages in one card */}
            {((profile.skillsOffered?.length > 0) || (profile.hobbies?.length > 0) || (profile.languages?.length > 0)) && (
              <Section title="Skills & Interests">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {profile.skillsOffered?.length > 0 && (
                    <div>
                      <p style={{ fontFamily: SF, fontSize: '12px', fontWeight: 700, color: '#a0a0a5', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px' }}>Skills Offered</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {profile.skillsOffered.map(s => <Pill key={s} label={s} />)}
                      </div>
                    </div>
                  )}
                  {profile.hobbies?.length > 0 && (
                    <div>
                      <p style={{ fontFamily: SF, fontSize: '12px', fontWeight: 700, color: '#a0a0a5', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px' }}>Hobbies</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {profile.hobbies.map(h => <Pill key={h} label={h} />)}
                      </div>
                    </div>
                  )}
                  {profile.languages?.length > 0 && (
                    <div>
                      <p style={{ fontFamily: SF, fontSize: '12px', fontWeight: 700, color: '#a0a0a5', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px' }}>Languages</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {profile.languages.map(l => <Pill key={l} label={l} />)}
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Reviews */}
            <Section title={`Reviews${reviews.length > 0 ? ` (${reviews.length})` : ''}`}>
              {reviews.length === 0 ? (
                <p style={{ fontFamily: SF, fontSize: '14px', color: '#a0a0a5', margin: 0 }}>
                  No reviews yet.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {reviews.map(rv => (
                    <div key={rv.id} style={{
                      paddingBottom: '16px',
                      borderBottom: '1px solid #f0f0f0',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Stars rating={rv.rating} />
                          <span style={{ fontFamily: SF, fontSize: '13px', fontWeight: 600, color: '#1d1d1f' }}>
                            {rv.safetyConcern ? 'Anonymous' : (rv.reviewerName || 'Elder')}
                          </span>
                        </div>
                        <span style={{ fontFamily: SF, fontSize: '12px', color: '#a0a0a5' }}>
                          {timeAgo(rv.createdAt)}
                        </span>
                      </div>
                      {rv.tags?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '6px' }}>
                          {rv.tags.map(t => (
                            <span key={t} style={{ fontFamily: SF, fontSize: '11px', background: '#f5f5f7', color: '#5a6470', borderRadius: '9999px', padding: '3px 9px' }}>
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      {rv.comment && (
                        <p style={{ fontFamily: SF, fontSize: '14px', color: '#5a5a5a', margin: 0, lineHeight: 1.55 }}>
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
