// Guide page content — all copy for the /how-it-works walkthrough lives here.
// Guide.jsx renders STEPS[stepIndex].render(ctx) inside a white card.

const SFD = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SF = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const SKY = '#4FA3CE';
const BLUE = '#3D8AB0';
const WASH = '#EAF5FB';
const BORDER = '#BFD9EA';

// ── Presentational helpers ───────────────────────────────────────────────

function StepTitle({ children }) {
  return (
    <h2 style={{
      fontFamily: SFD, fontSize: '28px', fontWeight: 600, color: '#1d1d1f',
      letterSpacing: '-0.4px', margin: '0 0 12px', lineHeight: 1.2,
    }}>{children}</h2>
  );
}

function Lead({ children }) {
  return (
    <p style={{
      fontFamily: SF, fontSize: '18px', color: '#5a6470',
      lineHeight: 1.6, margin: '0 0 20px',
    }}>{children}</p>
  );
}

function SubHead({ children }) {
  return (
    <h3 style={{
      fontFamily: SFD, fontSize: '19px', fontWeight: 600, color: '#1d1d1f',
      margin: '26px 0 12px',
    }}>{children}</h3>
  );
}

function Bullets({ items }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '11px' }}>
      {items.map((it, i) => (
        <li key={i} style={{
          display: 'flex', gap: '12px', alignItems: 'flex-start',
          fontFamily: SF, fontSize: '16px', color: '#1d1d1f', lineHeight: 1.5,
        }}>
          <span style={{
            flexShrink: 0, width: '22px', height: '22px', borderRadius: '50%',
            background: WASH, border: `1px solid ${BORDER}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '1px',
          }}>
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.6 6.5L9 1" stroke={BLUE} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

function MiniCard({ title, children }) {
  return (
    <div style={{
      background: WASH, border: `1px solid ${BORDER}`, borderRadius: '14px',
      padding: '16px 18px',
    }}>
      <p style={{ fontFamily: SFD, fontSize: '16px', fontWeight: 600, color: BLUE, margin: '0 0 6px' }}>
        {title}
      </p>
      <p style={{ fontFamily: SF, fontSize: '15px', color: '#5a6470', lineHeight: 1.55, margin: 0 }}>
        {children}
      </p>
    </div>
  );
}

function CardGrid({ children }) {
  return (
    <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
      {children}
    </div>
  );
}

function NoteBox({ children }) {
  return (
    <div style={{
      marginTop: '22px', background: '#fafafc', border: '1px solid #e8e8ed',
      borderRadius: '14px', padding: '16px 18px',
      fontFamily: SF, fontSize: '15px', color: '#5a6470', lineHeight: 1.6,
    }}>{children}</div>
  );
}

// ── The 7 steps ──────────────────────────────────────────────────────────
// Each step: { id, navLabel, render(ctx) }
// ctx = { role: 'ELDER'|'HELPER', isLoggedIn: boolean, navigate, restart }

export const STEPS = [
  {
    id: 'welcome',
    navLabel: 'Welcome',
    render: () => (
      <>
        <StepTitle>Welcome to ToWin</StepTitle>
        <Lead>
          ToWin is a community that brings older people and younger helpers together —
          to ease loneliness and make everyday help easy to find.
        </Lead>
        <SubHead>Why we built it</SubHead>
        <p style={{ fontFamily: SF, fontSize: '16px', color: '#1d1d1f', lineHeight: 1.6, margin: 0 }}>
          Many older people have no safe, trusted way to meet new friends or get a hand with
          daily tasks. ToWin gives them one — built around trust that grows one small step
          at a time, so no one ever has to rush or feel unsafe.
        </p>
        <SubHead>Who ToWin is for</SubHead>
        <CardGrid>
          <MiniCard title="Elder">An older person looking for friendship, company, or help with daily tasks.</MiniCard>
          <MiniCard title="Helper">A younger person offering companionship and a hand with everyday things.</MiniCard>
        </CardGrid>
        <NoteBox>
          Choose how you'll use ToWin with the tabs above — you can switch between
          Elder and Helper anytime.
        </NoteBox>
      </>
    ),
  },
  {
    id: 'features',
    navLabel: 'What you can do',
    render: ({ role }) => (
      role === 'HELPER' ? (
        <>
          <StepTitle>What you can do as a Helper</StepTitle>
          <Lead>As a Helper, you offer your time and reach the elders who need it most.</Lead>
          <Bullets items={[
            'Browse help requests from elders near you and apply to the ones you can take on.',
            'Discover elders looking for friendship and send a connection request.',
            'Message the elders you connect with, safely and simply.',
            'Grow your Trust Score and earn reviews each time you help.',
          ]} />
          <NoteBox>
            Switch to the <strong>Elder</strong> tab above to see what the experience looks
            like from the other side.
          </NoteBox>
        </>
      ) : (
        <>
          <StepTitle>What you can do as an Elder</StepTitle>
          <Lead>As an Elder, you decide who you connect with and how far the friendship goes.</Lead>
          <Bullets items={[
            'Post a help request — companionship, transport, errands, cleaning, and more.',
            'See the helpers who apply and choose the person you trust.',
            'Find and connect with helpers near you.',
            'Message the people you connect with, safely and simply.',
            'Check in every day to keep your daily streak going.',
            'Add emergency contacts and use the SOS button any time you need help fast.',
          ]} />
          <NoteBox>
            Switch to the <strong>Helper</strong> tab above to see what the experience looks
            like from the other side.
          </NoteBox>
        </>
      )
    ),
  },
  {
    id: 'journey',
    navLabel: 'Trust Journey',
    render: () => (
      <>
        <StepTitle>The Trust Journey</StepTitle>
        <Lead>
          Every connection grows through 7 gentle stages. You only move forward when
          both people agree.
        </Lead>
        <Bullets items={[
          <><strong>1. Just Connected</strong> — see each other's profile and send a connection request.</>,
          <><strong>2. Messaging</strong> — send messages and share photos in a private chat.</>,
          <><strong>3. Phone Ready</strong> — exchange phone numbers and call each other.</>,
          <><strong>4. Video Ready</strong> — have a video call and meet face to face.</>,
          <><strong>5. Verified</strong> — identities are verified and a verified badge appears.</>,
          <><strong>6. Ready to Meet</strong> — plan an in-person visit; emergency contacts are notified.</>,
          <><strong>7. Fully Trusted</strong> — a full, trusted friendship; leave and receive reviews.</>,
        ]} />
        <NoteBox>
          <strong>Both people must confirm every step.</strong> Either person can pause or end
          a connection at any time. Phone numbers and other details are shared only as trust
          grows — there is no rush, and the journey takes as long as you need.
        </NoteBox>
      </>
    ),
  },
  {
    id: 'score',
    navLabel: 'Trust Score',
    render: () => (
      <>
        <StepTitle>Your Trust Score</StepTitle>
        <Lead>
          Trust is earned, not given. Your Trust Score helps everyone feel safe and helps
          elders choose who to rely on.
        </Lead>
        <SubHead>It has three parts</SubHead>
        <CardGrid>
          <MiniCard title="Profile Score">
            Fill in your profile. 8 details — each worth 0.25 points, up to 2.0: ID and phone
            verified, photo, a social link, hobbies, occupation, a short bio, and date of birth.
          </MiniCard>
          <MiniCard title="Rooting Score">
            Earn points every time a relationship moves up a trust stage — added up across all
            of your connections.
          </MiniCard>
          <MiniCard title="Review Score">
            Every star rating you receive from the people you help adds up here.
          </MiniCard>
        </CardGrid>
        <SubHead>The five tiers</SubHead>
        <Bullets items={[
          <><strong>New Member</strong> — 0 to 2 points.</>,
          <><strong>Getting Started</strong> — 3 to 14 points.</>,
          <><strong>Reliable</strong> — 15 to 49 points.</>,
          <><strong>Highly Trusted</strong> — 50 to 119 points.</>,
          <><strong>Community Champion</strong> — 120 points and above.</>,
        ]} />
        <NoteBox>
          After a connection reaches a full friendship, both people leave a 1–5 star rating,
          a few kind tags (Friendly, Punctual, Respectful, Helpful, Patient), and can quietly
          flag a safety concern if something didn't feel right.
        </NoteBox>
      </>
    ),
  },
  {
    id: 'streaks',
    navLabel: 'Streaks',
    render: () => (
      <>
        <StepTitle>Daily Streaks</StepTitle>
        <Lead>
          Showing up matters. Each day you visit ToWin, tap "I'm here today" to log the day.
        </Lead>
        <Bullets items={[
          'Your current streak counts the days you have checked in, one after another.',
          'Your best streak is your all-time record — something to be proud of.',
          'Miss a day and the current streak starts again — but your best streak is always kept.',
        ]} />
        <NoteBox>
          The streak check-in is the first screen elders see after signing in — a simple,
          friendly way to start the day.
        </NoteBox>
      </>
    ),
  },
  {
    id: 'feel',
    navLabel: 'The ToWin feel',
    render: () => (
      <>
        <StepTitle>The ToWin feel</StepTitle>
        <Lead>
          Every screen is designed to feel calm, clear, and unhurried.
        </Lead>
        <Bullets items={[
          'Calm sky-blue colours and soft white cards — never harsh, never cluttered.',
          'The tortoise logo: steady and patient, because trust grows slowly and surely.',
          'Large, readable text so nothing is a strain to read.',
          'One simple thing per screen — no clutter, no confusion.',
        ]} />
      </>
    ),
  },
  {
    id: 'start',
    navLabel: 'Get started',
    render: ({ isLoggedIn, navigate, restart }) => (
      <>
        <StepTitle>You're ready</StepTitle>
        <Lead>
          Build your profile, connect with people near you, grow trust step by step,
          and meet safely. That's ToWin.
        </Lead>
        <button
          onClick={() => navigate(isLoggedIn ? '/dashboard' : '/register')}
          style={{
            width: '100%', background: SKY, color: '#fff', border: 'none',
            borderRadius: '9999px', padding: '16px 0', fontSize: '17px', fontWeight: 600,
            fontFamily: SF, cursor: 'pointer', marginTop: '8px',
            boxShadow: '0 4px 16px rgba(79,163,206,0.3)',
          }}
        >
          {isLoggedIn ? 'Go to my dashboard' : 'Create your account'}
        </button>
        <button
          onClick={restart}
          style={{
            width: '100%', background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: SF, fontSize: '14px', color: '#7a7a7a', marginTop: '14px',
            textDecoration: 'underline', textUnderlineOffset: '3px',
          }}
        >
          Read the guide again from the start
        </button>
      </>
    ),
  },
];
