import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NavBar from '../components/NavBar';
import api from '../api/axios';

const SF  = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const SFD = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SKY = '#4FA3CE';
const BLUE = '#4FA3CE';
const BG   = '#f5f5f7';

const TIER_COLORS = {
  'Community Champion': { bg: '#FFF7E6', color: '#5a6470', border: '#FDE68A' },
  'Highly Trusted':     { bg: BG, color: BLUE, border: '#A8D4EC' },
  'Reliable':           { bg: BG, color: BLUE, border: '#A8D4EC' },
  'Getting Started':    { bg: '#F3F4F6', color: '#5a6470', border: '#D1D5DB' },
  'New Member':         { bg: '#F3F4F6', color: '#9ca3af', border: '#E5E7EB' },
};

function ScoreRing({ score }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const BASE = 65;
  const pct = Math.min(score / BASE, 1);
  const display = score % 1 === 0 ? score : score.toFixed(2).replace(/\.?0+$/, '');
  return (
    <svg width="148" height="148" viewBox="0 0 148 148">
      <circle cx="74" cy="74" r={r} fill="none" stroke="#ececef" strokeWidth="10" />
      <circle cx="74" cy="74" r={r} fill="none" stroke={SKY} strokeWidth="10"
        strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 74 74)"
        style={{ transition: 'stroke-dasharray 0.7s ease' }} />
      <text x="74" y="69" textAnchor="middle"
        style={{ fontFamily: SFD, fontSize: '28px', fontWeight: 700, fill: '#1d1d1f' }}>
        {display}
      </text>
      <text x="74" y="88" textAnchor="middle"
        style={{ fontFamily: SF, fontSize: '12px', fill: '#9ca3af' }}>
        pts
      </text>
    </svg>
  );
}

function ScoreCard({ data }) {
  const tierStyle = TIER_COLORS[data.tier] ?? TIER_COLORS['New Member'];
  const display = data.totalScore % 1 === 0
    ? data.totalScore
    : data.totalScore.toFixed(2).replace(/\.?0+$/, '');
  return (
    <div style={{
      background: '#fff', borderRadius: '18px', border: '1px solid #e0e0e0',
      padding: '24px 20px', marginBottom: '20px', boxShadow: '0 2px 16px rgba(0,0,0,0.04)',
    }}>
      <div className="score-card-row">
      <ScoreRing score={data.totalScore} />
      <div style={{ flex: 1 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center',
          background: tierStyle.bg, color: tierStyle.color,
          border: `1px solid ${tierStyle.border}`,
          borderRadius: '9999px', padding: '5px 16px',
          fontSize: '13px', fontWeight: 700, fontFamily: SF, marginBottom: '14px',
        }}>
          {data.tier}
        </div>
        <h2 style={{
          fontFamily: SFD, fontSize: '24px', fontWeight: 700,
          color: '#1d1d1f', margin: '0 0 8px', letterSpacing: '-0.3px',
        }}>
          {display} pts
        </h2>
        <p style={{ fontFamily: SF, fontSize: '14px', color: '#7a7a7a', margin: 0, lineHeight: 1.55 }}>
          {data.totalScore < 3
            ? 'Complete your profile to earn your first points — verification alone adds 0.5 pts.'
            : data.totalScore < 15
            ? 'Build your first elder relationships and progress through trust stages.'
            : 'Great score — keep completing engagements and earning reviews.'}
        </p>
      </div>
      </div>
    </div>
  );
}

function BasicCard({ basic, onGoToProfile }) {
  const pct = Math.round((basic.earned / basic.max) * 100);
  return (
    <div style={{
      background: '#fff', borderRadius: '18px', border: '1px solid #e0e0e0',
      padding: '28px 32px', marginBottom: '16px',
      boxShadow: '0 2px 16px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h3 style={{ fontFamily: SFD, fontSize: '18px', fontWeight: 700, color: '#1d1d1f', margin: '0 0 4px' }}>
            Profile Score
          </h3>
          <p style={{ fontFamily: SF, fontSize: '13px', color: '#a0a0a5', margin: 0 }}>
            How completely you've filled in your profile
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontFamily: SFD, fontSize: '26px', fontWeight: 800, color: '#1d1d1f' }}>
            {basic.earned}
          </span>
          <span style={{ fontFamily: SF, fontSize: '14px', color: '#a0a0a5' }}> / {basic.max}</span>
        </div>
      </div>

      <div style={{ height: '8px', borderRadius: '9999px', background: '#ececef', marginBottom: '24px' }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: SKY,
          borderRadius: '9999px', transition: 'width 0.6s ease',
        }} />
      </div>

      <div className="two-col-grid">
        {basic.fields.map(f => (
          <div key={f.key} style={{
            display: 'flex', alignItems: 'flex-start', gap: '10px',
            padding: '12px 14px', borderRadius: '12px',
            background: f.completed ? BG : '#fafafa',
            border: `1px solid ${f.completed ? '#e0e0e0' : '#f0f0f0'}`,
          }}>
            <span style={{ fontSize: '15px', marginTop: '1px', color: f.completed ? BLUE : '#c0c0c8' }}>
              {f.completed ? '✓' : '○'}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <p style={{
                  fontFamily: SF, fontSize: '13px', fontWeight: 600,
                  color: f.completed ? BLUE : '#1d1d1f', margin: '0 0 2px',
                }}>
                  {f.label}
                </p>
                <span style={{
                  fontFamily: SF, fontSize: '11px', fontWeight: 700,
                  color: f.completed ? BLUE : '#a0a0a5',
                  background: f.completed ? 'rgba(61,138,176,0.08)' : 'transparent',
                  borderRadius: '9999px', padding: f.completed ? '2px 7px' : '0',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  {f.completed ? '+0.25 pts ✓' : '+0.25 pts'}
                </span>
              </div>
              {!f.completed && f.tip && (
                <p style={{ fontFamily: SF, fontSize: '11px', color: '#a0a0a5', margin: 0, lineHeight: 1.4 }}>
                  {f.tip}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {basic.earned < basic.max && (
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button
            onClick={onGoToProfile}
            style={{
              background: SKY, color: '#fff', border: 'none',
              borderRadius: '9999px', padding: '12px 28px',
              fontSize: '14px', fontWeight: 700, fontFamily: SF,
              cursor: 'pointer', boxShadow: '0 4px 14px rgba(79,163,206,0.3)',
            }}
          >
            Complete your profile →
          </button>
          <p style={{ fontFamily: SF, fontSize: '12px', color: '#a0a0a5', margin: '8px 0 0' }}>
            Each completed field adds +0.25 pts to your trust score
          </p>
        </div>
      )}
    </div>
  );
}

function RootingCard({ rooting }) {
  const STAGES = ['Text', 'Voice call', 'Video call', 'In-person', 'Help session'];
  return (
    <div style={{
      background: '#fff', borderRadius: '18px', border: '1px solid #e0e0e0',
      padding: '28px 32px', marginBottom: '16px',
      boxShadow: '0 2px 16px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          <h3 style={{ fontFamily: SFD, fontSize: '18px', fontWeight: 700, color: '#1d1d1f', margin: '0 0 4px' }}>
            Rooting Score
          </h3>
          <p style={{ fontFamily: SF, fontSize: '13px', color: '#a0a0a5', margin: 0 }}>
            Points earned by progressing through trust stages with elders
          </p>
        </div>
        <span style={{ fontFamily: SFD, fontSize: '26px', fontWeight: 800, color: '#1d1d1f' }}>
          +{rooting.earned}
        </span>
      </div>

      <p style={{ fontFamily: SF, fontSize: '14px', color: '#7a7a7a', margin: '0 0 20px' }}>
        {rooting.detail}
      </p>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {STAGES.map((s, i) => (
          <span key={s} style={{
            fontFamily: SF, fontSize: '12px', fontWeight: 600,
            background: '#f5f5f7', color: '#5a6470',
            borderRadius: '9999px', padding: '5px 12px',
          }}>
            {i + 1}. {s}
          </span>
        ))}
      </div>

      {rooting.earned === 0 && (
        <p style={{ fontFamily: SF, fontSize: '13px', color: SKY, margin: '14px 0 0' }}>
          → Send a message to an elder to earn your first rooting point.
        </p>
      )}
    </div>
  );
}

function ReviewCard({ review }) {
  return (
    <div style={{
      background: '#fff', borderRadius: '18px', border: '1px solid #e0e0e0',
      padding: '28px 32px', boxShadow: '0 2px 16px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          <h3 style={{ fontFamily: SFD, fontSize: '18px', fontWeight: 700, color: '#1d1d1f', margin: '0 0 4px' }}>
            Review Score
          </h3>
          <p style={{ fontFamily: SF, fontSize: '13px', color: '#a0a0a5', margin: 0 }}>
            Cumulative star ratings from elders — each star is one point
          </p>
        </div>
        <span style={{ fontFamily: SFD, fontSize: '26px', fontWeight: 800, color: '#1d1d1f' }}>
          +{review.earned}
        </span>
      </div>

      <p style={{ fontFamily: SF, fontSize: '14px', color: '#7a7a7a', margin: 0 }}>
        {review.detail}
      </p>

      {review.earned === 0 && (
        <p style={{ fontFamily: SF, fontSize: '13px', color: SKY, margin: '14px 0 0' }}>
          → Complete a help session so an elder can leave you a review.
        </p>
      )}
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

  return (
    <div style={{ minHeight: '100svh', background: '#fafafc' }}>
      <NavBar />
      <div style={{ maxWidth: '780px', margin: '0 auto', padding: '40px 24px 80px' }}>

        <div style={{ marginBottom: '32px' }}>
          <h1 style={{
            fontFamily: SFD, fontSize: '34px', fontWeight: 700,
            color: '#1d1d1f', margin: '0 0 8px', letterSpacing: '-0.5px',
          }}>
            Your Trust Score
          </h1>
          <p style={{ fontFamily: SF, fontSize: '16px', color: '#7a7a7a', margin: 0, lineHeight: 1.5 }}>
            {isHelper
              ? 'Three parts: your profile completeness, the depth of your elder relationships, and what elders say about you.'
              : 'Your community standing — built through verified identity, connections, and reviews.'}
          </p>
        </div>

        {loading && (
          <div style={{
            background: '#fff', borderRadius: '18px', border: '1px solid #e0e0e0',
            padding: '64px', textAlign: 'center', fontFamily: SF, fontSize: '15px', color: '#a0a0a5',
          }}>
            Loading your score…
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

        {data && (
          <>
            <ScoreCard data={data} />
            <BasicCard basic={data.basic} onGoToProfile={() => navigate('/profile')} />
            <RootingCard rooting={data.rooting} />
            <ReviewCard review={data.review} />
          </>
        )}
      </div>
    </div>
  );
}
