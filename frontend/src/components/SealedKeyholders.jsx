import { Link } from 'react-router-dom';
import { SETUP, SHEET, keyholderLine, listOfNames } from './passOnLocks';

const SF = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

/**
 * Her box once it is set up: the seven days she has to take it all back, and then
 * who holds a key.
 *
 * <b>The week is the point.</b> Nothing in this app can stop a relative sitting
 * beside an elder and tapping through the whole setup in one visit. What can be
 * done is leave the way out open for seven days, in a card she cannot miss, with a
 * button that says in her own words what it is for. So the undo is never behind a
 * menu, never behind "Advanced", and never a link the size of a footnote.
 *
 * <b>Every status is the real one.</b> "David has not answered yet" is a sentence
 * an elder may act on — she may ask somebody else — so it is never softened into
 * "pending" and never rounded up into a count that includes him.
 *
 * Props:
 *   setup       — the server's setup state
 *   keyholders  — [{ id, personName, status, respondedAt }] as the server derived it
 *   undoing     — true while the undo call is in flight
 *   onUndo(), onChange()
 */
export default function SealedKeyholders({ setup, keyholders, undoing, onUndo, onChange }) {
  // A key she took back herself is not part of "who can open it one day", and she
  // is the one who took it. Every other ending stays on the list, because she did
  // not necessarily cause it and needs to see that the number has moved.
  const shown = (keyholders || []).filter(k => k.status !== 'REMOVED');
  const standing = shown.filter(k => k.status === 'INVITED' || k.status === 'ACTIVE');

  return (
    <div>
      {setup.canStillUndo && (
        <section style={settlingCard} aria-label="Your box is set up">
          <h2 style={{ ...displayHead, fontSize: 'var(--text-lg)' }}>{SETUP.settling.title}</h2>
          <p style={{ fontSize: '17px', color: 'var(--ink-slate)', lineHeight: 1.6, margin: '10px 0 0' }}>
            {SETUP.settling.body(listOfNames(standing.map(k => k.personName)))}
          </p>
          <button
            type="button"
            onClick={onUndo}
            disabled={undoing}
            className="btn-ghost"
            style={{ height: '48px', padding: '0 18px', fontSize: '17px', marginTop: '18px' }}
          >
            {SETUP.settling.undo}
          </button>
        </section>
      )}

      <section style={listCard} aria-label={SETUP.settled.heading}>
        {/* One step below the settling card above it: while the week is running, the
            card she can act on has to be the louder of the two. */}
        <h2 style={{ ...displayHead, fontSize: '20px' }}>{SETUP.settled.heading}</h2>
        {setup.approvalsNeeded && setup.keyholderTarget && (
          <p style={thresholdLine}>
            {SETUP.settled.threshold(setup.approvalsNeeded, setup.keyholderTarget)}
          </p>
        )}

        <ul style={{ listStyle: 'none', margin: '16px 0 0', padding: 0 }}>
          {shown.map(person => (
            <li key={person.id} style={personRow}>
              <span aria-hidden="true" style={{ ...dot, background: dotColour(person.status) }} />
              <span style={{ fontSize: '17px', color: 'var(--ink)', lineHeight: 1.5 }}>
                {keyholderLine(person)}
              </span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onChange}
          className="btn-ghost"
          style={{ height: '48px', padding: '0 18px', fontSize: '17px', marginTop: '18px' }}
        >
          {SETUP.settled.change}
        </button>
      </section>

      {/* The way to her saved copy. It sits below the arrangement rather than beside the undo,
          because it is the one thing on this page that is worth doing every time something
          here changes — and a page nobody can reach is a page that is not shipped. */}
      <Link to="/what-i-pass-on/sheet" style={sheetLink}>
        {SHEET.linkFromBox}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </Link>
    </div>
  );
}

/**
 * Green only for somebody actually holding a key — the app's own rule that green
 * means achieved rather than in progress.
 */
function dotColour(status) {
  if (status === 'ACTIVE') return 'var(--green-deep)';
  if (status === 'INVITED') return 'var(--gold-deep)';
  return 'var(--ink-3)';
}

const displayHead = {
  fontFamily: 'var(--font-display)',
  fontWeight: 400,
  letterSpacing: '-0.02em',
  color: 'var(--ink)',
  margin: 0,
};

/** Gold, not blue: something to read carefully, not something to act on quickly. */
const settlingCard = {
  background: 'var(--gold-wash)',
  border: '1px solid var(--gold-deep)',
  borderRadius: '18px',
  padding: '24px',
  marginBottom: '16px',
  fontFamily: SFText,
};

const listCard = {
  background: 'var(--canvas)',
  border: '1px solid var(--border)',
  borderRadius: '18px',
  padding: '24px',
  fontFamily: SFText,
};

const thresholdLine = {
  fontSize: '17px',
  color: 'var(--ink-slate)',
  lineHeight: 1.6,
  margin: '10px 0 0',
  fontFamily: SF,
};

const personRow = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  minHeight: '48px',
  padding: '4px 0',
  borderTop: '1px solid var(--hairline)',
};

const dot = { width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0 };

const sheetLink = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  minHeight: '48px',
  marginTop: '16px',
  fontSize: '17px',
  color: 'var(--blue)',
  textDecoration: 'none',
  fontFamily: SFText,
};
