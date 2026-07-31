import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import StreakCard from '../components/StreakCard';
import CheckInFamilyNote from '../components/CheckInFamilyNote';
import api from '../api/axios';
import { useToast } from '../context/useToast';

const SF  = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFT = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const SKY = 'var(--blue)';

// The check-in button and the "already done" row swap places in the same slot.
// Holding one height across both stops the page jumping under a tapping thumb.
const ACTION_SLOT_MIN_HEIGHT = '68px';

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

/**
 * The daily check-in. Elder-only (see ElderOnly on the /streaks route): a
 * helper has nobody waiting to hear they are alright, so they have no check-in.
 *
 * The page leads with the reason rather than the score. Tapping "I'm here
 * today" is what puts "All looks well — Margaret checked in today" on her
 * family's own page, and she should be able to see that is what she is doing.
 * The streak sits underneath: the reward, not the reason.
 */
export default function Streaks() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [streak, setStreak] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dob, setDob] = useState(null);
  const [familyNames, setFamilyNames] = useState([]);

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

  // Who sees this check-in. Only the links where she sits in the elder seat —
  // the family she watches over herself are on the other side and see nothing.
  // A failure here leaves the list empty, which shows the invitation instead;
  // the check-in itself must never wait on this call.
  useEffect(() => {
    api.get('/family/links')
      .then(r => setFamilyNames(
        (r.data?.activeLinks || [])
          .filter(l => l.iAmElder)
          .map(l => l.otherUserName)
          .filter(Boolean)
      ))
      .catch(() => {});
  }, []);

  const [checkingIn, setCheckingIn] = useState(false);
  const [justCheckedIn, setJustCheckedIn] = useState(false);
  const alreadyDone = streak?.alreadyCheckedIn || justCheckedIn;

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

      {/* Right — the check-in */}
      <div className="streaks-right" style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-start',
        background: 'var(--surface-pearl)', padding: '28px 36px',
      }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>

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
            marginBottom: '20px', lineHeight: 1.15,
          }}>
            {alreadyDone
              ? "Your family knows you're alright today."
              : "Let your family know you're alright."}
          </h1>

          {/* The one thing this page asks for, and who it reaches. */}
          {!loading && (
            <div style={{ marginBottom: '22px' }}>
              {alreadyDone ? (
                <div style={{
                  minHeight: ACTION_SLOT_MIN_HEIGHT,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  border: '1.5px solid var(--green-line)', borderRadius: '9999px',
                  padding: '14px 20px',
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--green-deep)"
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span style={{ fontSize: '17px', color: 'var(--green-deep)', fontWeight: 600, fontFamily: SFT }}>
                    You checked in today
                  </span>
                </div>
              ) : (
                <button
                  onClick={handleCheckIn}
                  disabled={checkingIn}
                  style={{
                    width: '100%', minHeight: ACTION_SLOT_MIN_HEIGHT,
                    background: SKY, color: '#fff',
                    border: 'none', borderRadius: '9999px',
                    padding: '20px 0', fontSize: '20px', fontWeight: 600,
                    fontFamily: SFT, cursor: checkingIn ? 'not-allowed' : 'pointer',
                    letterSpacing: '-0.2px',
                    boxShadow: '0 2px 10px rgba(79,163,206,0.22)',
                    opacity: checkingIn ? 0.7 : 1,
                  }}
                >
                  {checkingIn ? 'Checking in…' : "I'm here today"}
                </button>
              )}
              <CheckInFamilyNote names={familyNames} checkedIn={alreadyDone} />
            </div>
          )}

          {/* The run of days behind it — the reward, not the reason. */}
          <StreakCard streak={streak} loading={loading} justCheckedIn={justCheckedIn} />

          {/* Age display */}
          <div className="age-card" style={{
            background: 'var(--canvas)', borderRadius: '18px',
            border: '1px solid var(--border)', padding: '24px 28px',
            marginBottom: '24px',
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

          {/* Where to next. Below everything: the day's question is already
              answered by this point. */}
          {!loading && (
            alreadyDone ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
              <div style={{ textAlign: 'center' }}>
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
            )
          )}

        </div>
      </div>
      </div>
    </div>
  );
}
