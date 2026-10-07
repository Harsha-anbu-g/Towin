// Guide page content — all copy for the /how-it-works walkthrough lives here.
// Guide.jsx renders STEPS[stepIndex].render(ctx) inside a white card.
import { tr } from '../i18n';
import emphasize from '../i18n/emphasize';

const SFD = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SF = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const SKY = 'var(--blue)';
const BLUE = 'var(--blue-teal)';
const WASH = 'var(--blue-wash)';
const BORDER = 'var(--blue-soft)';

// ── Presentational helpers ───────────────────────────────────────────────

function StepTitle({ children }) {
  return (
    <h2 style={{
      fontFamily: SFD, fontSize: '20px', fontWeight: 700, color: 'var(--ink)',
      letterSpacing: '-0.3px', margin: '0 0 10px', lineHeight: 1.25,
    }}>{children}</h2>
  );
}

function Lead({ children }) {
  return (
    <p style={{
      fontFamily: SF, fontSize: '16px', color: 'var(--ink-slate)',
      lineHeight: 1.6, margin: '0 0 16px',
    }}>{children}</p>
  );
}

function SubHead({ children }) {
  return (
    <h3 style={{
      fontFamily: SFD, fontSize: '16px', fontWeight: 600, color: 'var(--ink)',
      margin: '20px 0 10px',
    }}>{children}</h3>
  );
}

function Bullets({ items }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '9px' }}>
      {items.map((it, i) => (
        <li key={i} style={{
          display: 'flex', gap: '10px', alignItems: 'flex-start',
          fontFamily: SF, fontSize: 'var(--text-sm)', color: 'var(--ink)', lineHeight: 1.5,
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
      <p style={{ fontFamily: SFD, fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--blue-deep)', margin: '0 0 5px' }}>
        {title}
      </p>
      <p style={{ fontFamily: SF, fontSize: '14px', color: 'var(--ink-slate)', lineHeight: 1.55, margin: 0 }}>
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
      marginTop: '18px', background: 'var(--surface-pearl)', border: '1px solid var(--avatar-grey)',
      borderRadius: '14px', padding: '14px 16px',
      fontFamily: SF, fontSize: '14px', color: 'var(--ink-slate)', lineHeight: 1.6,
    }}>{children}</div>
  );
}

// ── The 7 steps ──────────────────────────────────────────────────────────
// Each step: { id, navLabel, render(ctx) }
// ctx = { role: 'ELDER'|'HELPER', isLoggedIn: boolean, navigate, restart }

export const STEPS = [
  {
    id: 'welcome',
    get navLabel() { return tr('Welcome'); },
    render: () => (
      <>
        <StepTitle>{tr('Welcome to Towinly')}</StepTitle>
        <Lead>
          {tr('Towinly is a community that brings older people and younger helpers together, so no one feels alone and everyday help is easy to find.')}
        </Lead>
        <SubHead>{tr('Why we built it')}</SubHead>
        <p style={{ fontFamily: SF, fontSize: 'var(--text-sm)', color: 'var(--ink)', lineHeight: 1.6, margin: 0 }}>
          {tr('Many older people have no safe, trusted way to meet new friends or get a hand with daily tasks. Towinly gives them one, built around trust that grows one small step at a time, so no one ever has to rush or feel unsafe.')}
        </p>
        <SubHead>{tr('Who Towinly is for')}</SubHead>
        <CardGrid>
          <MiniCard title={tr('Elder')}>{tr('An older person looking for friendship, company, or help with daily tasks.')}</MiniCard>
          <MiniCard title={tr('Helper')}>{tr('A younger person who gives time, company, and a hand with everyday things.')}</MiniCard>
          <MiniCard title={tr('Family')}>{tr('A son, daughter, or relative who watches over their elder and helps from anywhere.')}</MiniCard>
        </CardGrid>
        <NoteBox>
          {tr("Choose how you'll use Towinly with the tabs above. You can switch between Elder, Helper, and Family anytime.")}
        </NoteBox>
      </>
    ),
  },
  {
    id: 'features',
    get navLabel() { return tr('What you can do'); },
    render: ({ role }) => (
      role === 'FAMILY' ? (
        <>
          <StepTitle>{tr('What you can do as Family')}</StepTitle>
          <Lead>{tr("As Family, you stay close to your parent's life here — always with their say-so.")}</Lead>
          <Bullets items={[
            tr('Link to your parent. They must say yes before you see anything.'),
            tr('See that they checked in today, so you know they are okay.'),
            tr('Follow the friendships they choose to share with you — and only those.'),
            tr('Read the small updates thread on a shared friendship, together with your parent and their helper.'),
            tr('Message their helpers directly, through the trust your parent has built.'),
            tr('Ask for permission to act for them — request help, move a friendship forward, or leave a review in their name.'),
          ]} />
          <NoteBox>
            {tr('Your parent stays in charge: every friendship starts private, every power starts off, and they can change their mind at any time.')}
          </NoteBox>
        </>
      ) : role === 'HELPER' ? (
        <>
          <StepTitle>{tr('What you can do as a Helper')}</StepTitle>
          <Lead>{tr('As a Helper, you offer your time and reach the elders who need it most.')}</Lead>
          <Bullets items={[
            tr('See help requests from elders near you and apply to the ones you can do.'),
            tr('Find elders looking for friendship and send a connection request.'),
            tr('Message the elders you connect with, safely and simply.'),
            tr('Grow your Trust Score and earn reviews each time you help.'),
          ]} />
          <NoteBox>
            {emphasize(tr('Switch to the *Elder* tab above to see how Towinly looks from the other side.'), (part) => <strong>{part}</strong>)}
          </NoteBox>
        </>
      ) : (
        <>
          <StepTitle>{tr('What you can do as an Elder')}</StepTitle>
          <Lead>{tr('As an Elder, you decide who you connect with and how far the friendship goes.')}</Lead>
          <Bullets items={[
            tr('Post a help request for company, a ride, shopping, cleaning, and more.'),
            tr('See the helpers who apply and choose the person you trust.'),
            tr('Find and connect with helpers near you.'),
            tr('Message the people you connect with, safely and simply.'),
            tr('Check in each day so your family know you are alright.'),
            tr('Add emergency contacts and use the SOS button any time you need help fast.'),
          ]} />
          <NoteBox>
            {emphasize(tr('Switch to the *Helper* tab above to see how Towinly looks from the other side.'), (part) => <strong>{part}</strong>)}
          </NoteBox>
        </>
      )
    ),
  },
  {
    id: 'journey',
    get navLabel() { return tr('Trust Journey'); },
    render: () => (
      <>
        <StepTitle>{tr('The Trust Journey')}</StepTitle>
        <Lead>
          {tr('Every friendship grows through 7 simple stages. You only move forward when both people agree.')}
        </Lead>
        <Bullets items={[
          <>{emphasize(tr('*1. Just Connected*: see each other\'s profile and send a connection request.'), (part) => <strong>{part}</strong>)}</>,
          <>{emphasize(tr('*2. Messaging*: send messages and share photos in a private chat.'), (part) => <strong>{part}</strong>)}</>,
          <>{emphasize(tr('*3. Phone Ready*: share phone numbers and call each other.'), (part) => <strong>{part}</strong>)}</>,
          <>{emphasize(tr('*4. Video Ready*: have a video call and meet face to face.'), (part) => <strong>{part}</strong>)}</>,
          <>{emphasize(tr('*5. Social Media Exchange*: both share their Instagram, Facebook, or other social profiles.'), (part) => <strong>{part}</strong>)}</>,
          <>{emphasize(tr('*6. Ready to Meet*: plan to meet in person; emergency contacts are told.'), (part) => <strong>{part}</strong>)}</>,
          <>{emphasize(tr('*7. Fully Trusted*: a full, trusted friendship; leave and receive reviews.'), (part) => <strong>{part}</strong>)}</>,
        ]} />
        <NoteBox>
          {emphasize(tr('*Both people must confirm every step.* Either person can pause or end a connection at any time. Phone numbers and other details are shared only as trust grows. There is no rush, and the journey takes as long as you need.'), (part) => <strong>{part}</strong>)}
        </NoteBox>
      </>
    ),
  },
  {
    id: 'score',
    get navLabel() { return tr('Trust Score'); },
    render: () => (
      <>
        <StepTitle>{tr('Your Trust Score')}</StepTitle>
        <Lead>
          {tr('Trust is earned, not given. Each person you help can earn you up to 15 points, and your score is simply those points added up across everyone you help.')}
        </Lead>
        <SubHead>{tr('Each person earns you up to 15 points')}</SubHead>
        <CardGrid>
          <MiniCard title={tr('Trust stages: up to 7')}>
            {tr('Your friendship moves through 7 stages, from first connected to fully trusted. Each stage you reach with that person is worth 1 point.')}
          </MiniCard>
          <MiniCard title={tr('Their review: up to 5')}>
            {tr('When the person you helped leaves you a review, you earn 1 point for each star, so a 5-star review is 5 points.')}
          </MiniCard>
          <MiniCard title={tr('Your profile: up to 3')}>
            {tr('Your profile is split into 3 sets. Fill a whole set to earn its point: introduce yourself, share more about you, and verify yourself. It counts for every person you help.')}
          </MiniCard>
        </CardGrid>
        <SubHead>{tr('The five tiers')}</SubHead>
        <Bullets items={[
          <>{emphasize(tr('*New Member*: 0 points.'), (part) => <strong>{part}</strong>)}</>,
          <>{emphasize(tr('*Getting Started*: 1 to 14 points.'), (part) => <strong>{part}</strong>)}</>,
          <>{emphasize(tr('*Reliable*: 15 to 44 points.'), (part) => <strong>{part}</strong>)}</>,
          <>{emphasize(tr('*Highly Trusted*: 45 to 89 points.'), (part) => <strong>{part}</strong>)}</>,
          <>{emphasize(tr('*Community Champion*: 90 points and above.'), (part) => <strong>{part}</strong>)}</>,
        ]} />
        <NoteBox>
          {tr("After a connection reaches a full friendship, both people leave a 1 to 5 star rating, a few kind tags (Friendly, Punctual, Respectful, Helpful, Patient), and can quietly report a safety worry if something didn't feel right.")}
        </NoteBox>
      </>
    ),
  },
  {
    id: 'streaks',
    get navLabel() { return tr('Daily check-in'); },
    render: () => (
      <>
        <StepTitle>{tr('Your daily check-in')}</StepTitle>
        <Lead>
          {tr('Each day, tap "I\'m here today". The family you are linked with then see that you are alright, on their own page — you do not have to ring round or explain.')}
        </Lead>
        <Bullets items={[
          tr('The page tells you by name who will see it before you tap.'),
          tr('Your current streak counts the days you have checked in, one after another.'),
          tr('Your best streak is your all-time record, something to be proud of.'),
          tr('Miss a day and the current streak starts again, but your best streak is always kept.'),
          tr('No family added yet? The check-in still works, and the page shows you how to add them.'),
        ]} />
        <NoteBox>
          {tr("The check-in is the first screen elders see after logging in. Helpers do not have one — the check-in exists so an elder's family can stop worrying.")}
        </NoteBox>
      </>
    ),
  },
  {
    id: 'askai',
    get navLabel() { return tr('Ask AI'); },
    render: () => (
      <>
        <StepTitle>{tr('Ask AI, your tortoise helper')}</StepTitle>
        <Lead>
          {emphasize(tr('Stuck or unsure about something? Tap the round *Ask AI* button in the corner of the screen and ask in your own words.'), (part) => <strong>{part}</strong>)}
        </Lead>
        <Bullets items={[
          tr('Ask how anything on Towinly works, like "How does the Trust Journey work?"'),
          tr('When you are logged in, ask about your own account, like "What is my trust score?" or "How is my streak going?"'),
          tr('Not sure what to do next? Ask "What should I do today?" and it will point the way.'),
          tr('Tap "Read aloud" under any answer to hear it spoken out loud.'),
          tr('Rather talk than type? Tap the microphone and speak your question.'),
          tr('It replies in short, simple words, any time of day.'),
        ]} />
        <NoteBox>
          {tr("The tortoise only answers questions. It never changes anything on your account, and it never shares your details with anyone else. If it can't help, use the Feedback button and the Towinly team will step in.")}
        </NoteBox>
      </>
    ),
  },
  {
    id: 'feel',
    get navLabel() { return tr('The Towinly feel'); },
    render: () => (
      <>
        <StepTitle>{tr('The Towinly feel')}</StepTitle>
        <Lead>
          {tr('Every screen is made to feel calm, clear, and never rushed.')}
        </Lead>
        <Bullets items={[
          tr('Calm sky-blue colours and soft white cards, easy on the eyes.'),
          tr('The tortoise logo: steady and patient, because trust grows slowly and surely.'),
          tr('Big, clear text that is easy to read.'),
          tr('One simple thing per screen, nothing extra, nothing confusing.'),
        ]} />
      </>
    ),
  },
  {
    id: 'start',
    get navLabel() { return tr('Get started'); },
    render: ({ isLoggedIn, navigate, restart }) => (
      <>
        <StepTitle>{tr("You're ready")}</StepTitle>
        <Lead>
          {tr("Build your profile, connect with people near you, grow trust step by step, and meet safely. That's Towinly.")}
        </Lead>
        <button
          onClick={() => navigate(isLoggedIn ? '/dashboard' : '/register')}
          style={{
            width: '100%', background: SKY, color: '#fff', border: 'none',
            borderRadius: '9999px', padding: '13px 0', fontSize: '16px', fontWeight: 600,
            fontFamily: SF, cursor: 'pointer', marginTop: '8px',
            boxShadow: '0 4px 16px rgba(79,163,206,0.3)',
          }}
        >
          {isLoggedIn ? tr('Go to my dashboard') : tr('Create your account')}
        </button>
        <button
          onClick={restart}
          style={{
            width: '100%', background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: SF, fontSize: 'var(--text-sm)', color: 'var(--ink-3)', marginTop: '14px',
            textDecoration: 'underline', textUnderlineOffset: '3px',
          }}
        >
          {tr('Read the guide again from the start')}
        </button>
      </>
    ),
  },
];
