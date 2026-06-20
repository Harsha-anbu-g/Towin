// Landing story — all copy for the / entry slides lives here.
// Landing.jsx renders SLIDES[index].render() inside the slide shell.
// Helpers here are hero-scale (bigger type than guideContent's card-scale).

const SFD = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SF = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const BLUE = '#3D8AB0';
const WASH = '#EAF5FB';
const BORDER = '#BFD9EA';

// ── Presentational helpers ───────────────────────────────────────────────

function Kicker({ children }) {
  return (
    <p style={{
      fontFamily: SF, fontSize: '13px', fontWeight: 600, color: BLUE,
      letterSpacing: '1.5px', textTransform: 'uppercase',
      textAlign: 'center', margin: '0 0 10px',
    }}>{children}</p>
  );
}

function Title({ children }) {
  return (
    <h1 className="landing-title" style={{
      fontFamily: SFD, fontSize: '46px', fontWeight: 600, color: '#1d1d1f',
      letterSpacing: '-0.5px', lineHeight: 1.1, textAlign: 'center',
      margin: '0 0 16px',
    }}>{children}</h1>
  );
}

function Lead({ children }) {
  return (
    <p className="landing-lead" style={{
      fontFamily: SF, fontSize: '21px', color: '#5a6470', lineHeight: 1.6,
      textAlign: 'center', maxWidth: '580px', margin: '0 auto 24px',
    }}>{children}</p>
  );
}

function Body({ children }) {
  return (
    <p style={{
      fontFamily: SF, fontSize: '18px', color: '#1d1d1f', lineHeight: 1.65,
      textAlign: 'center', maxWidth: '580px', margin: '0 auto 18px',
    }}>{children}</p>
  );
}

function MiniCard({ title, badge, stars, compact, children }) {
  return (
    <div style={{
      background: '#ffffff', border: `1px solid ${BORDER}`, borderRadius: compact ? '14px' : '18px',
      padding: compact ? '9px 14px' : '20px 22px', textAlign: 'left',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '8px', marginBottom: compact ? '3px' : '6px',
      }}>
        <p style={{ fontFamily: SFD, fontSize: compact ? '15px' : '18px', fontWeight: 600, color: BLUE, margin: 0 }}>
          {title}
        </p>
        {badge && (
          <span style={{
            fontFamily: SFD, fontSize: '12px', fontWeight: 700, color: BLUE,
            background: WASH, border: `1px solid ${BORDER}`, borderRadius: '9999px',
            padding: '2px 9px', whiteSpace: 'nowrap', flexShrink: 0,
          }}>{badge}</span>
        )}
      </div>
      {stars && (
        <div aria-label="five stars" style={{ display: 'flex', gap: '2px', marginBottom: compact ? '4px' : '8px' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} style={{ fontSize: compact ? '13px' : '16px', lineHeight: 1, color: BLUE }}>★</span>
          ))}
        </div>
      )}
      <p style={{ fontFamily: SF, fontSize: compact ? '13px' : '16px', color: '#5a6470', lineHeight: 1.5, margin: 0 }}>
        {children}
      </p>
    </div>
  );
}

// Shows the worked example — the three card badges add up to one clear total,
// so "Trust Score" stops being abstract: 3 + 7 + 5 = 15 points per person helped.
function ScoreSum() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: '10px', background: '#ffffff', border: `1px solid ${BORDER}`,
      borderRadius: '14px', padding: '11px 16px',
    }}>
      <span style={{ fontFamily: SFD, fontSize: '15px', fontWeight: 600, color: '#5a6470' }}>
        3 + 7 + 5 =
      </span>
      <span style={{ fontFamily: SFD, fontSize: '22px', fontWeight: 700, color: BLUE }}>15</span>
      <span style={{ fontFamily: SF, fontSize: '14px', color: '#5a6470' }}>points</span>
    </div>
  );
}

function CardGrid({ children }) {
  return (
    <div className="landing-cards" style={{
      display: 'grid', gap: '14px', maxWidth: '600px', margin: '0 auto',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    }}>{children}</div>
  );
}

// Vertical trust journey — one level passing to the next, the tortoise waiting
// at the top as the goal. Mirrors the tortoise track on the dashboards, but down.
function StageLadder({ stages }) {
  return (
    <div style={{ width: 'fit-content', maxWidth: '360px', margin: '0 auto' }}>
      {stages.map((s, i) => {
        const isLast = i === stages.length - 1;
        const size = isLast ? 44 : 34;
        return (
          <div key={s} style={{ display: 'flex', gap: '16px', alignItems: 'stretch' }}>
            {/* Rail: numbered node + connector line down to the next node.
                Fixed width so every node shares one vertical centre line. */}
            <div style={{ width: '44px', display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div style={{
                width: `${size}px`, height: `${size}px`, borderRadius: '50%',
                background: isLast ? '#ffffff' : WASH,
                border: isLast ? 'none' : `2px solid ${BORDER}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: SFD, fontSize: '15px', fontWeight: 700,
                color: BLUE, flexShrink: 0,
                boxShadow: isLast ? '0 4px 14px rgba(61,138,176,0.35)' : 'none',
              }}>
                {isLast
                  ? <img src="/logo.png" alt="ToWin" draggable="false"
                      style={{ width: 26, height: 26, objectFit: 'contain', transform: 'rotate(90deg)' }} />
                  : i + 1}
              </div>
              {!isLast && (
                <div style={{ flex: 1, width: '2px', minHeight: '16px', background: BORDER }} />
              )}
            </div>

            {/* Label, vertically centred on its node */}
            <div style={{
              minHeight: `${size}px`,
              display: 'flex', alignItems: 'center', gap: '10px',
              paddingBottom: isLast ? 0 : '16px',
            }}>
              <span style={{
                fontFamily: SF,
                fontSize: isLast ? '18px' : '16px',
                fontWeight: isLast ? 700 : 500,
                color: isLast ? BLUE : '#1d1d1f',
              }}>{s}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NoteBox({ children }) {
  return (
    <div style={{
      background: '#ffffff', border: '1px solid #e8e8ed',
      borderRadius: '14px', padding: '18px 22px', maxWidth: '580px',
      margin: '24px auto 0', fontFamily: SF, fontSize: '16px',
      color: '#5a6470', lineHeight: 1.6, textAlign: 'center',
    }}>{children}</div>
  );
}

// ── The 6 slides ─────────────────────────────────────────────────────────
// Each slide: { id, nextLabel?, render() }
// The shell shows nextLabel on the Next button (default "Next");
// on the last slide the shell shows the Start button instead.

export const SLIDES = [
  {
    id: 'welcome',
    nextLabel: 'See why →',
    render: () => (
      <>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '18px' }}>
          <img
            src="/tortoise-logo-alpha.png"
            alt="ToWin tortoise logo"
            style={{ width: 96, height: 96, objectFit: 'contain' }}
          />
        </div>
        <Title>ToWin</Title>
        <Lead>It takes two To Win.</Lead>
        <p style={{
          fontFamily: SFD, fontSize: '20px', fontWeight: 600, color: BLUE,
          textAlign: 'center', margin: '0 0 16px',
        }}>
          Connecting generations, building trust.
        </p>
        <Body>
          One who helps, one who gets help, and both win. A safer place for
          elders and helpers to meet, talk, and grow trust at their own pace.
        </Body>
      </>
    ),
  },
  {
    id: 'people',
    render: () => (
      <>
        <Kicker>Who it&apos;s for</Kicker>
        <Title>Two kinds of people</Title>
        <Lead>
          Everyone on ToWin is one of these two. You pick yours when you
          create your account.
        </Lead>
        <CardGrid>
          <MiniCard title="Elder">
            An older person looking for friendship, company, or help with daily tasks.
          </MiniCard>
          <MiniCard title="Helper">
            A younger person who gives time, company, and a hand with everyday things.
          </MiniCard>
        </CardGrid>
      </>
    ),
  },
  {
    id: 'solves',
    render: () => (
      <>
        <Kicker>The problem we solve</Kicker>
        <Title>Help is hard to find alone</Title>
        <Lead>
          Small daily things, like shopping, a ride, or someone to talk to, take
          energy that elders don&apos;t always have.
        </Lead>
        <Body>
          On ToWin, an elder simply asks. Helpers nearby see the request and
          come to help with whatever is needed.
        </Body>
      </>
    ),
  },
  {
    id: 'trust',
    wide: true,
    render: () => (
      <div className="landing-split" style={{ display: 'flex', alignItems: 'center', gap: '48px' }}>
        {/* Left: story */}
        <div className="landing-split-text" style={{ flex: 1, textAlign: 'left' }}>
          <p style={{
            fontFamily: SF, fontSize: '13px', fontWeight: 600, color: BLUE,
            letterSpacing: '1.5px', textTransform: 'uppercase', margin: '0 0 10px',
          }}>The real problem is trust</p>
          <h1 className="landing-title" style={{
            fontFamily: SFD, fontSize: '40px', fontWeight: 600, color: '#1d1d1f',
            letterSpacing: '-0.5px', lineHeight: 1.12, textAlign: 'left', margin: '0 0 16px',
          }}>
            <span style={{ color: '#9C7A3C' }}>Trust</span> is earned,<br />not given
          </h1>
          <p className="landing-lead" style={{
            fontFamily: SF, fontSize: '18px', color: '#5a6470', lineHeight: 1.55,
            textAlign: 'left', margin: '0 0 16px',
          }}>
            Letting someone new into your life is a big step. So every member
            has a Trust Score, visible to elders before they ever say yes.
          </p>
          <div style={{
            background: '#ffffff', border: '1px solid #e8e8ed',
            borderRadius: '12px', padding: '11px 16px', fontFamily: SF,
            fontSize: '14px', color: '#5a6470', lineHeight: 1.55, textAlign: 'left',
          }}>
            Each person helped adds up to <strong style={{ color: '#1d1d1f' }}>15 points</strong> to their score.
          </div>
        </div>

        {/* Right: three score cards + total */}
        <div style={{ flexShrink: 0, width: '280px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <MiniCard title="Profile" badge="+3" compact>
            Full profile with ID, phone, and photo, all checked.
          </MiniCard>
          <MiniCard title="Trust Ladder" badge="+7" compact>
            Points earned as a friendship grows step by step.
          </MiniCard>
          <MiniCard title="Review" badge="+5" stars compact>
            Star ratings from the people they have already helped.
          </MiniCard>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            background: '#ffffff', border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '7px 14px',
          }}>
            <span style={{ fontFamily: SFD, fontSize: '14px', fontWeight: 600, color: '#5a6470' }}>3 + 7 + 5 =</span>
            <span style={{ fontFamily: SFD, fontSize: '20px', fontWeight: 700, color: BLUE }}>15</span>
            <span style={{ fontFamily: SF, fontSize: '13px', color: '#5a6470' }}>points</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'rooting',
    wide: true,
    render: () => (
      <div className="landing-split" style={{
        display: 'flex', alignItems: 'center', gap: '48px',
      }}>
        {/* Left: the story */}
        <div className="landing-split-text" style={{ flex: 1, textAlign: 'left' }}>
          <p style={{
            fontFamily: SF, fontSize: '13px', fontWeight: 600, color: BLUE,
            letterSpacing: '1.5px', textTransform: 'uppercase', margin: '0 0 10px',
          }}>One step at a time</p>
          <h1 className="landing-title" style={{
            fontFamily: SFD, fontSize: '40px', fontWeight: 600, color: '#1d1d1f',
            letterSpacing: '-0.5px', lineHeight: 1.12, textAlign: 'left', margin: '0 0 16px',
          }}>
            Rooting (<span style={{ color: '#9C7A3C' }}>Trust</span> Ladder): how trust grows
          </h1>
          <p className="landing-lead" style={{
            fontFamily: SF, fontSize: '20px', color: '#5a6470', lineHeight: 1.6,
            textAlign: 'left', margin: '0 0 20px',
          }}>
            Like a tree growing roots, every friendship on ToWin grows slowly,
            through 7 simple stages.
          </p>
          <div style={{
            background: '#ffffff', border: '1px solid #e8e8ed',
            borderRadius: '14px', padding: '16px 20px', fontFamily: SF,
            fontSize: '15px', color: '#5a6470', lineHeight: 1.6, textAlign: 'left',
          }}>
            <strong>Both people must agree to every step.</strong> Nothing personal,
            like a phone number, is shared until trust has grown.
          </div>
        </div>

        {/* Right: the ladder */}
        <div style={{ flexShrink: 0 }}>
          <StageLadder stages={[
            'Just Connected', 'Messaging', 'Phone Ready', 'Video Ready',
            'Verified', 'Ready to Meet', 'Fully Trusted',
          ]} />
        </div>
      </div>
    ),
  },
  {
    id: 'why',
    render: () => (
      <>
        <Kicker>Why ToWin</Kicker>
        <Title>Both sides win</Title>
        <Body>
          Today&apos;s elders use phones, shop online, and pay online. Tomorrow
          there will be many more.
        </Body>
        <Body>
          But the hardest parts of growing older haven&apos;t changed:
          feeling lonely, and not having enough energy for everyday things.
        </Body>
        <NoteBox>
          Elders have <strong>time and money</strong>, but need energy and company.{' '}
          Helpers have <strong>energy and time</strong>, but need money and care.{' '}
          <strong>ToWin is where they meet and share, and both win.</strong>
        </NoteBox>
      </>
    ),
  },
];
