import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import NavBar from '../components/NavBar';
import api from '../api/axios';

const SF  = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const SFD = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SKY   = 'var(--blue)';
const BLUE  = 'var(--blue)';
const TRUST = 'var(--trust-gold)';
const BG    = 'var(--surface)';
const INK   = 'var(--ink)';
const GREY  = 'var(--ink-3)';
const FAINT = 'var(--ink-4)';
const EMPTY = 'var(--track-empty)';

const TIERS = [
  { name: 'New Member',         min: 0 },
  { name: 'Getting Started',    min: 1 },
  { name: 'Reliable',           min: 15 },
  { name: 'Highly Trusted',     min: 45 },
  { name: 'Community Champion', min: 90 },
];

const TIER_COLORS = {
  'Community Champion': { bg: 'var(--gold-wash-2)', color: 'var(--ink-slate)', border: 'var(--gold-line)' },
  'Highly Trusted':     { bg: BG, color: BLUE, border: 'var(--sky-line-3)' },
  'Reliable':           { bg: BG, color: BLUE, border: 'var(--sky-line-3)' },
  'Getting Started':    { bg: 'var(--grey-fill-2)', color: 'var(--ink-slate)', border: 'var(--grey-line-2)' },
  'New Member':         { bg: 'var(--grey-fill-2)', color: 'var(--grey-text)', border: 'var(--grey-line)' },
};

const card = {
  background: 'var(--canvas)', borderRadius: '18px', border: '1px solid var(--border)',
};

/* ── Score: a plain number — it keeps growing, so no bounded ring ─────────── */
function ScoreRing({ score }) {
  return (
    <div style={{
      width: '120px', flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '44px', fontWeight: 400, color: INK, lineHeight: 1, letterSpacing: '-0.02em' }}>
        {score}
      </span>
      <span style={{ fontFamily: SF, fontSize: 'var(--text-xs)', color: FAINT, marginTop: '4px' }}>
        points
      </span>
    </div>
  );
}

/* ── A row of filled/empty marks (stars or dots) with an x / max count ────── */
function Meter({ label, earned, max, shape }) {
  const marks = [];
  for (let i = 0; i < max; i++) {
    const on = i < earned;
    if (shape === 'star') {
      marks.push(
        <span key={i} style={{ fontSize: '16px', lineHeight: 1, color: on ? SKY : EMPTY }}>★</span>
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
      <span style={{ fontFamily: SF, fontSize: '14px', color: GREY, width: '92px', flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1, flexWrap: 'wrap' }}>
        {marks}
      </span>
      <span style={{ fontFamily: SF, fontSize: '14px', fontWeight: 600, color: earned > 0 ? INK : FAINT, flexShrink: 0 }}>
        {earned}<span style={{ color: FAINT, fontWeight: 400 }}>/{max}</span>
      </span>
    </div>
  );
}

/* ── A small overlapping circle (photo or initial) for the helper stack ────── */
function MiniAvatar({ name, photoUrl }) {
  const [imgFailed, setImgFailed] = useState(false);
  const ring = { width: '28px', height: '28px', borderRadius: '50%', border: '2px solid #fff', flexShrink: 0 };
  if (photoUrl && !imgFailed) {
    return <img src={photoUrl} alt="" style={{ ...ring, objectFit: 'cover' }} onError={() => setImgFailed(true)} />;
  }
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <div style={{
      ...ring, background: 'var(--blue-tint)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: SFD, fontSize: '12px', fontWeight: 700, color: 'var(--blue-deep)',
    }}>{initial}</div>
  );
}

/* ── The people who got you here: their faces + a count, so each one shows ─── */
function HelperStack({ people }) {
  if (!people || people.length === 0) return null;
  const n = people.length;
  const shown = people.slice(0, 5);
  const extra = n - shown.length;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--hairline-3)',
    }}>
      <div style={{ display: 'flex' }}>
        {shown.map((p, i) => (
          <div key={p.connectionId} style={{ marginLeft: i === 0 ? 0 : '-8px', zIndex: shown.length - i }}>
            <MiniAvatar name={p.customerName} photoUrl={p.customerPhotoUrl} />
          </div>
        ))}
        {extra > 0 && (
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%', border: '2px solid #fff',
            background: 'var(--grey-fill-4)', marginLeft: '-8px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: SF, fontSize: '11px', fontWeight: 600, color: GREY,
          }}>+{extra}</div>
        )}
      </div>
      <span style={{ fontFamily: SF, fontSize: '13px', color: GREY, lineHeight: 1.4 }}>
        <strong style={{ color: INK }}>{n}</strong> {n === 1 ? 'person' : 'people'} helped you reach this
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
  const people = data.customers ?? [];
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
            fontSize: 'var(--text-xs)', fontWeight: 600, fontFamily: SF, marginBottom: '10px',
          }}>
            {data.tier}
          </div>
          <h2 style={{ fontFamily: SFD, fontSize: 'var(--text-base)', fontWeight: 700, color: INK, margin: '0 0 6px', letterSpacing: '-0.3px' }}>
            {score} points
          </h2>
          <p style={{ fontFamily: SF, fontSize: '14px', color: GREY, margin: 0, lineHeight: 1.55 }}>
            {next
              ? <>You're <strong style={{ color: INK }}>{toNext}</strong> {toNext === 1 ? 'point' : 'points'} away from <strong style={{ color: INK }}>{next.name}</strong>. Every person you help fully adds up to <strong style={{ color: INK }}>15</strong> points.</>
              : <>You've reached the top tier. Keep helping — every person still adds up to 15 points.</>}
          </p>
          <HelperStack people={people} />
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
      background: completed ? BG : 'var(--card-idle)',
      border: `1px solid ${completed ? 'var(--sky-line-4)' : 'var(--hairline)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
        <p style={{ fontFamily: SFD, fontSize: 'var(--text-sm)', fontWeight: 600, color: INK, margin: 0 }}>
          {label}
        </p>
        <span style={{
          fontFamily: SF, fontSize: 'var(--text-xs)', fontWeight: 600,
          color: completed ? '#fff' : FAINT,
          background: completed ? SKY : 'var(--grey-fill-4)',
          borderRadius: '9999px', padding: '3px 10px', whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          {completed ? '+1 point ✓' : `${doneCount}/${itemCount} · +1 point`}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
        {items.map(it => (
          <div key={it.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '9px' }}>
            <span style={{ fontSize: 'var(--text-sm)', lineHeight: '18px', color: it.completed ? BLUE : 'var(--grey-text-2)' }}>
              {it.completed ? '✓' : '○'}
            </span>
            <div style={{ flex: 1 }}>
              <span style={{ fontFamily: SF, fontSize: '14px', fontWeight: it.completed ? 600 : 500, color: it.completed ? BLUE : INK }}>
                {it.label}
              </span>
              {!it.completed && it.tip && (
                <p style={{ fontFamily: SF, fontSize: '12px', color: FAINT, margin: '1px 0 0', lineHeight: 1.4 }}>
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
          <p style={{ fontFamily: SF, fontSize: 'var(--text-xs)', color: FAINT, margin: 0 }}>
            Fill a whole set to earn its point — and it counts for <em>every</em> customer you help
          </p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <span style={{ fontFamily: SFD, fontSize: 'var(--text-lg)', fontWeight: 700, color: INK }}>{profile.earned}</span>
          <span style={{ fontFamily: SF, fontSize: '14px', color: FAINT }}> / {profile.max}</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
        {profile.groups.map(g => <ProfileGroup key={g.key} group={g} />)}
      </div>

      {!done && (
        <div style={{ marginTop: '18px', textAlign: 'center' }}>
          <button onClick={onGoToProfile} style={{
            background: SKY, color: '#fff', border: 'none', borderRadius: '9999px',
            padding: '12px 28px', fontSize: 'var(--text-sm)', fontWeight: 600, fontFamily: SF,
            cursor: 'pointer', boxShadow: '0 2px 10px rgba(79,163,206,0.22)',
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
  const [imgFailed, setImgFailed] = useState(false);
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  if (photoUrl && !imgFailed) {
    return <img src={photoUrl} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} onError={() => setImgFailed(true)} />;
  }
  return (
    <div style={{
      width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
      background: 'var(--blue-tint)', border: '1px solid var(--sky-line-2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: SFD, fontSize: '16px', fontWeight: 700, color: 'var(--blue-deep)',
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
          <p style={{ fontFamily: SFD, fontSize: '16px', fontWeight: 600, color: INK, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.customerName}
          </p>
          <p style={{ fontFamily: SF, fontSize: 'var(--text-xs)', color: FAINT, margin: '2px 0 0' }}>
            {c.currentStageLabel}
          </p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: SFD, fontSize: 'var(--text-base)', fontWeight: 700, color: INK, lineHeight: 1 }}>
            {c.total}<span style={{ fontFamily: SF, fontSize: 'var(--text-xs)', color: FAINT, fontWeight: 400 }}> / {c.totalMax}</span>
          </div>
          <div style={{ fontFamily: SF, fontSize: '12px', color: FAINT, marginTop: '2px' }}>points</div>
        </div>
      </div>

      <div style={{ height: '6px', borderRadius: '9999px', background: 'var(--border)', marginBottom: '8px', overflow: 'hidden' }}>
        {/* GPU-only fill: scaleX instead of width so the reveal never thrashes layout */}
        <div style={{
          height: '100%', width: '100%', background: SKY, borderRadius: '9999px',
          transform: `scaleX(${c.total / c.totalMax})`, transformOrigin: 'left center',
          transition: 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        }} />
      </div>

      <div style={{ borderTop: '1px solid var(--hairline-3)', paddingTop: '6px' }}>
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
    <div style={{ minHeight: '100svh', background: 'var(--surface-pearl)' }}>
      <NavBar />
      <div style={{ maxWidth: '780px', margin: '0 auto', padding: '40px 24px 80px' }}>

        <div style={{ marginBottom: '22px' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 400, color: INK, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            Your <span style={{ color: TRUST }}>Trust</span> Score
          </h1>
          <p style={{ fontFamily: SF, fontSize: 'var(--text-sm)', color: GREY, margin: 0, lineHeight: 1.5 }}>
            Each person you help can earn you up to <strong style={{ color: INK }}>15</strong> points:
            {' '}<strong style={{ color: INK }}>7</strong> for growing trust together,
            {' '}<strong style={{ color: INK }}>5</strong> from their review, and
            {' '}<strong style={{ color: INK }}>3</strong> for your profile.
          </p>
        </div>

        {loading && (
          <div style={{ ...card, padding: '64px', textAlign: 'center', fontFamily: SF, fontSize: '16px', color: FAINT }}>
            Loading your score…
          </div>
        )}

        {error && (
          <div style={{ background: 'var(--red-tint)', border: '1px solid var(--red-line)', borderRadius: '14px', padding: '16px 20px', fontFamily: SF, fontSize: 'var(--text-sm)', color: 'var(--red-error)' }}>
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
                <span style={{ fontFamily: SF, fontSize: '14px', color: FAINT }}>
                  {customers.length} {customers.length === 1 ? 'person' : 'people'}
                </span>
              )}
            </div>

            {customers.length === 0 ? (
              <div style={{ ...card, padding: '40px 28px', textAlign: 'center' }}>
                <p style={{ fontFamily: SFD, fontSize: '16px', fontWeight: 600, color: INK, margin: '0 0 6px' }}>
                  No one here yet
                </p>
                <p style={{ fontFamily: SF, fontSize: 'var(--text-sm)', color: GREY, margin: '0 0 18px', lineHeight: 1.5 }}>
                  {isHelper
                    ? 'Connect with your first elder. As your trust grows step by step, you earn points here.'
                    : 'Connect with your first helper. As your trust grows step by step, you earn points here.'}
                </p>
                <button onClick={() => navigate('/dashboard')} style={{
                  background: SKY, color: '#fff', border: 'none', borderRadius: '9999px',
                  padding: '12px 28px', fontSize: 'var(--text-sm)', fontWeight: 600, fontFamily: SF,
                  cursor: 'pointer', boxShadow: '0 2px 10px rgba(79,163,206,0.22)',
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
