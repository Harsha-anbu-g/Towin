import { useState } from 'react';
import SmoothInput from './SmoothInput';
import { NO_CAPTURE } from '../lib/analytics';
import { FROZEN, RELEASE_CONTACT, SEALED_ITEMS, SEALED_KINDS } from './passOnLocks';

/**
 * One thing in her Sealed box, as it sits on her own screen.
 *
 * <b>There is no preview, and there is no way to add one.</b> The list this card is built
 * from carries a name, a chip, a size and a date, and no body at all — so a card showing the
 * first line of "where the money is" is not something a careless change could produce here.
 * The words exist on this screen for exactly as long as she is looking at them: they arrive
 * from one call, live in this component's own state, and are gone the moment she taps [Hide
 * this again], leaves the tab, or reloads. Nothing is cached and nothing is lifted into the
 * page above.
 *
 * <b>Every refusal is the server's own sentence.</b> A wrong password and the seven-day freeze
 * after a password change are both shown word for word as they arrive, because the freeze
 * carries a real date she may act on. The screen adds one thing to the freeze: somebody to
 * write to, which is the missing half of "tell us straight away".
 *
 * Props:
 *   item      — { id, label, kindHint }
 *   onRemove(item)
 *   onReveal(item, password) → Promise<{ label, body }>, rejecting with the server's refusal
 */
export default function SealedItemCard({ item, onRemove, onReveal }) {
  const [asking, setAsking] = useState(false);
  const [password, setPassword] = useState('');
  const [opening, setOpening] = useState(false);
  const [problem, setProblem] = useState('');
  const [words, setWords] = useState(null);

  const passwordId = `sealed-password-${item.id}`;
  const isOpen = words !== null;

  /** Forgets the password the moment it has been used, whether it worked or not. */
  const closeUp = () => {
    setAsking(false);
    setPassword('');
    setProblem('');
  };

  async function open(e) {
    e.preventDefault();
    if (!password) return setProblem(SEALED_ITEMS.needsPassword);
    setProblem('');
    setOpening(true);
    try {
      const opened = await onReveal(item, password);
      setWords(opened?.body || '');
      closeUp();
    } catch (err) {
      setProblem(err?.response?.data?.message || SEALED_ITEMS.failedToOpen);
      setPassword('');
    } finally {
      setOpening(false);
    }
  }

  return (
    <article style={cardStyle}>
      <div style={headerRow}>
        {/* Her words. The name is encrypted in the database precisely because "Where the
            cash is hidden", attached to a named elderly person at a known address, is a
            burglary list — so it is kept out of the session recording too. */}
        <h3 className={NO_CAPTURE} style={nameStyle}>{item.label}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={quietChip}>{SEALED_KINDS[item.kindHint] || SEALED_KINDS.OTHER}</span>
          <span style={stateWord}>
            {!isOpen && <LockIcon />}
            {isOpen ? SEALED_ITEMS.unlocked : SEALED_ITEMS.locked}
          </span>
        </div>
      </div>

      {isOpen && (
        <p className={NO_CAPTURE} style={wordsStyle}>{words}</p>
      )}

      {asking && !isOpen && (
        <form onSubmit={open} style={askRow}>
          {/* The sentence is what she is being told; "Your password" is what the box is for.
              Keeping them apart means the field's own name is the words above it, rather
              than a whole instruction a screen reader has to read out on every keystroke. */}
          <p id={`${passwordId}-why`} style={askLine}>{SEALED_ITEMS.askPassword}</p>
          <label htmlFor={passwordId} style={fieldLabel}>{SEALED_ITEMS.passwordLabel}</label>
          <SmoothInput
            id={passwordId}
            className="field"
            type="password"
            autoComplete="current-password"
            aria-describedby={`${passwordId}-why`}
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          {problem && (
            <p className="danger-text" role="alert" style={problemStyle}>
              {problem}
              {problem.startsWith(FROZEN.prefix) && (
                <span style={{ display: 'block', marginTop: '6px' }}>
                  {FROZEN.tellUs(RELEASE_CONTACT.who, RELEASE_CONTACT.email)}
                </span>
              )}
            </p>
          )}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '14px' }}>
            <button type="submit" disabled={opening} style={outlineBtn}>
              {opening ? SEALED_ITEMS.showing : SEALED_ITEMS.show}
            </button>
            <button type="button" onClick={closeUp} disabled={opening} style={ghostBtn}>
              {SEALED_ITEMS.neverMind}
            </button>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
        {!asking && !isOpen && (
          <button type="button" onClick={() => setAsking(true)} style={ghostBtn}>
            {SEALED_ITEMS.see}
          </button>
        )}
        {isOpen && (
          <button type="button" onClick={() => setWords(null)} style={ghostBtn}>
            {SEALED_ITEMS.hide}
          </button>
        )}
        <button type="button" onClick={() => onRemove(item)} style={ghostBtn}>
          {SEALED_ITEMS.remove}
        </button>
      </div>
    </article>
  );
}

/** A drawn lock, not a glyph — a ✓ or a 🔒 in a text node reads as a machine wrote the page. */
function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

const cardStyle = {
  background: 'var(--canvas)',
  borderRadius: '18px',
  border: '1px solid var(--border)',
  padding: '20px 24px',
  marginBottom: '14px',
};

const headerRow = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '12px',
  flexWrap: 'wrap',
};

/** The name she gave it, at the size the design fixes for it. */
const nameStyle = {
  fontFamily: 'var(--font-display)',
  fontWeight: 400,
  letterSpacing: '-0.02em',
  fontSize: '18px',
  color: 'var(--ink)',
  margin: 0,
};

const quietChip = {
  fontSize: '15px',
  fontWeight: 600,
  color: 'var(--ink-3)',
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: '9999px',
  padding: '4px 12px',
  whiteSpace: 'nowrap',
};

const stateWord = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  fontSize: '15px',
  fontWeight: 600,
  color: 'var(--ink-3)',
  whiteSpace: 'nowrap',
};

const wordsStyle = {
  fontSize: '17px',
  color: 'var(--ink)',
  lineHeight: 1.65,
  whiteSpace: 'pre-wrap',
  margin: '14px 0 0',
  padding: '14px 16px',
  background: 'var(--gold-wash)',
  border: '1px solid var(--hairline-2)',
  borderRadius: '14px',
};

/**
 * Opens in place, under the card she asked about. A dialog would take the name off the screen
 * at the exact moment she has to decide whether this is the thing she meant to open.
 */
const askRow = {
  marginTop: '14px',
  paddingTop: '16px',
  borderTop: '1px solid var(--hairline)',
  animation: 'fadeSlideUp 180ms cubic-bezier(0.22, 1, 0.36, 1)',
};

const askLine = {
  fontSize: '17px',
  fontWeight: 600,
  color: 'var(--ink)',
  margin: 0,
};

const fieldLabel = {
  display: 'block',
  fontSize: '16px',
  color: 'var(--ink-3)',
  margin: '12px 0 6px',
};

const problemStyle = {
  fontSize: '16px',
  fontWeight: 500,
  lineHeight: 1.55,
  margin: '12px 0 0',
};

/**
 * Outlined in the action colour rather than filled with it. There is one filled sky-blue
 * button on this tab — [Put something in] — and a second one appearing beside it, on a screen
 * about somebody's death, is exactly the moment an older person stops to work out which they
 * meant.
 */
const outlineBtn = {
  background: 'transparent',
  color: 'var(--blue)',
  border: '1.5px solid var(--blue)',
  borderRadius: '9999px',
  padding: '10px 20px',
  minHeight: '48px',
  fontSize: '17px',
  fontWeight: 600,
  fontFamily: 'inherit',
  cursor: 'pointer',
};

const ghostBtn = {
  background: 'transparent',
  color: 'var(--ink-3)',
  border: '1.5px solid var(--border)',
  borderRadius: '9999px',
  padding: '10px 18px',
  minHeight: '44px',
  fontSize: '16px',
  fontWeight: 600,
  fontFamily: 'inherit',
  cursor: 'pointer',
};
