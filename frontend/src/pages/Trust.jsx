import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NavBar from '../components/NavBar';
import api from '../api/axios';

const SF  = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const SFD = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SKY   = '#4FA3CE';
const BLUE  = '#4FA3CE';
const TRUST = '#10069f';
const BG    = '#f5f5f7';
const INK   = '#1d1d1f';
const GREY  = '#7a7a7a';
const FAINT = '#a0a0a5';
const EMPTY = '#d8d8de';

const TIERS = [
  { name: 'New Member',         min: 0 },
  { name: 'Getting Started',    min: 1 },
  { name: 'Reliable',           min: 15 },
  { name: 'Highly Trusted',     min: 45 },
  { name: 'Community Champion', min: 90 },
];

const TIER_COLORS = {
  'Community Champion': { bg: '#FFF7E6', color: '#5a6470', border: '#FDE68A' },
  'Highly Trusted':     { bg: BG, color: BLUE, border: '#A8D4EC' },
  'Reliable':           { bg: BG, color: BLUE, border: '#A8D4EC' },
  'Getting Started':    { bg: '#F3F4F6', color: '#5a6470', border: '#D1D5DB' },
  'New Member':         { bg: '#F3F4F6', color: '#9ca3af', border: '#E5E7EB' },
};

const card = {
  background: '#fff', borderRadius: '18px', border: '1px solid #e0e0e0',
  boxShadow: '0 2px 16px rgba(0,0,0,0.04)',
};

/* ── Score: a plain number — it keeps growing, so no bounded ring ─────────── */
function ScoreRing({ score }) {
  return (
    <div style={{
      width: '120px', flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ fontFamily: SFD, fontSize: '44px', fontWeight: 700, color: INK, lineHeight: 1, letterSpacing: '-0.8px' }}>
        {score}
      </span>
      <span style={{ fontFamily: SF, fontSize: '12px', color: FAINT, marginTop: '4px' }}>
        points
      </span>
    </div>
  );
}

/* ── A row of filled/empty marks (stars or dots) with an x / max count ────── */
function Meter({ label, earned, max, shape, hint }) {
  const marks = [];
  for (let i = 0; i < max; i++) {
    const on = i < earned;
    if (shape === 'star') {
      marks.push(
        <span key={i} style={{ fontSize: '15px', lineHeight: 1, color: on ? SKY : EMPTY }}>★</span>
      );
    } else {
      marks.push(
        <span key={i} style={{
          width: '9px', height: '9px', borderRadius: '50%',
          background: on ? SKY : EMPTY, display: 'inline-block',
        }} />
      );
    }
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '7px 0' }}>
      <span style={{ fontFamily: SF, fontSize: '13px', color: GREY, width: '92px', flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1, flexWrap: 'wrap' }}>
        {marks}
      </span>
      <span style={{ fontFamily: SF, fontSize: '13px', fontWeight: 600, color: earned > 0 ? INK : FAINT, flexShrink: 0 }}>
        {earned}<span style={{ color: FAINT, fontWeight: 400 }}>/{max}</span>
      </span>
    </div>
  );
}

/* ── Header: total score + tier + next-tier hint ─────────────────────────── */
function ScoreSummary({ data }) {
  const score = Math.round(data.totalScore);
  const tierStyle = TIER_COLORS[data.tier] ?? TIER_COLORS['New Member'];
  const idx = TIERS.findIndex(t => t.name === data.tier);
  const next = TIERS[idx + 1];
  const toNext = next ? next.min - score : 0;
  return (
    <div style={{ ...card, padding: '20px', marginBottom: '16px' }}>
      <div className="score-card-row" style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <ScoreRing score={score} />
        <div style={{ flex: 1, minWidth: '220px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center',
            background: tierStyle.bg, color: tierStyle.color,
            border: `1px solid ${tierStyle.border}`,
            borderRadius: '9999px', padding: '4px 13px',
            fontSize: '12px', fontWeight: 600, fontFamily: SF, marginBottom: '10px',
          }}>
            {data.tier}
          </div>
          <h2 style={{ fontFamily: SFD, fontSize: '18px', fontWeight: 700, color: INK, margin: '0 0 6px', letterSpacing: '-0.3px' }}>
            {score} points
          </h2>
          <p style={{ fontFamily: SF, fontSize: '13px', color: GREY, margin: 0, lineHeight: 1.55 }}>
            {next
              ? <>You're <strong style={{ color: INK }}>{toNext}</strong> {toNext === 1 ? 'point' : 'points'} away from <strong style={{ color: INK }}>{next.name}</strong>. Every person you help fully adds up to <strong style={{ color: INK }}>15</strong> points.</>
              : <>You've reached the top tier. Keep helping — every person still adds up to 15 points.</>}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── One profile group = 1 point, earned only when every field is filled ──── */
function ProfileGroup({ group }) {
  const { label, completed, doneCount, itemCount, items } = group;
  return (
    <div style={{
      borderRadius: '14px', padding: '14px 16px',
      background: completed ? BG : '#fafafa',
      border: `1px solid ${completed ? '#dbe7ef' : '#f0f0f0'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
        <p style={{ fontFamily: SFD, fontSize: '14px', fontWeight: 600, color: INK, margin: 0 }}>
          {label}
        </p>
        <span style={{
          fontFamily: SF, fontSize: '12px', fontWeight: 600,
          color: completed ? '#fff' : FAINT,
          background: completed ? SKY : '#ededf0',
          borderRadius: '9999px', padding: '3px 10px', whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          {completed ? '+1 point ✓' : `${doneCount}/${itemCount} · +1 point`}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
        {items.map(it => (
          <div key={it.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '9px' }}>
            <span style={{ fontSize: '14px', lineHeight: '18px', color: it.completed ? BLUE : '#c0c0c8' }}>
              {it.completed ? '✓' : '○'}
            </span>
            <div style={{ flex: 1 }}>
              <span style={{ fontFamily: SF, fontSize: '13px', fontWeight: it.completed ? 600 : 500, color: it.completed ? BLUE : INK }}>
                {it.label}
              </span>
              {!it.completed && it.tip && (
                <p style={{ fontFamily: SF, fontSize: '11px', color: FAINT, margin: '1px 0 0', lineHeight: 1.4 }}>
                  {it.tip}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Profile card: 3 groups of fields, each worth 1 point for every customer ── */
function ProfileCard({ profile, onGoToProfile }) {
  const done = profile.earned >= profile.max;
  return (
    <div style={{ ...card, padding: '20px 22px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '6px' }}>
        <div>
          <h3 style={{ fontFamily: SFD, fontSize: '16px', fontWeight: 600, color: INK, margin: '0 0 4px' }}>
            Your profile
          </h3>
          <p style={{ fontFamily: SF, fontSize: '12px', color: FAINT, margin: 0 }}>
            Fill a whole set to earn its point — and it counts for <em>every</em> customer you help
          </p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <span style={{ fontFamily: SFD, fontSize: '22px', fontWeight: 700, color: INK }}>{profile.earned}</span>
          <span style={{ fontFamily: SF, fontSize: '13px', color: FAINT }}> / {profile.max}</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
        {profile.groups.map(g => <ProfileGroup key={g.key} group={g} />)}
      </div>

      {!done && (
        <div style={{ marginTop: '18px', textAlign: 'center' }}>
          <button onClick={onGoToProfile} style={{
            background: SKY, color: '#fff', border: 'none', borderRadius: '9999px',
            padding: '12px 28px', fontSize: '14px', fontWeight: 600, fontFamily: SF,
            cursor: 'pointer', boxShadow: '0 4px 14px rgba(79,163,206,0.3)',
          }}>
            Finish your profile →
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Avatar for a customer ───────────────────────────────────────────────── */
function Avatar({ name, photoUrl }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  if (photoUrl) {
    return <img src={photoUrl} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  }
  return (
    <div style={{
      width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
      background: '#E6F2FA', border: '1px solid #D8EAF4',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: SFD, fontSize: '16px', fontWeight: 700, color: '#2E7DA6',
    }}>{initial}</div>
  );
}

/* ── One card per customer, showing exactly what they earned you ─────────── */
function CustomerCard({ c }) {
  return (
    <div style={{ ...card, padding: '18px 20px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <Avatar name={c.customerName} photoUrl={c.customerPhotoUrl} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: SFD, fontSize: '15px', fontWeight: 600, color: INK, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.customerName}
          </p>
          <p style={{ fontFamily: SF, fontSize: '12px', color: FAINT, margin: '2px 0 0' }}>
            {c.currentStageLabel}
          </p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: SFD, fontSize: '18px', fontWeight: 700, color: INK, lineHeight: 1 }}>
            {c.total}<span style={{ fontFamily: SF, fontSize: '12px', color: FAINT, fontWeight: 400 }}> / {c.totalMax}</span>
          </div>
          <div style={{ fontFamily: SF, fontSize: '11px', color: FAINT, marginTop: '2px' }}>points</div>
        </div>
      </div>

      <div style={{ height: '6px', borderRadius: '9999px', background: '#ececef', marginBottom: '8px' }}>
        <div style={{ height: '100%', width: `${(c.total / c.totalMax) * 100}%`, background: SKY, borderRadius: '9999px', transition: 'width 0.6s ease' }} />
      </div>

      <div style={{ borderTop: '1px solid #f0f0f2', paddingTop: '6px' }}>
        <Meter label="Trust stages" earned={c.rooting} max={c.rootingMax} shape="dot" />
        <Meter label="Their review" earned={c.review}  max={c.reviewMax}  shape="star" />
        <Meter label="Your profile" earned={c.profile} max={c.profileMax} shape="dot" />
      </div>
    </div>
  );
}

export default function Trust() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isHelper = user?.role === 'HELPER' || user?.role === 'BOTH';
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    api.get('/trust/my-score')
      .then(r => setData(r.data))
      .catch(() => setError('Could not load your trust score. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  const customers = data?.customers ?? [];

  return (
    <div style={{ minHeight: '100svh', background: '#fafafc' }}>
      <NavBar />
      <div style={{ maxWidth: '780px', margin: '0 auto', padding: '40px 24px 80px' }}>

        <div style={{ marginBottom: '22px' }}>
          <h1 style={{ fontFamily: SFD, fontSize: '24px', fontWeight: 700, color: INK, margin: '0 0 6px', letterSpacing: '-0.4px' }}>
            Your <span style={{ color: TRUST }}>Trust</span> Score
          </h1>
          <p style={{ fontFamily: SF, fontSize: '14px', color: GREY, margin: 0, lineHeight: 1.5 }}>
            Each person you help can earn you up to <strong style={{ color: INK }}>15</strong> points:
            {' '}<strong style={{ color: INK }}>7</strong> for growing trust together,
            {' '}<strong style={{ color: INK }}>5</strong> from their review, and
            {' '}<strong style={{ color: INK }}>3</strong> for your profile.
          </p>
        </div>

        {loading && (
          <div style={{ ...card, padding: '64px', textAlign: 'center', fontFamily: SF, fontSize: '15px', color: FAINT }}>
            Loading your score…
          </div>
        )}

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '14px', padding: '16px 20px', fontFamily: SF, fontSize: '14px', color: '#dc2626' }}>
            {error}
          </div>
        )}

        {data && (
          <>
            <ScoreSummary data={data} />

            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '24px 0 12px' }}>
              <h3 style={{ fontFamily: SFD, fontSize: '17px', fontWeight: 700, color: INK, margin: 0 }}>
                {isHelper ? 'People you help' : 'Your helpers'}
              </h3>
              {customers.length > 0 && (
                <span style={{ fontFamily: SF, fontSize: '13px', color: FAINT }}>
                  {customers.length} {customers.length === 1 ? 'person' : 'people'}
                </span>
              )}
            </div>

            {customers.length === 0 ? (
              <div style={{ ...card, padding: '40px 28px', textAlign: 'center' }}>
                <p style={{ fontFamily: SFD, fontSize: '16px', fontWeight: 600, color: INK, margin: '0 0 6px' }}>
                  No one here yet
                </p>
                <p style={{ fontFamily: SF, fontSize: '14px', color: GREY, margin: '0 0 18px', lineHeight: 1.5 }}>
                  {isHelper
                    ? 'Connect with your first elder. As your trust grows step by step, you earn points here.'
                    : 'Connect with your first helper. As your trust grows step by step, you earn points here.'}
                </p>
                <button onClick={() => navigate('/dashboard')} style={{
                  background: SKY, color: '#fff', border: 'none', borderRadius: '9999px',
                  padding: '12px 28px', fontSize: '14px', fontWeight: 600, fontFamily: SF,
                  cursor: 'pointer', boxShadow: '0 4px 14px rgba(79,163,206,0.3)',
                }}>
                  Find {isHelper ? 'an elder' : 'a helper'} →
                </button>
              </div>
            ) : (
              customers.map(c => <CustomerCard key={c.connectionId} c={c} />)
            )}

            <div style={{ marginTop: '24px' }}>
              <ProfileCard profile={data.profile} onGoToProfile={() => navigate('/profile')} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
