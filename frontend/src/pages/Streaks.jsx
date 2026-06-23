import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

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

// Build the Monday–Sunday week containing today, marking which days fall inside
// the current consecutive streak. Derived from currentStreak + lastCheckinDate
// since the backend keeps no per-day history.
function buildWeek(streak) {
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const mondayOffset = (today.getDay() + 6) % 7; // days since Monday
  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayOffset);

  const current = streak?.currentStreak ?? 0;
  const last = streak?.lastCheckinDate ? new Date(`${streak.lastCheckinDate}T00:00:00`) : null;
  let runStart = null;
  if (last && current > 0) {
    runStart = new Date(last);
    runStart.setDate(last.getDate() - (current - 1));
  }

  return labels.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const isFuture = d > today;
    const isToday = d.getTime() === today.getTime();
    const done = !!(runStart && last && d >= runStart && d <= last && !isFuture);
    return { label, done, today: isToday && !done, future: isFuture };
  });
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
  const { toast } = useToast();
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
  const week = buildWeek(streak);

  async function handleCheckIn() {
    setCheckingIn(true);
    try {
      // The backend returns 200 with alreadyCheckedIn=true for a same-day repeat,
      // so a real exception here means the check-in genuinely failed.
      const r = await api.post('/streaks/checkin');
      setStreak(r.data);
      setJustCheckedIn(true);
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
        'Could not check in. Please try again.'
      );
    } finally {
      setCheckingIn(false);
    }
  }

  return (
    <div style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column', background: 'var(--surface-pearl)', fontFamily: SFT }}>
      <NavBar />
      <div style={{ flex: 1, display: 'flex' }}>

      {/* Left — art panel (hidden on mobile) */}
      <div className="streaks-left" style={{
        flex: '0 0 42%', position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--surface-pearl)',
      }}>
        <img src="/journey.jpg" alt="" style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover', zIndex: 0,
        }} />
        {/* Edges melt into the page; the art's white middle band keeps the
            centered tagline clear of any figures. */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background:
            'linear-gradient(to bottom, #fafafc 0%, rgba(250,250,252,0) 15%),' +
            'linear-gradient(to top, #fafafc 0%, rgba(250,250,252,0) 15%)',
        }} />
        {/* Tagline centered in the art's clear middle band */}
        <div style={{ position: 'relative', zIndex: 2, padding: '24px', textAlign: 'center', transform: 'translateY(-30px)' }}>
          <h2 style={{
            fontFamily: SF, fontSize: 'var(--text-lg)', fontWeight: 600, color: '#9a9da4',
            letterSpacing: '-0.3px', margin: 0, lineHeight: 1.3, whiteSpace: 'nowrap',
          }}>
            Slow is smooth and Smooth is fast and constant
          </h2>
        </div>
      </div>

      {/* Right — streak content */}
      <div className="streaks-right" style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--surface-pearl)', padding: '48px 40px',
      }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>

          {/* Greeting */}
          <p style={{
            fontSize: 'var(--text-base)', color: 'var(--ink-3)', fontFamily: SFT,
            marginBottom: '8px', fontWeight: 500,
          }}>
            {greeting()}
          </p>
          <h1 style={{
            fontFamily: SF, fontSize: 'clamp(28px, 7vw, 40px)', fontWeight: 600,
            color: 'var(--ink)', letterSpacing: '-0.6px',
            marginBottom: '32px', lineHeight: 1.1,
          }}>
            {alreadyDone ? 'You showed up today.' : 'Ready to check in?'}
          </h1>

          {/* Streak card */}
          <div style={{
            background: '#ffffff', borderRadius: '18px',
            border: '1px solid #e0e0e0', padding: '36px',
            textAlign: 'center', marginBottom: '28px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.05)',
          }}>
            {loading ? (
              <p style={{ fontSize: '16px', color: 'var(--ink-4)' }}>Loading…</p>
            ) : (
              <>
                <FlameIcon size={56} />
                <p style={{
                  fontFamily: SF, fontSize: '80px', fontWeight: 600,
                  color: 'var(--ink)', lineHeight: 1, margin: '16px 0 4px',
                  letterSpacing: '-2px',
                }}>
                  {streak?.currentStreak ?? 0}
                </p>
                <p style={{
                  fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--ink-3)',
                  fontFamily: SFT, marginBottom: '22px',
                }}>
                  days in a row
                </p>

                {/* Week tracker */}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  {week.map((d, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1 }}>
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--ink-4)', fontFamily: SFT }}>{d.label}</span>
                      <div style={{
                        width: '34px', height: '34px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: d.done ? SKY : '#fff',
                        border: d.done ? 'none' : d.today ? `2px solid ${SKY}` : '1px solid #e6e8ec',
                        opacity: d.future ? 0.6 : 1,
                      }}>
                        {d.done && (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                        {d.today && (
                          <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: SKY }} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {streak?.longestStreak > 0 && (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-4)', fontFamily: SFT, margin: '18px 0 0' }}>
                    Best streak: {streak.longestStreak} {streak.longestStreak === 1 ? 'day' : 'days'}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Age display */}
          <div style={{
            background: '#ffffff', borderRadius: '18px',
            border: '1px solid #e0e0e0', padding: '24px 28px',
            marginBottom: '28px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
          }}>
            {dob && computeAge(dob) ? (() => {
              const age = computeAge(dob);
              return (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                  <div>
                    <p style={{
                      fontFamily: SF, fontSize: 'var(--text-2xl)', fontWeight: 600,
                      color: 'var(--green-deep)', lineHeight: 1, margin: '0 0 6px',
                      letterSpacing: '-1px',
                    }}>
                      {age.totalDays.toLocaleString()}
                    </p>
                    <p style={{
                      fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink-3)',
                      fontFamily: SFT, margin: 0,
                    }}>
                      days you have lived
                    </p>
                  </div>
                  <span style={{
                    fontSize: '14px', color: 'var(--ink-4)', fontFamily: SFT,
                    textAlign: 'right', lineHeight: 1.5, flexShrink: 0,
                  }}>
                    {age.years} {age.years === 1 ? 'year' : 'years'},<br />
                    {age.months} {age.months === 1 ? 'month' : 'months'},{' '}
                    {age.days} {age.days === 1 ? 'day' : 'days'} old
                  </span>
                </div>
              );
            })() : (
              <>
                <p style={{
                  fontFamily: SF, fontSize: 'var(--text-base)', fontWeight: 600,
                  color: 'var(--ink)', margin: '0 0 6px',
                }}>
                  How many days have you lived?
                </p>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-4)', fontFamily: SFT, margin: '0 0 14px' }}>
                  Add your date of birth in your profile to see your life in days.
                </p>
                <button
                  onClick={() => navigate('/profile')}
                  style={{
                    background: 'none', border: '1.5px solid #e0e0e0',
                    borderRadius: '9999px', padding: '8px 20px',
                    fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--blue)',
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
                  background: 'var(--surface)', border: '1px solid #e0e0e0',
                  borderRadius: '14px', padding: '14px 20px',
                  textAlign: 'center',
                }}>
                  <p style={{ fontSize: '16px', color: 'var(--ink-slate)', fontWeight: 600, fontFamily: SFT, margin: 0 }}>
                    You have already checked in today.
                  </p>
                  <p style={{ fontSize: '14px', color: 'var(--ink-4)', fontFamily: SFT, margin: '4px 0 0' }}>
                    See you again tomorrow. Keep it going!
                  </p>
                </div>
                <button
                  onClick={() => navigate('/dashboard')}
                  style={{
                    width: '100%', background: SKY, color: '#fff',
                    border: 'none', borderRadius: '9999px',
                    padding: '18px 0', fontSize: '17px', fontWeight: 600,
                    fontFamily: SFT, cursor: 'pointer',
                  }}
                >
                  Continue to Dashboard
                </button>
                <button
                  onClick={() => navigate('/game')}
                  style={{
                    width: '100%', background: '#ffffff', color: 'var(--ink)',
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
                    width: '100%', background: SKY, color: '#fff',
                    border: 'none', borderRadius: '9999px',
                    padding: '22px 0', fontSize: '20px', fontWeight: 600,
                    fontFamily: SFT, cursor: checkingIn ? 'not-allowed' : 'pointer',
                    letterSpacing: '-0.2px',
                    boxShadow: '0 4px 20px rgba(79,163,206,0.35)',
                    opacity: checkingIn ? 0.7 : 1,
                  }}
                >
                  {checkingIn ? 'Checking in…' : "I'm here today"}
                </button>
                <p style={{ textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--ink-4)', fontFamily: SFT, lineHeight: 1.5, marginTop: '12px' }}>
                  Tap to log today and keep your streak alive.
                </p>
                <div style={{ textAlign: 'center', marginTop: '8px' }}>
                  <button
                    onClick={() => navigate('/dashboard')}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '16px', color: 'var(--ink-3)', fontFamily: SFT,
                      textDecoration: 'underline', padding: '8px',
                    }}
                  >
                    Skip for now, go to dashboard
                  </button>
                </div>
              </>
            )
          )}

        </div>
      </div>
      </div>
    </div>
  );
}
