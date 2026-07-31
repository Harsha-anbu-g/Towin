const SFT = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const SKY = 'var(--blue)';

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

/**
 * The run of days behind a check-in. Sits BELOW the button and the family note:
 * keeping a streak is the reward, not the reason — the reason is that her
 * family get to see she is alright.
 *
 * There is deliberately no flame here. A burning flame is the wrong picture for
 * a signal that means "I am well", and it was the loudest thing on the page.
 */
export default function StreakCard({ streak, loading, justCheckedIn }) {
  const week = buildWeek(streak);

  return (
    <div className="streak-card" style={{
      background: 'var(--canvas)', borderRadius: '18px',
      border: '1px solid var(--border)', padding: '22px 28px',
      textAlign: 'center', marginBottom: '18px',
    }}>
      {loading ? (
        <p style={{ fontSize: '16px', color: 'var(--ink-4)' }}>Loading…</p>
      ) : (
        <>
          <p
            key={justCheckedIn ? 'checked' : 'idle'}
            className={`streak-number${justCheckedIn ? ' checkin-pop' : ''}`}
            style={{
              fontFamily: 'var(--font-display)', fontSize: '56px', fontWeight: 400,
              color: 'var(--ink)', lineHeight: 1, margin: '0 0 4px',
              letterSpacing: '-0.02em',
            }}
          >
            {streak?.currentStreak ?? 0}
          </p>
          <p style={{
            fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--ink-3)',
            fontFamily: SFT, marginBottom: '16px',
          }}>
            days in a row
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
  );
}
