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

function computeAge(dobStr) {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  const now = new Date();

  const totalDays = Math.floor((now - dob) / (1000 * 60 * 60 * 24));

  let years = now.getFullYear() - dob.getFullYear();
  let months = now.getMonth() - dob.getMonth();
  let days = now.getDate() - dob.getDate();

  if (days < 0) {
    months -= 1;
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return { totalDays, years, months, days };
}

export default function Streaks() {
  const navigate = useNavigate();
  const [streak, setStreak] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dob, setDob] = useState(null);
  useEffect(() => {
    api.get('/streaks/me')
      .then(r => setStreak(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    api.get('/profile/me')
      .then(r => setDob(r.data.dateOfBirth))
      .catch(() => {});
  }, []);

  const [checkingIn, setCheckingIn] = useState(false);
  const [justCheckedIn, setJustCheckedIn] = useState(false);
  const alreadyDone = streak?.alreadyCheckedIn || justCheckedIn;

  async function handleCheckIn() {
    setCheckingIn(true);
    try {
      const r = await api.post('/streaks/checkin');
      setStreak(r.data);
      setJustCheckedIn(true);
    } catch {
      // already checked in or error — still reveal options
      setJustCheckedIn(true);
    } finally {
      setCheckingIn(false);
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100svh', fontFamily: SFT }}>

      {/* Left — image panel (hidden on mobile) */}
      <div className="streaks-left" style={{
        flex: '0 0 42%', position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        padding: '52px 48px', minHeight: '100svh',
      }}>
        {/* Logo top-left */}
        <div style={{
          position: 'absolute', top: '32px', left: '48px', zIndex: 2,
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <img src="/logo.png" alt="ToWin logo" style={{ width: 40, height: 40, objectFit: 'contain' }} />
          <p style={{
            fontSize: '22px', fontWeight: 800, color: '#1a5c2e', letterSpacing: '-0.4px',
            fontFamily: SF, margin: 0,
          }}>ToWin</p>
        </div>
        <img src="/journey.jpg" alt="" style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover', zIndex: 0,
        }} />
      </div>

      {/* Right — streak content */}
      <div className="streaks-right" style={{
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
            fontFamily: SF, fontSize: 'clamp(28px, 7vw, 40px)', fontWeight: 700,
            color: '#1d1d1f', letterSpacing: '-0.6px',
            marginBottom: '32px', lineHeight: 1.1,
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

          {/* Age display */}
          <div style={{
            background: '#ffffff', borderRadius: '20px',
            border: '1px solid #e0e0e0', padding: '24px 28px',
            marginBottom: '28px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
          }}>
            {dob && computeAge(dob) ? (() => {
              const age = computeAge(dob);
              return (
                <>
                  <p style={{
                    fontFamily: SF, fontSize: '40px', fontWeight: 800,
                    color: '#1a5c2e', lineHeight: 1, margin: '0 0 6px',
                    letterSpacing: '-1px',
                  }}>
                    {age.totalDays.toLocaleString()}
                  </p>
                  <p style={{
                    fontSize: '15px', fontWeight: 600, color: '#7a7a7a',
                    fontFamily: SFT, margin: '0 0 10px',
                  }}>
                    days you have lived
                  </p>
                  <p style={{
                    fontSize: '14px', color: '#a0a0a5', fontFamily: SFT, margin: 0,
                  }}>
                    {age.years} {age.years === 1 ? 'year' : 'years'},{' '}
                    {age.months} {age.months === 1 ? 'month' : 'months'},{' '}
                    {age.days} {age.days === 1 ? 'day' : 'days'} old
                  </p>
                </>
              );
            })() : (
              <>
                <p style={{
                  fontFamily: SF, fontSize: '18px', fontWeight: 700,
                  color: '#1d1d1f', margin: '0 0 6px',
                }}>
                  How many days have you lived?
                </p>
                <p style={{ fontSize: '14px', color: '#a0a0a5', fontFamily: SFT, margin: '0 0 14px' }}>
                  Add your date of birth in your profile to see your life in days.
                </p>
                <button
                  onClick={() => navigate('/profile')}
                  style={{
                    background: 'none', border: '1.5px solid #e0e0e0',
                    borderRadius: '9999px', padding: '8px 20px',
                    fontSize: '14px', fontWeight: 600, color: '#4FA3CE',
                    fontFamily: SFT, cursor: 'pointer',
                  }}
                >
                  Add date of birth →
                </button>
              </>
            )}
          </div>

          {/* Action */}
          {!loading && (
            alreadyDone ? (
              /* Already checked in — show two options */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{
                  background: '#f5f5f7', border: '1px solid #e0e0e0',
                  borderRadius: '14px', padding: '14px 20px',
                  textAlign: 'center',
                }}>
                  <p style={{ fontSize: '15px', color: '#5a6470', fontWeight: 600, fontFamily: SFT, margin: 0 }}>
                    You have already checked in today.
                  </p>
                  <p style={{ fontSize: '13px', color: '#a0a0a5', fontFamily: SFT, margin: '4px 0 0' }}>
                    See you again tomorrow. Keep it going!
                  </p>
                </div>
                <button
                  onClick={() => navigate('/dashboard')}
                  style={{
                    width: '100%', background: SKY, color: '#fff',
                    border: 'none', borderRadius: '9999px',
                    padding: '18px 0', fontSize: '17px', fontWeight: 700,
                    fontFamily: SFT, cursor: 'pointer',
                  }}
                >
                  Continue to Dashboard
                </button>
                <button
                  onClick={() => navigate('/game')}
                  style={{
                    width: '100%', background: '#ffffff', color: '#1d1d1f',
                    border: '1.5px solid #e0e0e0', borderRadius: '9999px',
                    padding: '16px 0', fontSize: '16px', fontWeight: 600,
                    fontFamily: SFT, cursor: 'pointer',
                  }}
                >
                  Play the game
                </button>
              </div>
            ) : (
              /* Not checked in yet — single button */
              <>
                <button
                  onClick={handleCheckIn}
                  disabled={checkingIn}
                  style={{
                    width: '100%', background: '#1d1d1f', color: '#fff',
                    border: 'none', borderRadius: '9999px',
                    padding: '22px 0', fontSize: '20px', fontWeight: 700,
                    fontFamily: SFT, cursor: checkingIn ? 'not-allowed' : 'pointer',
                    letterSpacing: '-0.2px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    opacity: checkingIn ? 0.7 : 1,
                  }}
                >
                  {checkingIn ? 'Checking in…' : "I'm here today"}
                </button>
                <p style={{ textAlign: 'center', fontSize: '14px', color: '#a0a0a5', fontFamily: SFT, lineHeight: 1.5, marginTop: '12px' }}>
                  Tap to log today and keep your streak alive.
                </p>
              </>
            )
          )}

        </div>
      </div>
    </div>
  );
}
