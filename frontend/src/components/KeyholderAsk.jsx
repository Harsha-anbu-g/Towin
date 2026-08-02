import { useEffect, useState } from 'react';
import api from '../api/axios';
import { KEYHOLDER_ASK } from './passOnLocks';

/**
 * "Somebody has asked you to hold a key", on the family member's own screen.
 *
 * This is the only place in the app where a person is asked to take on a duty about
 * somebody else's death, so three things about it are deliberate.
 *
 * <b>Both answers are ordinary buttons.</b> "No thanks" is not a quiet link under a large
 * blue "Yes" — it sits beside it at the same size. A card that makes yes the easy path is
 * how somebody ends up agreeing to something they did not want, which is the exact harm the
 * two-sided consent exists to prevent. The one filled button rule is kept by making neither
 * of them the page's primary: this card never carries the only filled button on a screen.
 *
 * <b>The numbers are real or absent.</b> "2 of the 3 of you would have to agree" is rebuilt
 * from what the elder actually chose. Before she has chosen, the sentence is not shown at
 * all rather than guessed.
 *
 * <b>Nothing is shown until something is asked.</b> No heading, no empty state, no "you have
 * no requests". Most people will never see this card, and a permanent reminder that a
 * relative might one day ask them about a death is not something to put on a family screen.
 */
export default function KeyholderAsk() {
  const [asks, setAsks] = useState([]);
  // Keyed by ask id: 'accepted' | 'declined'. The card stays put and changes what it says,
  // rather than vanishing — somebody who just answered a question about a death should get
  // an acknowledgement, not an empty space.
  const [answered, setAnswered] = useState({});
  const [sendingId, setSendingId] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    let live = true;
    api.get('/passon/keyholders/asked-of-me')
      .then(r => { if (live) setAsks(Array.isArray(r.data) ? r.data : []); })
      // Quiet on purpose. This sits on a screen whose real job is "is Mum okay", and an
      // error banner about a feature most people have never heard of would only alarm.
      .catch(() => {});
    return () => { live = false; };
  }, []);

  async function answer(ask, accept) {
    setSendingId(ask.id);
    setErrors(prev => ({ ...prev, [ask.id]: null }));
    try {
      await api.post(`/passon/keyholders/${ask.id}/respond`, { accept });
      setAnswered(prev => ({ ...prev, [ask.id]: accept ? 'accepted' : 'declined' }));
    } catch (err) {
      setErrors(prev => ({
        ...prev,
        [ask.id]: err?.response?.data?.message || KEYHOLDER_ASK.failed,
      }));
    } finally {
      setSendingId(null);
    }
  }

  if (asks.length === 0) return null;

  return (
    <div style={{ margin: '8px 0 16px' }}>
      {asks.map(ask => (
        <AskCard
          key={ask.id}
          ask={ask}
          answered={answered[ask.id]}
          error={errors[ask.id]}
          sending={sendingId === ask.id}
          onAnswer={answer}
        />
      ))}
    </div>
  );
}

function AskCard({ ask, answered, error, sending, onAnswer }) {
  const name = ask.ownerName;
  const showThreshold = ask.approvalsNeeded > 0 && ask.keyholderCount > 0;

  return (
    <section style={cardStyle} aria-label={KEYHOLDER_ASK.heading(name)}>
      <h2 style={headingStyle}>{KEYHOLDER_ASK.heading(name)}</h2>

      <p style={bodyStyle}>{KEYHOLDER_ASK.body(name)}</p>

      {showThreshold && (
        <p style={{ ...bodyStyle, marginTop: '10px' }}>
          {KEYHOLDER_ASK.threshold(ask.approvalsNeeded, ask.keyholderCount)}
        </p>
      )}

      {answered ? (
        <p style={{ ...bodyStyle, marginTop: '16px', color: 'var(--green-deep)' }}>
          {answered === 'accepted' ? KEYHOLDER_ASK.accepted(name) : KEYHOLDER_ASK.declined}
        </p>
      ) : (
        <>
          {error && <p style={errorStyle}>{error}</p>}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '16px' }}>
            {/* Same size, same weight, side by side. Neither answer is the easy one. */}
            <button type="button" disabled={sending} onClick={() => onAnswer(ask, true)} style={answerBtn}>
              {KEYHOLDER_ASK.yes}
            </button>
            <button type="button" disabled={sending} onClick={() => onAnswer(ask, false)} style={answerBtn}>
              {KEYHOLDER_ASK.no}
            </button>
          </div>
          <p style={reassuranceStyle}>{KEYHOLDER_ASK.reassurance}</p>
        </>
      )}
    </section>
  );
}

const cardStyle = {
  background: 'var(--canvas)',
  borderRadius: '18px',
  // Gold, not blue: this is the "trust" colour the rest of the Sealed box uses, and it
  // marks the card as something to read rather than something to act on quickly.
  border: '1px solid color-mix(in srgb, var(--gold-deep) 35%, transparent)',
  padding: '20px 24px',
  marginBottom: '14px',
};

const headingStyle = {
  fontFamily: 'var(--font-display)',
  fontWeight: 400,
  letterSpacing: '-0.02em',
  fontSize: 'var(--text-lg)',
  color: 'var(--ink)',
  margin: 0,
};

const bodyStyle = {
  fontSize: '17px',
  color: 'var(--ink-slate)',
  lineHeight: 1.65,
  margin: '12px 0 0',
};

const reassuranceStyle = {
  fontSize: '16px',
  color: 'var(--ink-3)',
  lineHeight: 1.5,
  margin: '12px 0 0',
};

const errorStyle = {
  fontSize: '16px',
  color: 'var(--red-mid)',
  lineHeight: 1.5,
  margin: '16px 0 0',
};

const answerBtn = {
  flex: '1 1 180px',
  background: 'transparent',
  color: 'var(--ink)',
  border: '1.5px solid var(--border)',
  borderRadius: '9999px',
  padding: '10px 22px',
  minHeight: '44px',
  fontSize: '16px',
  fontWeight: 600,
  fontFamily: 'inherit',
  cursor: 'pointer',
};
