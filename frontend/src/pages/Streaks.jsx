import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import api from '../api/axios';
import { useToast } from '../context/useToast';

const SF  = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFT = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const SKY = 'var(--blue)';

function FlameIcon({ size = 56 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2C12 2 7 7 7 12.5C7 15.5 9 18 12 18C15 18 17 15.5 17 12.5C17 10 15.5 8 14 7C14 9 13 10 12 10C11 10 10 9 10 7.5C10 5.5 12 2 12 2Z"
        fill="var(--blue)" opacity="0.85"
      />
      <path
        d="M12 13C12 13 10.5 14.5 10.5 16C10.5 17.1 11.2 18 12 18C12.8 18 13.5 17.1 13.5 16C13.5 14.5 12 13 12 13Z"
        fill="var(--ink)" opacity="0.5"
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

      {/* Left — art panel (hidden on mobile). Column layout: the illustration
          fills the upper area, the tagline is a caption below it — never over it. */}
      <div className="streaks-left" style={{
        flex: '0 0 42%', position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        background: 'var(--surface-pearl)',
      }}>
        {/* Artwork area — contain (not cover) shows the whole illustration
            uncropped. The JPG's background is pure white (#fff) while the panel
            is pearl (#fbfaf6); multiply blending maps white onto the panel color
            exactly, so no rectangle edge shows regardless of the display panel. */}
        <div className="streaks-art" style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          <img src="/journey.jpg" alt="The master and his turtles, growing up together" className="streaks-tortoise" style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'contain', objectPosition: 'center bottom', zIndex: 0,
          }} />
          {/* Top edge melts into the page so the art has no hard border. */}
          <div className="streaks-fade" style={{
            position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
          }} />
        </div>
        {/* Tagline — a caption beneath the artwork, on its own pearl band. */}
        <p style={{
          margin: 0, padding: '20px 32px 40px', textAlign: 'center',
          fontFamily: SF, fontSize: 'var(--text-base)', fontWeight: 600,
          color: 'var(--steel-text)', letterSpacing: '-0.3px', lineHeight: 1.35,
          background: 'var(--surface-pearl)',
        }}>
          Slow is smooth and Smooth is fast and constant
        </p>
      </div>

      {/* Right — streak content */}
      <div className="streaks-right" style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-start',
        background: 'var(--surface-pearl)', padding: '28px 36px',
        maxHeight: '100svh', overflowY: 'auto',
      }}>
        {/* margin auto centers when there's room, but never clips when there isn't —
            the action buttons must stay reachable on every screen height. */}
        <div style={{ width: '100%', maxWidth: '420px', margin: 'auto 0' }}>

          {/* Greeting */}
          <p className="streaks-greeting" style={{
            fontSize: 'var(--text-base)', color: 'var(--ink-3)', fontFamily: SFT,
            marginBottom: '8px', fontWeight: 500,
          }}>
            {greeting()}
          </p>
          <h1 className="streaks-heading" style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 7vw, 40px)', fontWeight: 400,
            color: 'var(--ink)', letterSpacing: '-0.02em',
            marginBottom: '18px', lineHeight: 1.1,
          }}>
            {alreadyDone ? 'You showed up today.' : 'Ready to check in?'}
          </h1>

          {/* Streak card */}
          <div className="streak-card" style={{
            background: 'var(--canvas)', borderRadius: '18px',
            border: '1px solid var(--border)', padding: '26px 28px',
            textAlign: 'center', marginBottom: '18px',
          }}>
            {loading ? (
              <p style={{ fontSize: '16px', color: 'var(--ink-4)' }}>Loading…</p>
            ) : (
              <>
                <div style={{ display: 'inline-flex' }}>
                  <FlameIcon size={56} />
                </div>
                <p
                  key={justCheckedIn ? 'checked' : 'idle'}
                  className={`streak-number${justCheckedIn ? ' checkin-pop' : ''}`}
                  style={{
                    fontFamily: 'var(--font-display)', fontSize: '80px', fontWeight: 400,
                    color: 'var(--ink)', lineHeight: 1, margin: '16px 0 4px',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {streak?.currentStreak ?? 0}
                </p>
                <p style={{
                  fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--ink-3)',
                  fontFamily: SFT, marginBottom: '8px',
                }}>
                  days in a row
                </p>
                {/* Fixed slot, present in both states — checking in must never shift
                    the layout below (the jump read as broken). */}
                <p aria-live="polite" style={{
                  fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--green-deep)',
                  fontFamily: SFT, margin: '0 0 14px', minHeight: '20px',
                  opacity: justCheckedIn ? 1 : 0, transition: 'opacity 0.3s ease-out',
                }}>
                  Your streak is alive, see you tomorrow!
                </p>

                {/* Week tracker */}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  {week.map((d, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1 }}>
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--ink-4)', fontFamily: SFT }}>{d.label}</span>
                      <div className="streak-dot" style={{
                        width: '34px', height: '34px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: d.done ? SKY : 'var(--canvas)',
                        border: d.done ? 'none' : d.today ? `2px solid ${SKY}` : '1px solid var(--line-idle)',
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
          <div className="age-card" style={{
            background: 'var(--canvas)', borderRadius: '18px',
            border: '1px solid var(--border)', padding: '24px 28px',
            marginBottom: '28px',
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
                    background: 'none', border: '1.5px solid var(--border)',
                    borderRadius: '9999px', padding: '8px 20px',
                    fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--blue-deep)',
                    fontFamily: SFT, cursor: 'pointer',
                  }}
                >
                  Add date of birth →
                </button>
              </>
            )}
          </div>

          {/* Action — pinned to the panel's bottom edge while scrolling, so the
              way onward is always on screen (user report 2026-07-19). */}
          {!loading && (
            <div style={{ position: 'sticky', bottom: 0, background: 'var(--surface-pearl)', padding: '10px 0 6px' }}>
            {alreadyDone ? (
              /* Already checked in — show two options */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{
                  background: 'var(--green-tint)', border: '1px solid var(--green-line)',
                  borderRadius: '14px', padding: '14px 20px',
                  textAlign: 'center',
                }}>
                  <p style={{ fontSize: '16px', color: 'var(--green-deep)', fontWeight: 600, fontFamily: SFT, margin: 0 }}>
                    ✓ You have already checked in today.
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
                    width: '100%', background: 'var(--canvas)', color: 'var(--ink)',
                    border: '1.5px solid var(--border)', borderRadius: '9999px',
                    padding: '16px 0', fontSize: '16px', fontWeight: 600,
                    fontFamily: SFT, cursor: 'pointer',
                  }}
                >
                  Play the game
                </button>
              </div>
            ) : (
              /* Not checked in yet: min-height matches the checked-in stack above so
                 the page holds still when the state swaps. */
              <div style={{ minHeight: '214px' }}>
                <button
                  onClick={handleCheckIn}
                  disabled={checkingIn}
                  style={{
                    width: '100%', background: SKY, color: '#fff',
                    border: 'none', borderRadius: '9999px',
                    padding: '22px 0', fontSize: '20px', fontWeight: 600,
                    fontFamily: SFT, cursor: checkingIn ? 'not-allowed' : 'pointer',
                    letterSpacing: '-0.2px',
                    boxShadow: '0 2px 10px rgba(79,163,206,0.22)',
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
                      textDecoration: 'underline', padding: '10px 8px',
                      minHeight: '44px', // elderly-first tap-target floor
                    }}
                  >
                    Skip for now, go to dashboard
                  </button>
                </div>
              </div>
            )}
            </div>
          )}

        </div>
      </div>
      </div>
    </div>
  );
}
