import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const SF  = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFT = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const SKY = '#4FA3CE';

function FlameIcon({ size = 56 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2C12 2 7 7 7 12.5C7 15.5 9 18 12 18C15 18 17 15.5 17 12.5C17 10 15.5 8 14 7C14 9 13 10 12 10C11 10 10 9 10 7.5C10 5.5 12 2 12 2Z"
        fill="#4FA3CE" opacity="0.85"
      />
      <path
        d="M12 13C12 13 10.5 14.5 10.5 16C10.5 17.1 11.2 18 12 18C12.8 18 13.5 17.1 13.5 16C13.5 14.5 12 13 12 13Z"
        fill="#1d1d1f" opacity="0.5"
      />
    </svg>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Streaks() {
  const navigate = useNavigate();
  const [streak, setStreak] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    api.get('/streaks/me')
      .then(r => setStreak(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleCheckIn() {
    setChecking(true);
    try {
      const r = await api.post('/streaks/checkin');
      setStreak(r.data);
    } catch {}
    finally { setChecking(false); }
  }

  const alreadyDone = streak?.alreadyCheckedIn;

  return (
    <div style={{ display: 'flex', minHeight: '100svh', fontFamily: SFT }}>

      {/* Left — image panel identical to login/register */}
      <div style={{
        flex: '0 0 42%', position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        padding: '52px 48px', minHeight: '100svh',
      }}>
        <img
          src="/journey.jpg"
          alt="Splinter and the turtles"
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center 30%', zIndex: 0,
          }}
        />
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: 'linear-gradient(to top, rgba(20,55,80,0.65) 0%, rgba(20,55,80,0.28) 50%, rgba(20,55,80,0.04) 100%)',
        }} />
        {/* Logo top-left */}
        <div style={{
          position: 'absolute', top: '32px', left: '48px', zIndex: 2,
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <img src="/logo.png" alt="ToWin logo" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 6 }} />
          <p style={{
            fontSize: '22px', fontWeight: 800, color: '#fff', letterSpacing: '-0.4px',
            fontFamily: SF, margin: 0,
          }}>ToWin</p>
        </div>
        {/* Caption */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          <h2 style={{
            fontFamily: SF, fontSize: '36px', lineHeight: 1.15, color: '#fff',
            marginBottom: '14px', letterSpacing: '-0.3px', fontWeight: 600,
            textShadow: '0 2px 24px rgba(20,55,80,0.45)',
          }}>
            Every day<br />counts.
          </h2>
          <p style={{
            fontFamily: SFT, fontSize: '17px', color: 'rgba(255,255,255,0.92)',
            maxWidth: '340px', lineHeight: 1.55, margin: 0,
            textShadow: '0 1px 12px rgba(20,55,80,0.5)',
          }}>
            Showing up today is the most important thing you can do.
          </p>
        </div>
      </div>

      {/* Right — streak content */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#fafafc', padding: '48px 40px',
      }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>

          {/* Greeting */}
          <p style={{
            fontSize: '18px', color: '#7a7a7a', fontFamily: SFT,
            marginBottom: '8px', fontWeight: 500,
          }}>
            {greeting()}
          </p>
          <h1 style={{
            fontFamily: SF, fontSize: '40px', fontWeight: 700,
            color: '#1d1d1f', letterSpacing: '-0.6px',
            marginBottom: '40px', lineHeight: 1.1,
          }}>
            {alreadyDone ? 'You showed up today.' : 'Ready to check in?'}
          </h1>

          {/* Streak card */}
          <div style={{
            background: '#ffffff', borderRadius: '24px',
            border: '1px solid #e0e0e0', padding: '36px',
            textAlign: 'center', marginBottom: '28px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.05)',
          }}>
            {loading ? (
              <p style={{ fontSize: '16px', color: '#a0a0a5' }}>Loading…</p>
            ) : (
              <>
                <FlameIcon size={56} />
                <p style={{
                  fontFamily: SF, fontSize: '80px', fontWeight: 800,
                  color: '#1d1d1f', lineHeight: 1, margin: '16px 0 4px',
                  letterSpacing: '-2px',
                }}>
                  {streak?.currentStreak ?? 0}
                </p>
                <p style={{
                  fontSize: '18px', fontWeight: 600, color: '#7a7a7a',
                  fontFamily: SFT, marginBottom: '8px',
                }}>
                  day streak
                </p>
                {streak?.longestStreak > 0 && (
                  <p style={{ fontSize: '14px', color: '#a0a0a5', fontFamily: SFT }}>
                    Best: {streak.longestStreak} {streak.longestStreak === 1 ? 'day' : 'days'}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Action */}
          {!loading && (
            alreadyDone ? (
              <>
                <div style={{
                  background: '#EAF5FB', border: '1px solid #BFD9EA',
                  borderRadius: '14px', padding: '16px 20px',
                  textAlign: 'center', marginBottom: '20px',
                }}>
                  <p style={{ fontSize: '16px', color: '#3D8AB0', fontWeight: 600, fontFamily: SFT, margin: 0 }}>
                    You have already checked in today.
                  </p>
                  <p style={{ fontSize: '14px', color: '#7a7a7a', fontFamily: SFT, margin: '4px 0 0' }}>
                    See you again tomorrow. Keep it going!
                  </p>
                </div>
                <button
                  onClick={() => navigate('/dashboard')}
                  style={{
                    width: '100%', background: SKY, color: '#fff',
                    border: 'none', borderRadius: '9999px',
                    padding: '18px 0', fontSize: '18px', fontWeight: 700,
                    fontFamily: SFT, cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(79,163,206,0.3)',
                  }}
                >
                  Continue to Dashboard
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleCheckIn}
                  disabled={checking}
                  style={{
                    width: '100%', background: '#1d1d1f', color: '#fff',
                    border: 'none', borderRadius: '9999px',
                    padding: '22px 0', fontSize: '20px', fontWeight: 700,
                    fontFamily: SFT, cursor: checking ? 'default' : 'pointer',
                    marginBottom: '16px', letterSpacing: '-0.2px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    transition: 'opacity 0.15s',
                    opacity: checking ? 0.7 : 1,
                  }}
                >
                  {checking ? 'Marking you present…' : "I'm here today"}
                </button>
                <p style={{
                  textAlign: 'center', fontSize: '14px', color: '#a0a0a5',
                  fontFamily: SFT, lineHeight: 1.5,
                }}>
                  Tap the button to log today and keep your streak alive.
                </p>
              </>
            )
          )}

        </div>
      </div>
    </div>
  );
}
