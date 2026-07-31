import { useMemo, useState } from 'react';
import { SETUP, listOfNames } from './passOnLocks';

const SF = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

const SMALLEST_POOL = 3;
const LARGEST_POOL = 5;
const STEPS = 3;

/**
 * Setting the Sealed box up, in three steps.
 *
 * Two rules here are worth more than the layout.
 *
 * **Nothing leaves until the last button.** Who she picked, how many must agree and
 * the two acknowledgements all travel in one call at the end. Sending the
 * invitations as she taps each name would mean an elder who opened this out of
 * curiosity and backed out at step two has asked three relatives a question about
 * her own death. The card she is shown afterwards says "we have written to Sarah,
 * David and Ruth", and that sentence has to become true at the moment it appears.
 *
 * **The two ticked sentences come from the server and go straight back.** The
 * server stores a hash of the exact wording shown and refuses any wording it does
 * not publish, so this file must never hold its own copy of them, and must never
 * tidy the punctuation on the way through.
 *
 * Props:
 *   family  — [{ id, name, note }], her family list; Keyholders come from nowhere else
 *   setup   — the server's setup state, including the two sentences and what would
 *             stop her finishing
 *   already — the people already standing, pre-ticked when she comes back to change it
 *   saving  — true while the finish call is in flight
 *   onFinish({ personIds, approvalsNeeded, notAWillAck, keyTruthAck })
 *   onCancel()
 */
export default function SealedSetup({ family, setup, already = [], saving, onFinish, onCancel }) {
  const [step, setStep] = useState(1);
  // Kept in the order she tapped them, which is the order they are asked in.
  const [picked, setPicked] = useState(() => already.filter(id => family.some(p => p.id === id)));
  const [approvals, setApprovals] = useState(setup?.approvalsNeeded || 2);
  const [notAWill, setNotAWill] = useState(false);
  const [keyTruth, setKeyTruth] = useState(false);

  const enoughPeople = family.length >= SMALLEST_POOL;
  const chosen = useMemo(
    () => picked.map(id => family.find(p => p.id === id)).filter(Boolean),
    [picked, family],
  );

  // Never fewer than two, and never all of them: the first Keyholder who is
  // unreachable would otherwise keep the box shut forever.
  const workableNumbers = useMemo(() => {
    const numbers = [];
    for (let n = 2; n <= picked.length - 1; n += 1) numbers.push(n);
    return numbers;
  }, [picked.length]);

  const mustAgree = workableNumbers.includes(approvals) ? approvals : workableNumbers[0] || 2;
  const canFinish = setup?.emailConfirmed && setup?.hasPassword && notAWill && keyTruth && !saving;

  const toggle = (id) => setPicked(current => (
    current.includes(id)
      ? current.filter(other => other !== id)
      : [...current, id]
  ));

  const finish = () => onFinish({
    personIds: picked,
    approvalsNeeded: mustAgree,
    // Straight back out, untouched. See the note at the top of this file.
    notAWillAck: setup.notAWillAck,
    keyTruthAck: setup.keyTruthAck,
  });

  return (
    <section style={cardStyle} aria-label="Setting up your sealed box">
      <p style={stepCount}>{SETUP.step(step, STEPS)}</p>

      {step === 1 && (
        <Step title={SETUP.who.title} blurb={SETUP.who.blurb}>
          {!enoughPeople ? (
            <p style={deadEnd}>{SETUP.who.tooFew}</p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {family.map(person => (
                  <PersonTick
                    key={person.id}
                    person={person}
                    checked={picked.includes(person.id)}
                    // Five is the whole family list, so this can only bind if that cap moves.
                    disabled={!picked.includes(person.id) && picked.length >= LARGEST_POOL}
                    onToggle={() => toggle(person.id)}
                  />
                ))}
              </div>
              <p style={quietLine}>{SETUP.who.nothingSentYet}</p>
            </>
          )}
        </Step>
      )}

      {step === 2 && (
        <Step title={SETUP.howMany.title} blurb={SETUP.howMany.blurb}>
          {workableNumbers.length > 1 && (
            <div role="radiogroup" aria-label={SETUP.howMany.title} style={numberRow}>
              {workableNumbers.map(n => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={n === mustAgree}
                  onClick={() => setApprovals(n)}
                  style={n === mustAgree ? numberOn : numberOff}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
          {/* Rebuilt from her real names every time it is drawn. A worked example with
              invented names on a screen about her death is the one thing this must
              never contain. */}
          <p style={realTerms}>
            {SETUP.howMany.inRealTerms(mustAgree, listOfNames(chosen.map(p => p.name)), chosen.length)}
          </p>
        </Step>
      )}

      {step === 3 && (
        <Step title={SETUP.before.title}>
          {/* Both gates are hard: no finish button exists while either is unmet. Telling
              her afterwards, once she has picked three people and ticked two boxes,
              would be a small cruelty on a screen about her death. */}
          {!setup.emailConfirmed && (
            <Blocked message={SETUP.before.confirmEmail} to="/settings" label={SETUP.before.confirmEmailLink} />
          )}
          {setup.emailConfirmed && !setup.hasPassword && (
            <Blocked message={SETUP.before.needsPassword} />
          )}

          {setup.emailConfirmed && setup.hasPassword && (
            <>
              <h3 style={subHead}>{SETUP.before.saveHeading}</h3>
              <p style={{ ...blurbStyle, marginTop: '8px' }}>{SETUP.before.save}</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '22px' }}>
                <Ack id="ack-not-a-will" checked={notAWill} onToggle={setNotAWill}>
                  {setup.notAWillAck}
                </Ack>
                <Ack id="ack-key-truth" checked={keyTruth} onToggle={setKeyTruth}>
                  {setup.keyTruthAck}
                </Ack>
              </div>
            </>
          )}
        </Step>
      )}

      <div style={buttonRow}>
        {step > 1 && (
          <button type="button" onClick={() => setStep(s => s - 1)} className="btn-ghost" style={ghostBtn}>
            {SETUP.back}
          </button>
        )}
        <button type="button" onClick={onCancel} className="btn-ghost" style={ghostBtn}>
          {SETUP.cancel}
        </button>
        {step < STEPS && (
          <button
            type="button"
            onClick={() => setStep(s => s + 1)}
            disabled={step === 1 && picked.length < SMALLEST_POOL}
            style={picked.length < SMALLEST_POOL && step === 1 ? fillBtnOff : fillBtn}
          >
            {SETUP.next}
          </button>
        )}
        {step === STEPS && setup.emailConfirmed && setup.hasPassword && (
          <button type="button" onClick={finish} disabled={!canFinish} style={canFinish ? fillBtn : fillBtnOff}>
            {SETUP.finish}
          </button>
        )}
      </div>
    </section>
  );
}

function Step({ title, blurb, children }) {
  return (
    <div>
      <h2 style={titleStyle}>{title}</h2>
      {blurb && <p style={blurbStyle}>{blurb}</p>}
      <div style={{ marginTop: '20px' }}>{children}</div>
    </div>
  );
}

/**
 * One person, as a whole tappable row. A checkbox on its own is a 20px target on a
 * screen for hands that shake; the row is the target and the box is the marker.
 */
function PersonTick({ person, checked, disabled, onToggle }) {
  return (
    <label
      style={{
        display: 'flex', alignItems: 'center', gap: '14px', minHeight: '60px',
        padding: '10px 16px', borderRadius: '14px', cursor: disabled ? 'default' : 'pointer',
        background: checked ? 'var(--gold-wash)' : 'var(--canvas)',
        border: `1px solid ${checked ? 'var(--gold-deep)' : 'var(--hairline-2)'}`,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        style={{ width: '22px', height: '22px', accentColor: 'var(--gold-deep)', flexShrink: 0 }}
      />
      <span>
        <span style={{ display: 'block', fontSize: '17px', color: 'var(--ink)' }}>{person.name}</span>
        {person.note && (
          <span style={{ display: 'block', fontSize: '15px', color: 'var(--ink-3)', marginTop: '2px' }}>
            {person.note}
          </span>
        )}
      </span>
    </label>
  );
}

/** One of the two sentences whose exact wording is stored against her name. */
function Ack({ id, checked, onToggle, children }) {
  return (
    <label
      htmlFor={id}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '14px 16px',
        borderRadius: '14px', border: '1px solid var(--hairline-2)',
        background: 'var(--canvas)', cursor: 'pointer',
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={e => onToggle(e.target.checked)}
        style={{ width: '22px', height: '22px', accentColor: 'var(--gold-deep)', flexShrink: 0, marginTop: '2px' }}
      />
      <span style={{ fontSize: '16px', color: 'var(--ink)', lineHeight: 1.55 }}>{children}</span>
    </label>
  );
}

/** A wall, said in words, with the way through it when there is one. */
function Blocked({ message, to, label }) {
  return (
    <div style={{
      background: 'var(--gold-wash)', border: '1px solid var(--gold-deep)',
      borderRadius: '14px', padding: '16px 20px',
    }}>
      <p style={{ fontSize: '16px', color: 'var(--ink)', lineHeight: 1.6, margin: 0 }}>{message}</p>
      {to && (
        <a href={to} style={{
          display: 'inline-flex', alignItems: 'center', minHeight: '44px',
          fontSize: '16px', color: 'var(--blue)', marginTop: '6px',
        }}>
          {label}
        </a>
      )}
    </div>
  );
}

const cardStyle = {
  background: 'var(--canvas)',
  borderRadius: '18px',
  border: '1px solid var(--border)',
  padding: '24px',
  fontFamily: SFText,
};

const stepCount = {
  fontSize: '15px',
  fontWeight: 600,
  color: 'var(--ink-3)',
  letterSpacing: '0.02em',
  margin: '0 0 10px',
};

const titleStyle = {
  fontFamily: 'var(--font-display)',
  fontWeight: 400,
  letterSpacing: '-0.02em',
  fontSize: 'var(--text-lg)',
  color: 'var(--ink)',
  margin: 0,
};

const blurbStyle = {
  fontSize: '17px',
  color: 'var(--ink-slate)',
  lineHeight: 1.6,
  margin: '10px 0 0',
};

const subHead = { fontSize: '17px', fontWeight: 600, color: 'var(--ink)', fontFamily: SF, margin: 0 };

const quietLine = {
  fontSize: '15px',
  color: 'var(--ink-3)',
  lineHeight: 1.5,
  margin: '14px 0 0',
};

const deadEnd = {
  fontSize: '17px',
  color: 'var(--ink-slate)',
  lineHeight: 1.6,
  margin: 0,
};

const realTerms = {
  fontSize: '17px',
  color: 'var(--ink)',
  lineHeight: 1.6,
  margin: '18px 0 0',
  paddingLeft: '14px',
  borderLeft: '2px solid var(--gold-deep)',
};

const numberRow = { display: 'flex', gap: '10px', flexWrap: 'wrap' };

const numberBase = {
  minWidth: '60px',
  minHeight: '60px',
  borderRadius: '14px',
  fontSize: '20px',
  fontWeight: 600,
  fontFamily: SFText,
  cursor: 'pointer',
};

const numberOn = {
  ...numberBase,
  background: 'var(--gold-wash)',
  border: '1px solid var(--gold-deep)',
  color: 'var(--ink)',
};

const numberOff = {
  ...numberBase,
  background: 'var(--canvas)',
  border: '1px solid var(--hairline-2)',
  color: 'var(--ink-slate)',
};

const buttonRow = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
  marginTop: '26px',
  paddingTop: '20px',
  borderTop: '1px solid var(--hairline)',
};

const ghostBtn = { height: '48px', padding: '0 18px', fontSize: '17px' };

const fillBtn = {
  background: 'var(--action-fill)',
  color: 'var(--action-ink)',
  border: 'none',
  borderRadius: '9999px',
  padding: '0 22px',
  minHeight: '48px',
  fontSize: '17px',
  fontWeight: 600,
  fontFamily: SFText,
  cursor: 'pointer',
  marginLeft: 'auto',
};

/** Still readable, still 48px, and plainly not ready — never hidden. */
const fillBtnOff = {
  ...fillBtn,
  background: 'var(--hairline-2)',
  color: 'var(--ink-3)',
  cursor: 'default',
};
