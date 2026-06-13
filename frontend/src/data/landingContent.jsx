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
      fontFamily: SFD, fontSize: '40px', fontWeight: 600, color: '#1d1d1f',
      letterSpacing: '-0.374px', lineHeight: 1.1, textAlign: 'center',
      margin: '0 0 14px',
    }}>{children}</h1>
  );
}

function Lead({ children }) {
  return (
    <p className="landing-lead" style={{
      fontFamily: SF, fontSize: '19px', color: '#5a6470', lineHeight: 1.6,
      textAlign: 'center', maxWidth: '540px', margin: '0 auto 22px',
    }}>{children}</p>
  );
}

function Body({ children }) {
  return (
    <p style={{
      fontFamily: SF, fontSize: '17px', color: '#1d1d1f', lineHeight: 1.65,
      textAlign: 'center', maxWidth: '540px', margin: '0 auto 16px',
    }}>{children}</p>
  );
}

function MiniCard({ title, children }) {
  return (
    <div style={{
      background: '#ffffff', border: `1px solid ${BORDER}`, borderRadius: '18px',
      padding: '18px 20px', textAlign: 'left',
    }}>
      <p style={{ fontFamily: SFD, fontSize: '17px', fontWeight: 600, color: BLUE, margin: '0 0 6px' }}>
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
    <div className="landing-cards" style={{
      display: 'grid', gap: '14px', maxWidth: '600px', margin: '0 auto',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    }}>{children}</div>
  );
}

function StageChips({ stages }) {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center',
      maxWidth: '560px', margin: '0 auto',
    }}>
      {stages.map((s, i) => (
        <span key={s} style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          background: WASH, border: `1px solid ${BORDER}`, borderRadius: '9999px',
          padding: '9px 16px', fontFamily: SF, fontSize: '15px', color: '#1d1d1f',
        }}>
          <span style={{ fontWeight: 600, color: BLUE }}>{i + 1}</span>
          {s}
        </span>
      ))}
    </div>
  );
}

function NoteBox({ children }) {
  return (
    <div style={{
      background: '#ffffff', border: '1px solid #e8e8ed',
      borderRadius: '14px', padding: '16px 20px', maxWidth: '540px',
      margin: '22px auto 0', fontFamily: SF, fontSize: '15px',
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
        <Body>
          One who helps, one who gets help, and both win.
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
    render: () => (
      <>
        <Kicker>The real problem is trust</Kicker>
        <Title>Trust is earned, not given</Title>
        <Lead>
          Letting someone new into your life is a big step. So every member
          has a Trust Score, built from three things:
        </Lead>
        <CardGrid>
          <MiniCard title="Profile">
            A full profile with ID, phone, and photo, all checked.
          </MiniCard>
          <MiniCard title="Rooting">
            Points earned each time a friendship takes a step forward.
          </MiniCard>
          <MiniCard title="Review">
            Star ratings from the people they have already helped.
          </MiniCard>
        </CardGrid>
        <NoteBox>Elders see a helper&apos;s Trust Score before they ever say yes.</NoteBox>
      </>
    ),
  },
  {
    id: 'rooting',
    render: () => (
      <>
        <Kicker>One step at a time</Kicker>
        <Title>Rooting: how trust grows</Title>
        <Lead>
          Like a tree growing roots, every friendship on ToWin grows slowly,
          through 7 simple stages:
        </Lead>
        <StageChips stages={[
          'Just Connected', 'Messaging', 'Phone Ready', 'Video Ready',
          'Verified', 'Ready to Meet', 'Fully Trusted',
        ]} />
        <NoteBox>
          <strong>Both people must agree to every step.</strong> Nothing personal,
          like a phone number, is shared until trust has grown.
        </NoteBox>
      </>
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
