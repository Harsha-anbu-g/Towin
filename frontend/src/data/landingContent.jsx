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


import {
  Armchair, HandHeart, ShoppingBag, Car, MessageCircle,
  BadgeCheck, TrendingUp, Star, Link2, Phone, Video, Share2, Coffee,
} from 'lucide-react';
import { IntroBrandLockup } from '../components/TortoiseMark';

const SERIF = `'Newsreader', Georgia, 'Times New Roman', serif`;  // headings + tagline, weight 400
const SANS  = `-apple-system, 'SF Pro Display', system-ui, sans-serif`; // wordmark, labels, UI numerals
const SF    = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;    // body

const INK   = 'var(--ink)';
const SLATE = 'var(--ink-slate)';
const FAINT = 'var(--ink-4)';
const HAIR  = 'var(--border)';   // warm hairline for structural card borders
const BLUE  = 'var(--blue-teal)';         // interactive/semantic only
const SKY   = 'var(--blue)';
const WASH  = 'var(--blue-wash)';         // sky wash — trust chips only
const SKYLINE = 'var(--blue-soft)';       // sky hairline — trust chips only
const GOLD  = 'var(--trust-gold)';
const GOLD_TEXT = 'var(--gold-deep)';     // small (sub-19px-bold) gold text — AA on washes

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
    // h2, not h1 — the tagline on slide 1 is the page's single h1; every
    // other slide title is a section heading. Sizing is inline, so the
    // rendered look is unchanged.
    <h2 className="landing-title" style={{
      fontFamily: SERIF, fontSize: '46px', fontWeight: 400, color: INK,
      letterSpacing: '-0.02em', lineHeight: 1.1, textAlign: align,
      margin: '0 0 16px', maxWidth: '20ch',
      marginLeft: align === 'center' ? 'auto' : 0,
      marginRight: align === 'center' ? 'auto' : 0,
    }}>{children}</h2>
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

// Content column for the single-message text slides. Centered composition
// (user-requested): the short manifesto-style slides read best centered, like
// the cover; the two split slides (trust/rooting) stay left-aligned editorial.
function Slide({ children }) {
  return (
    <div style={{ textAlign: 'center', width: '100%' }}>{children}</div>
  );
}

function MiniCard({ title, badge, stars, compact, icon: Icon, children }) {
  return (
    <div style={{
      background: 'var(--canvas)', border: `1px solid ${HAIR}`,
      borderRadius: compact ? '14px' : '18px',
      padding: compact ? '12px 16px' : '24px 26px', textAlign: 'left',
    }}>
      {/* Large cards: a tinted icon chip above the title (role cards, slide 2) */}
      {Icon && !compact && (
        <span style={{
          width: '44px', height: '44px', borderRadius: '50%', marginBottom: '12px',
          background: 'var(--surface-2)',
          border: `1px solid ${HAIR}`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: SLATE,
        }}>
          <Icon size={21} strokeWidth={2} />
        </span>
      )}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '8px', marginBottom: compact ? '4px' : '8px',
      }}>
        <p style={{
          fontFamily: SANS, fontSize: compact ? '15px' : '18px', fontWeight: 600,
          color: INK, margin: 0, letterSpacing: '-0.2px',
          display: 'inline-flex', alignItems: 'center', gap: '7px',
        }}>
          {/* Compact cards: a small inline icon before the title (score cards, slide 4) */}
          {Icon && compact && <Icon size={15} strokeWidth={2.2} style={{ color: SLATE, flexShrink: 0 }} />}
          {title}
        </p>
        {badge && (
          <span style={{
            fontFamily: SANS, fontSize: 'var(--text-xs)', fontWeight: 700, color: GOLD_TEXT,
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
      display: 'grid', gap: '14px', maxWidth: '600px', margin: '4px auto 0',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    }}>{children}</div>
  );
}

// A quiet slab that carries a single important caveat/number below a Lead.
// Centers itself inside centered slides; the split slides pass align="left".
function NoteBox({ children, align = 'center' }) {
  return (
    <div style={{
      background: 'var(--canvas)', border: `1px solid ${HAIR}`,
      borderRadius: '14px', padding: '16px 20px', maxWidth: '58ch',
      margin: align === 'center' ? '0 auto' : '0', fontFamily: SF, fontSize: '16px',
      color: SLATE, lineHeight: 1.6, textAlign: 'left',
    }}>{children}</div>
  );
}

// The exchange as a small table: what one column has, the other column needs,
// so the mirrored structure carries the emphasis and no word in the copy has
// to shout (replaces the old bolded NoteBox sentences on slide 6). All cells
// live in ONE grid — the two columns share rows, so the hairlines (drawn by a
// 1px gap over a hairline background) align across the center divider like
// real table rules. Cell placement comes from the .landing-exchange
// grid-template-areas in index.css, which restacks the sides as two complete
// mini-tables below 640px.
function ExchangeBoard({ sides }) {
  return (
    <div className="landing-exchange" style={{
      display: 'grid', gap: '1px', background: HAIR,
      border: `1px solid ${HAIR}`, borderRadius: '14px', overflow: 'hidden',
      maxWidth: '620px', margin: '0 auto', textAlign: 'left',
    }}>
      {sides.map(({ role, icon, have, need }, i) => {
        const Icon = icon;
        const col = i === 0 ? 'e' : 'h';
        return [
          // Header cell — centered and tinted, like a table head
          <p key={`${role}-head`} style={{
            gridArea: `${col}-head`, background: 'var(--surface-2)',
            fontFamily: SANS, fontSize: '17px', fontWeight: 600, color: INK,
            margin: 0, padding: '10px 22px', letterSpacing: '-0.2px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}>
            <Icon size={16} strokeWidth={2.1} style={{ color: SLATE, flexShrink: 0 }} />
            {role}
          </p>,
          ...[['have', 'Have', have], ['need', 'Need', need]].map(([area, label, text]) => (
            <div key={`${role}-${area}`} style={{
              gridArea: `${col}-${area}`, background: 'var(--canvas)',
              display: 'flex', gap: '10px', padding: '10px 22px',
            }}>
              <span style={{
                fontFamily: SANS, fontSize: '13px', fontWeight: 700, color: SLATE,
                letterSpacing: '1.2px', textTransform: 'uppercase',
                width: '52px', flexShrink: 0, paddingTop: '2px',
              }}>{label}</span>
              <span style={{ fontFamily: SF, fontSize: '16px', color: 'var(--ink-2)', lineHeight: 1.5 }}>
                {text}
              </span>
            </div>
          )),
        ];
      })}
    </div>
  );
}

// Each ladder stage carries its own icon — the meaning at a glance (elders parse
// a phone glyph faster than the word). Sequence is shown by the rail itself.
const STAGE_ICONS = {
  'Just Connected': Link2,
  'Messaging': MessageCircle,
  'Phone Ready': Phone,
  'Video Ready': Video,
  'Social Media': Share2,
  'Ready to Meet': Coffee,
};

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
                background: isGoal ? 'var(--canvas)' : WASH,
                border: isGoal ? `1px solid ${SKYLINE}` : `1.5px solid ${SKYLINE}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: SANS, fontSize: '15px', fontWeight: 700,
                color: SLATE, flexShrink: 0,
              }}>
                {isGoal
                  ? <img src="/logo.png" alt="ToWin" draggable="false"
                      loading="lazy" decoding="async"
                      style={{ width: 26, height: 26, objectFit: 'contain', transform: 'rotate(90deg)' }} />
                  : (() => { const I = STAGE_ICONS[s]; return I ? <I size={15} strokeWidth={2.2} /> : i + 1; })()}
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
              }}><span style={{ color: GOLD_TEXT }}>+1</span> trust score</span>
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

        {/* Brand lockup — the mark and wordmark read as one unit (wordmark stays sans).
            On every landing view it plays the intro: the tortoise draws itself in
            centred, then "ToWin" wipes in from the left and pushes it into place.
            Nothing else on the page moves; reduced-motion renders it finished. */}
        <IntroBrandLockup
          size={82}
          gap={6}
          wrapStyle={{
            display: 'inline-flex', alignItems: 'center', marginBottom: '28px',
          }}
          wordStyle={{
            fontFamily: SANS, fontSize: '36px', fontWeight: 600, color: INK,
            letterSpacing: '-0.8px',
          }}
        />

        {/* The tagline is the hero line — serif at 400, "two" set in italic */}
        <h1 className="landing-title" style={{
          fontFamily: SERIF, fontSize: '46px', fontWeight: 400, color: INK,
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
        <Chapter n={2} label="Who it's for" align="center" />
        <Title align="center">Two kinds of people</Title>
        <Lead align="center">Everyone on ToWin is one of these two.</Lead>
        <div style={{ height: '24px' }} />
        <CardGrid>
          <MiniCard title="Elder" icon={Armchair}>
            An older person looking for friendship, company, or help with daily tasks.
          </MiniCard>
          <MiniCard title="Helper" icon={HandHeart}>
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
        <Chapter n={3} label="The problem we solve" align="center" />
        <Title align="center">Help is hard to find alone for elder people</Title>
        <Lead align="center">
          Small daily things, like shopping, a ride, or someone to talk to, take
          energy that elders don&apos;t always have.
        </Lead>
        {/* The three examples from the lead, as scannable chips */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', margin: '20px 0 0' }}>
          {[[ShoppingBag, 'Shopping'], [Car, 'A ride'], [MessageCircle, 'Someone to talk to']].map(([I, label]) => (
            <span key={label} style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'var(--canvas)', border: `1px solid ${HAIR}`, borderRadius: '9999px',
              padding: '9px 16px', fontFamily: SF, fontSize: '15px', fontWeight: 500, color: SLATE,
            }}>
              <I size={16} strokeWidth={2} style={{ color: BLUE }} />
              {label}
            </span>
          ))}
        </div>
        <div style={{ height: '18px' }} />
        <Body align="center">
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
          <NoteBox align="left">
            Each person you help can earn you a <strong style={{ color: INK }}>maximum of 15 points</strong>, so your score grows with every new connection.
          </NoteBox>
        </div>

        {/* Right: three score cards + total */}
        <div style={{ flexShrink: 0, width: '288px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
          <MiniCard title="Profile" badge="+3" compact icon={BadgeCheck}>
            Full profile with ID, phone, and photo, all checked.
          </MiniCard>
          <MiniCard title="Trust Ladder" badge="+7" compact icon={TrendingUp}>
            With each new person you climb the same seven steps, points earned as that friendship grows.
          </MiniCard>
          <MiniCard title="Review" badge="+5" stars compact icon={Star}>
            Star ratings from the people they have already helped.
          </MiniCard>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            background: 'var(--canvas)', border: `1px solid ${HAIR}`, borderRadius: '12px', padding: '10px 14px',
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
          <NoteBox align="left">
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
        <Chapter n={6} label="Why ToWin" align="center" />
        <Title align="center">Both sides win</Title>
        <Lead align="center">
          Today&apos;s elders use phones, shop online, and pay online. Tomorrow
          there will be many more. But the hardest parts of growing older haven&apos;t
          changed: feeling lonely, and not having enough energy for everyday things.
        </Lead>
        <div style={{ height: '14px' }} />
        {/* Read across: each side's Have answers the other side's Need. */}
        <ExchangeBoard sides={[
          {
            role: 'Elders', icon: Armchair,
            have: 'Time, money, and life lessons to share',
            need: 'Energy and company',
          },
          {
            role: 'Helpers', icon: HandHeart,
            have: 'Energy, time, and good company',
            need: 'Money, care, and life advice',
          },
        ]} />
        {/* The payoff line, set like the tagline: serif 400, italic emphasis. */}
        <p style={{
          fontFamily: SERIF, fontSize: '22px', fontWeight: 400, color: INK,
          letterSpacing: '-0.01em', lineHeight: 1.4, textAlign: 'center',
          maxWidth: '54ch', margin: '16px auto 0', textWrap: 'balance',
        }}>
          ToWin is where they meet and share, and&nbsp;<span style={{ fontStyle: 'italic' }}>both</span>&nbsp;win.
        </p>
      </Slide>
    ),
  },
];
