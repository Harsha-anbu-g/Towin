// Landing story — all copy for the / entry slides lives here.
// Landing.jsx renders SLIDES[index].render() inside the slide shell.
//
// Design system ("The Patient Path"): the six slides read as a guided, numbered
// walk — one step at a time, the way trust grows on ToWin. Each slide is anchored
// by a Chapter marker (0N · label); the shell echoes it as a trail in the footer.
//
// Typography carries the redesign: Newsreader (serif) at weight 400 for the big
// headings + the tagline, SF Pro for body. Warm canvas, warm hairline borders,
// no drop shadows. Sky-blue is reserved for actions (buttons, the trail); gold
// stays for "trust" words. Copy is deliberately plain (elder-first).


const SERIF = `'Newsreader', Georgia, 'Times New Roman', serif`;  // headings + tagline, weight 400
const SANS  = `-apple-system, 'SF Pro Display', system-ui, sans-serif`; // wordmark, labels, UI numerals
const SF    = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;    // body

const INK   = 'var(--ink)';
const SLATE = 'var(--ink-slate)';
const FAINT = 'var(--ink-4)';
const HAIR  = 'var(--border)';   // warm hairline for structural card borders
const BLUE  = '#3D8AB0';         // interactive/semantic only
const SKY   = '#4FA3CE';
const WASH  = '#EAF5FB';         // sky wash — trust chips only
const SKYLINE = '#BFD9EA';       // sky hairline — trust chips only
const GOLD  = 'var(--trust-gold)';

// ── Presentational helpers ───────────────────────────────────────────────

// Chapter marker — the page's structural signature. A tabular numeral + hairline
// + a quiet label reads as wayfinding on a genuine 6-step sequence (not a
// decorative eyebrow). Kept neutral so sky-blue stays reserved for actions.
function Chapter({ n, label, align = 'left' }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '13px',
      justifyContent: align === 'center' ? 'center' : 'flex-start',
      marginBottom: '20px',
    }}>
      <span style={{
        fontFamily: SANS, fontSize: '14px', fontWeight: 700, color: SLATE,
        fontVariantNumeric: 'tabular-nums', letterSpacing: '0.5px',
      }}>{String(n).padStart(2, '0')}</span>
      <span aria-hidden style={{ width: '26px', height: '1px', background: HAIR }} />
      <span style={{
        fontFamily: SF, fontSize: '13px', fontWeight: 600, color: FAINT,
        letterSpacing: '1.4px', textTransform: 'uppercase',
      }}>{label}</span>
    </div>
  );
}

function Title({ children, align = 'left' }) {
  return (
    <h1 className="landing-title" style={{
      fontFamily: SERIF, fontSize: '46px', fontWeight: 400, color: INK,
      letterSpacing: '-0.02em', lineHeight: 1.1, textAlign: align,
      margin: '0 0 16px', maxWidth: '20ch',
      marginLeft: align === 'center' ? 'auto' : 0,
      marginRight: align === 'center' ? 'auto' : 0,
    }}>{children}</h1>
  );
}

function Lead({ children, align = 'left' }) {
  const center = align === 'center';
  return (
    <p className="landing-lead" style={{
      fontFamily: SF, fontSize: '20px', color: SLATE, lineHeight: 1.6,
      textAlign: align, maxWidth: '54ch',
      margin: center ? '0 auto' : 0,
    }}>{children}</p>
  );
}

function Body({ children, align = 'left' }) {
  const center = align === 'center';
  return (
    <p style={{
      fontFamily: SF, fontSize: 'var(--text-base)', color: 'var(--ink-2)', lineHeight: 1.62,
      textAlign: align, maxWidth: '58ch',
      margin: center ? '0 auto 16px' : '0 0 16px',
    }}>{children}</p>
  );
}

// Content column — consistent left-anchored rhythm shared by the text slides.
// The column shrinks to its content and centers itself in the slide, so the
// text stays left-aligned but the block sits in the middle of a laptop screen.
function Slide({ children }) {
  return (
    <div style={{
      textAlign: 'left', width: 'fit-content', maxWidth: '100%',
      marginLeft: 'auto', marginRight: 'auto',
    }}>{children}</div>
  );
}

function MiniCard({ title, badge, stars, compact, children }) {
  return (
    <div style={{
      background: '#ffffff', border: `1px solid ${HAIR}`,
      borderRadius: compact ? '14px' : '18px',
      padding: compact ? '12px 16px' : '24px 26px', textAlign: 'left',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '8px', marginBottom: compact ? '4px' : '8px',
      }}>
        <p style={{
          fontFamily: SANS, fontSize: compact ? '15px' : '18px', fontWeight: 600,
          color: INK, margin: 0, letterSpacing: '-0.2px',
        }}>
          {title}
        </p>
        {badge && (
          <span style={{
            fontFamily: SANS, fontSize: 'var(--text-xs)', fontWeight: 700, color: GOLD,
            background: WASH, border: `1px solid ${SKYLINE}`, borderRadius: '9999px',
            padding: '2px 10px', whiteSpace: 'nowrap', flexShrink: 0,
          }}>{badge}</span>
        )}
      </div>
      {stars && (
        <div aria-label="five stars" style={{ display: 'flex', gap: '3px', marginBottom: compact ? '5px' : '9px' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} style={{ fontSize: compact ? '13px' : '16px', lineHeight: 1, color: GOLD }}>★</span>
          ))}
        </div>
      )}
      <p style={{
        fontFamily: SF, fontSize: compact ? '13px' : '16px', color: SLATE,
        lineHeight: 1.5, margin: 0,
      }}>
        {children}
      </p>
    </div>
  );
}

function CardGrid({ children }) {
  return (
    <div className="landing-cards" style={{
      display: 'grid', gap: '14px', maxWidth: '600px', margin: '4px 0 0',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    }}>{children}</div>
  );
}

// A quiet slab that carries a single important caveat/number below a Lead.
function NoteBox({ children }) {
  return (
    <div style={{
      background: '#ffffff', border: `1px solid ${HAIR}`,
      borderRadius: '14px', padding: '16px 20px', maxWidth: '58ch',
      margin: '0', fontFamily: SF, fontSize: '16px',
      color: SLATE, lineHeight: 1.6, textAlign: 'left',
    }}>{children}</div>
  );
}

// Vertical trust journey — read top to bottom: the first step sits at the top
// and the eye walks down the ladder to the goal, "Fully Trusted", at the bottom.
// Each step is worth +1 (seven steps → +7, matching the Trust Ladder card).
// The sky wash + chips read as the trust theme (kept), goal node holds the mark.
function StageLadder({ stages }) {
  const ordered = stages;
  return (
    <div style={{ width: 'fit-content', maxWidth: '360px', margin: '0 auto' }}>
      {ordered.map((s, i) => {
        const isGoal = i === ordered.length - 1;
        const isBottom = i === ordered.length - 1;
        const size = isGoal ? 44 : 34;
        return (
          <div key={s} style={{ display: 'flex', gap: '16px', alignItems: 'stretch' }}>
            {/* Rail: node + connector line down to the next node. */}
            <div style={{ width: '44px', display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div style={{
                width: `${size}px`, height: `${size}px`, borderRadius: '50%',
                background: isGoal ? '#ffffff' : WASH,
                border: isGoal ? `1px solid ${SKYLINE}` : `1.5px solid ${SKYLINE}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: SANS, fontSize: '15px', fontWeight: 700,
                color: SLATE, flexShrink: 0,
              }}>
                {isGoal
                  ? <img src="/logo.png" alt="ToWin" draggable="false"
                      style={{ width: 26, height: 26, objectFit: 'contain', transform: 'rotate(90deg)' }} />
                  : i + 1}
              </div>
              {!isBottom && (
                <div style={{ flex: 1, width: '1.5px', minHeight: '10px', background: SKYLINE }} />
              )}
            </div>

            {/* Label, vertically centred on its node */}
            <div style={{
              minHeight: `${size}px`,
              display: 'flex', alignItems: 'center', gap: '10px',
              paddingBottom: isBottom ? 0 : '13px',
            }}>
              <span style={{
                fontFamily: isGoal ? SERIF : SF,
                fontSize: isGoal ? '20px' : '17px',
                fontWeight: isGoal ? 400 : 500,
                letterSpacing: isGoal ? '-0.01em' : 0,
                color: INK,
              }}>{s}</span>
              <span style={{
                fontFamily: SANS, fontSize: 'var(--text-xs)', fontWeight: 700, color: SLATE,
                background: WASH, border: `1px solid ${SKYLINE}`, borderRadius: '9999px',
                padding: '2px 9px', whiteSpace: 'nowrap', flexShrink: 0,
              }}><span style={{ color: GOLD }}>+1</span> trust score</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── The 6 slides ─────────────────────────────────────────────────────────
// Each slide: { id, nextLabel?, readMs?, wide?, render() }
// The shell shows nextLabel on the Next button (default "Next");
// on the last slide the shell shows the Start button instead.

export const SLIDES = [
  {
    id: 'welcome',
    nextLabel: 'See why →',
    readMs: 3000,
    render: () => (
      <div style={{ textAlign: 'center' }}>
        <Chapter n={1} label="Welcome" align="center" />

        {/* Brand lockup — the mark and wordmark read as one unit (wordmark stays sans) */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '13px', marginBottom: '24px',
        }}>
          <img
            src="/tortoise-logo-alpha.png"
            alt="ToWin tortoise logo"
            style={{ width: 62, height: 62, objectFit: 'contain' }}
          />
          <span style={{
            fontFamily: SANS, fontSize: '28px', fontWeight: 600, color: INK,
            letterSpacing: '-0.6px',
          }}>ToWin</span>
        </div>

        {/* The tagline is the hero line — serif at 400, "two" set in italic */}
        <h1 className="landing-title" style={{
          fontFamily: SERIF, fontSize: '60px', fontWeight: 400, color: INK,
          letterSpacing: '-0.02em', lineHeight: 1.05, margin: '0 auto 20px',
          maxWidth: '14ch',
        }}>
          It takes <span style={{ fontStyle: 'italic' }}>two</span> To&nbsp;Win.
        </h1>

        <p className="landing-lead" style={{
          fontFamily: SF, fontSize: '20px', fontWeight: 500, color: SLATE,
          textAlign: 'center', margin: '0 0 18px',
        }}>
          Connecting generations, building <span style={{ color: GOLD, fontWeight: 600 }}>trust</span>.
        </p>

        <Body align="center">
          A place where elders connect with younger people for company and daily help, with a trust score and trust ladder that keeps every connection safe.
        </Body>
      </div>
    ),
  },
  {
    id: 'people',
    readMs: 2600,
    render: () => (
      <Slide>
        <Chapter n={2} label="Who it's for" />
        <Title>Two kinds of people</Title>
        <Lead>Everyone on ToWin is one of these two.</Lead>
        <div style={{ height: '24px' }} />
        <CardGrid>
          <MiniCard title="Elder">
            An older person looking for friendship, company, or help with daily tasks.
          </MiniCard>
          <MiniCard title="Helper">
            A younger person who gives time, company, and a hand with everyday things.
          </MiniCard>
        </CardGrid>
      </Slide>
    ),
  },
  {
    id: 'solves',
    readMs: 2900,
    render: () => (
      <Slide>
        <Chapter n={3} label="The problem we solve" />
        <Title>Help is hard to find alone for elder people</Title>
        <Lead>
          Small daily things, like shopping, a ride, or someone to talk to, take
          energy that elders don&apos;t always have.
        </Lead>
        <div style={{ height: '18px' }} />
        <Body>
          On ToWin, an elder simply asks. Helpers nearby see the request and
          come to help with whatever is needed.
        </Body>
      </Slide>
    ),
  },
  {
    id: 'trust',
    wide: true,
    readMs: 3800,
    render: () => (
      <div className="landing-split" style={{ display: 'flex', alignItems: 'center', gap: '52px' }}>
        {/* Left: story */}
        <div className="landing-split-text" style={{ flex: 1, textAlign: 'left' }}>
          <Chapter n={4} label="The real problem is trust" />
          <Title align="left">
            <span style={{ color: GOLD }}>Trust</span> is earned,<br />not given
          </Title>
          <Lead align="left">
            Letting someone new into your life is a big step. So every member
            has a <span style={{ color: GOLD, fontWeight: 600 }}>Trust Score</span>, visible to elders before they ever say yes.
          </Lead>
          <div style={{ height: '18px' }} />
          <NoteBox>
            Each person you help can earn you a <strong style={{ color: INK }}>maximum of 15 points</strong>, so your score grows with every new connection.
          </NoteBox>
        </div>

        {/* Right: three score cards + total */}
        <div style={{ flexShrink: 0, width: '288px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
          <MiniCard title="Profile" badge="+3" compact>
            Full profile with ID, phone, and photo, all checked.
          </MiniCard>
          <MiniCard title="Trust Ladder" badge="+7" compact>
            With each new person you climb the same seven steps, points earned as that friendship grows.
          </MiniCard>
          <MiniCard title="Review" badge="+5" stars compact>
            Star ratings from the people they have already helped.
          </MiniCard>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            background: '#ffffff', border: `1px solid ${HAIR}`, borderRadius: '12px', padding: '10px 14px',
          }}>
            <span style={{ fontFamily: SF, fontSize: 'var(--text-sm)', fontWeight: 500, color: SLATE }}>3 + 7 + 5 =</span>
            <span style={{ fontFamily: SERIF, fontSize: '24px', fontWeight: 400, color: GOLD }}>15</span>
            <span style={{ fontFamily: SF, fontSize: '14px', color: SLATE }}>points per connection</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'rooting',
    wide: true,
    readMs: 3600,
    render: () => (
      <div className="landing-split" style={{ display: 'flex', alignItems: 'center', gap: '52px' }}>
        {/* Left: the story */}
        <div className="landing-split-text" style={{ flex: 1, textAlign: 'left' }}>
          <Chapter n={5} label="One step at a time" />
          <Title align="left">
            Rooting (<span style={{ color: GOLD }}>Trust</span> Ladder): how trust grows
          </Title>
          <Lead align="left">
            Like a tree growing roots, every friendship on ToWin grows slowly,
            through 7 simple stages.
          </Lead>
          <div style={{ height: '18px' }} />
          <NoteBox>
            <strong style={{ color: INK }}>Both people must agree to every step.</strong> Nothing personal,
            like a phone number, is shared until trust has grown.
          </NoteBox>
        </div>

        {/* Right: the ladder */}
        <div style={{ flexShrink: 0 }}>
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
      <Slide>
        <Chapter n={6} label="Why ToWin" />
        <Title>Both sides win</Title>
        <Lead>
          Today&apos;s elders use phones, shop online, and pay online. Tomorrow
          there will be many more. But the hardest parts of growing older haven&apos;t
          changed: feeling lonely, and not having enough energy for everyday things.
        </Lead>
        <div style={{ height: '18px' }} />
        <NoteBox>
          Elders have <strong style={{ color: INK }}>time and money</strong>, but need energy and company.{' '}
          Helpers have <strong style={{ color: INK }}>energy and time</strong>, but need money and care.{' '}
          <strong style={{ color: INK }}>ToWin is where they meet and share, and both win.</strong>
        </NoteBox>
      </Slide>
    ),
  },
];
