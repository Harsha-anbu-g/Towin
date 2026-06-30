// Landing story — all copy for the / entry slides lives here.
// Landing.jsx renders SLIDES[index].render() inside the slide shell.
// Helpers here are hero-scale (bigger type than guideContent's card-scale).

import { FlipFadeText } from '../components/ui/flip-fade-text';

const SFD = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SF = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const BLUE = '#3D8AB0';
const WASH = '#EAF5FB';
const BORDER = '#BFD9EA';

// ── Presentational helpers ───────────────────────────────────────────────

function Kicker({ children, align = 'center' }) {
  return (
    <p style={{
      fontFamily: SF, fontSize: '14px', fontWeight: 600, color: BLUE,
      letterSpacing: '1.5px', textTransform: 'uppercase',
      textAlign: align, margin: '0 0 10px',
    }}>{children}</p>
  );
}

function Title({ children, align = 'center' }) {
  return (
    <h1 className="landing-title" style={{
      fontFamily: SFD, fontSize: '46px', fontWeight: 600, color: 'var(--ink)',
      letterSpacing: '-0.5px', lineHeight: 1.1, textAlign: align,
      margin: '0 0 16px',
    }}>{children}</h1>
  );
}

function Lead({ children, align = 'center' }) {
  const left = align === 'left';
  return (
    <p className="landing-lead" style={{
      fontFamily: SF, fontSize: '21px', color: 'var(--ink-slate)', lineHeight: 1.6,
      textAlign: align, maxWidth: left ? 'none' : '580px',
      margin: left ? '0 0 16px' : '0 auto 24px',
    }}>{children}</p>
  );
}

function Body({ children }) {
  return (
    <p style={{
      fontFamily: SF, fontSize: 'var(--text-base)', color: 'var(--ink)', lineHeight: 1.65,
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
            fontFamily: SFD, fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--trust-gold)',
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
      <p style={{ fontFamily: SF, fontSize: compact ? '13px' : '16px', color: 'var(--ink-slate)', lineHeight: 1.5, margin: 0 }}>
        {children}
      </p>
    </div>
  );
}

// Marks a group of cards as illustration, not the live app — so people stop
// tapping the mockups expecting them to open. Muted + dashed on purpose, so it
// reads as a label, not as one of the gold trust badges.
function ExampleTag({ align = 'center' }) {
  return (
    <div style={{ display: 'flex', justifyContent: align === 'left' ? 'flex-start' : 'center', marginBottom: '10px' }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        fontFamily: SF, fontSize: '12px', fontWeight: 600, color: 'var(--ink-4)',
        background: 'rgba(0,0,0,0.03)', border: '1px dashed #cdd6dd',
        borderRadius: '9999px', padding: '4px 11px', letterSpacing: '0.4px',
        textTransform: 'uppercase',
      }}>
        Just an example
      </span>
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
      <span style={{ fontFamily: SFD, fontSize: '16px', fontWeight: 600, color: 'var(--ink-slate)' }}>
        3 + 7 + 5 =
      </span>
      <span style={{ fontFamily: SFD, fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--trust-gold)' }}>15</span>
      <span style={{ fontFamily: SF, fontSize: 'var(--text-sm)', color: 'var(--ink-slate)' }}>points</span>
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

// Vertical trust journey — read top to bottom: the first step sits at the top
// and the eye walks down the ladder to the goal, "Fully Trusted", at the bottom.
// Each step is worth +1 (seven steps → +7, matching the Trust Ladder card).
function StageLadder({ stages }) {
  // Given in journey order (first step → goal); render in order so the goal lands last.
  const ordered = stages;
  return (
    <div style={{ width: 'fit-content', maxWidth: '360px', margin: '0 auto' }}>
      {ordered.map((s, i) => {
        const isGoal = i === ordered.length - 1;
        const isBottom = i === ordered.length - 1;
        const size = isGoal ? 44 : 34;
        return (
          <div key={s} style={{ display: 'flex', gap: '16px', alignItems: 'stretch' }}>
            {/* Rail: node + connector line down to the next node.
                Fixed width so every node shares one vertical centre line. */}
            <div style={{ width: '44px', display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div style={{
                width: `${size}px`, height: `${size}px`, borderRadius: '50%',
                background: isGoal ? '#ffffff' : WASH,
                border: isGoal ? 'none' : `2px solid ${BORDER}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: SFD, fontSize: '16px', fontWeight: 700,
                color: BLUE, flexShrink: 0,
                boxShadow: isGoal ? '0 4px 14px rgba(61,138,176,0.35)' : 'none',
              }}>
                {isGoal
                  ? <img src="/logo.png" alt="ToWin" draggable="false"
                      style={{ width: 26, height: 26, objectFit: 'contain', transform: 'rotate(90deg)' }} />
                  : i + 1}
              </div>
              {!isBottom && (
                <div style={{ flex: 1, width: '2px', minHeight: '10px', background: BORDER }} />
              )}
            </div>

            {/* Label, vertically centred on its node */}
            <div style={{
              minHeight: `${size}px`,
              display: 'flex', alignItems: 'center', gap: '10px',
              paddingBottom: isBottom ? 0 : '13px',
            }}>
              <span style={{
                fontFamily: SF,
                fontSize: isGoal ? '19px' : '17px',
                fontWeight: isGoal ? 700 : 500,
                color: isGoal ? BLUE : '#1d1d1f',
              }}>{s}</span>
              {/* Every step is worth one trust point */}
              <span style={{
                fontFamily: SFD, fontSize: 'var(--text-xs)', fontWeight: 700, color: BLUE,
                background: WASH, border: `1px solid ${BORDER}`, borderRadius: '9999px',
                padding: '2px 9px', whiteSpace: 'nowrap', flexShrink: 0,
              }}><span style={{ color: 'var(--trust-gold)' }}>+1</span> trust score</span>
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
      color: 'var(--ink-slate)', lineHeight: 1.6, textAlign: 'center',
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
        <Title>
          {/* One word, so it flips + fades in once and stays — the wordmark. */}
          <FlipFadeText words={['ToWin']} />
        </Title>
        <Lead>It takes two To Win.</Lead>
        {/* Cycling verb — simple words already in the copy below (meet, talk, help, grow). */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '8px', margin: '0 0 16px',
        }}>
          <span style={{ fontFamily: SFD, fontSize: '20px', fontWeight: 600, color: 'var(--ink-slate)' }}>
            A place to
          </span>
          <span style={{
            fontFamily: SFD, fontSize: '20px', fontWeight: 600, color: BLUE,
            minWidth: '72px', display: 'inline-flex', justifyContent: 'flex-start',
          }}>
            <FlipFadeText words={['Meet', 'Talk', 'Help', 'Grow']} interval={2000} />
          </span>
        </div>
        <p style={{
          fontFamily: SFD, fontSize: '20px', fontWeight: 600, color: BLUE,
          textAlign: 'center', margin: '0 0 16px',
        }}>
          Connecting generations, building <span style={{ color: 'var(--trust-gold)' }}>trust</span>.
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
        <ExampleTag />
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
          <Kicker align="left">The real problem is trust</Kicker>
          <Title align="left">
            <span style={{ color: 'var(--trust-gold)' }}>Trust</span> is earned,<br />not given
          </Title>
          <Lead align="left">
            Letting someone new into your life is a big step. So every member
            has a <span style={{ color: 'var(--trust-gold)', fontWeight: 600 }}>Trust Score</span>, visible to elders before they ever say yes.
          </Lead>
          <div style={{
            background: '#ffffff', border: '1px solid #e8e8ed',
            borderRadius: '12px', padding: '11px 16px', fontFamily: SF,
            fontSize: '16px', color: 'var(--ink-slate)', lineHeight: 1.55, textAlign: 'left',
          }}>
            Each person you help can earn you a <strong style={{ color: 'var(--ink)' }}>maximum of 15 points</strong> &mdash; so your score grows with every new connection.
          </div>
        </div>

        {/* Right: three score cards + total */}
        <div style={{ flexShrink: 0, width: '280px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <ExampleTag />
          <MiniCard title="Profile" badge="+3" compact>
            Full profile with ID, phone, and photo, all checked.
          </MiniCard>
          <MiniCard title="Trust Ladder" badge="+7" compact>
            With each new person you climb the same seven steps &mdash; points earned as that friendship grows.
          </MiniCard>
          <MiniCard title="Review" badge="+5" stars compact>
            Star ratings from the people they have already helped.
          </MiniCard>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            background: '#ffffff', border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '7px 14px',
          }}>
            <span style={{ fontFamily: SFD, fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink-slate)' }}>3 + 7 + 5 =</span>
            <span style={{ fontFamily: SFD, fontSize: '20px', fontWeight: 700, color: BLUE }}>15</span>
            <span style={{ fontFamily: SF, fontSize: '14px', color: 'var(--ink-slate)' }}>points per connection</span>
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
          <Kicker align="left">One step at a time</Kicker>
          <Title align="left">
            Rooting (<span style={{ color: 'var(--trust-gold)' }}>Trust</span> Ladder): how trust grows
          </Title>
          <Lead align="left">
            Like a tree growing roots, every friendship on ToWin grows slowly,
            through 7 simple stages.
          </Lead>
          <div style={{
            background: '#ffffff', border: '1px solid #e8e8ed',
            borderRadius: '14px', padding: '16px 20px', fontFamily: SF,
            fontSize: '16px', color: 'var(--ink-slate)', lineHeight: 1.6, textAlign: 'left',
          }}>
            <strong>Both people must agree to every step.</strong> Nothing personal,
            like a phone number, is shared until trust has grown.
          </div>
        </div>

        {/* Right: the ladder */}
        <div style={{ flexShrink: 0 }}>
          <ExampleTag />
          <StageLadder stages={[
            'Just Connected', 'Messaging', 'Phone Ready', 'Video Ready',
            'Social Media', 'Ready to Meet', 'Fully Trusted',
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
