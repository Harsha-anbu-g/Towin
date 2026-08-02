import { useState } from 'react';
import SmoothInput from './SmoothInput';
import PersonPicker from './PersonPicker';
import { AUDIENCES, LETTERS, NOT_HERE, STORY_BOX } from './passOnLocks';

/**
 * Writing one story, or one letter — and changing one afterwards.
 *
 * It opens in place of the button that started it, so the form's own Save is the
 * only filled button on the screen. Two buttons of equal weight asking "which of
 * these did you mean" is exactly the moment an older person stops.
 *
 * A story picks its audience; a letter does not, because a letter goes to one
 * person and only that person — that is what makes it a letter. A letter also
 * picks when that person may read it, and a story never does: a story is
 * something she shares while she is here, and the server says the same thing back
 * to her as a sentence if a client ever asks otherwise.
 *
 * `releaseWhen` is sent on every letter and never left out. The server reads a
 * missing one as "read it today", so a form that omitted it would quietly hand a
 * held letter to a living person the next time she came back to fix a typo.
 *
 * Props:
 *   kind              — 'STORY' | 'LETTER'
 *   initial           — the item being changed, or null when writing a new one
 *   people            — [{ id, name, note }] for the person picker
 *   canHoldUntilGone  — whether her Sealed box is set up, and so whether anybody
 *                       could ever ask for a held letter to be opened
 *   saving            — disables the buttons while the save is in flight
 *   onSave({ kind, title, body, audience, audienceUserId, releaseWhen? })
 *   onCancel()
 *   onGoToSealedBox() — from the reason the hold is greyed out
 */
export default function PassOnItemForm({
  kind, initial, people, canHoldUntilGone, saving, onSave, onCancel, onGoToSealedBox,
}) {
  const isLetter = kind === 'LETTER';
  const [title, setTitle] = useState(initial?.title || '');
  const [body, setBody] = useState(initial?.body || '');
  const [audience, setAudience] = useState(initial?.audience || (isLetter ? 'PERSON' : 'FAMILY'));
  const [personId, setPersonId] = useState(initial?.audienceUserId || null);
  const [releaseWhen, setReleaseWhen] = useState(initial?.releaseWhen || 'NOW');
  const [problem, setProblem] = useState('');

  const wantsPerson = isLetter || audience === 'PERSON';

  /**
   * A letter she is already holding stays offerable even with no Sealed box.
   *
   * She can arm her box, write her last words into a held letter, and then undo
   * the setup — the undo is a real button one tab away. Greying the choice out
   * underneath her at that point would turn the letter she wrote for after her
   * death into one her daughter reads this afternoon, on a save she thought was
   * a typo fix.
   */
  const canHold = canHoldUntilGone || initial?.releaseWhen === 'AFTER';

  function submit(e) {
    e.preventDefault();
    if (!title.trim()) return setProblem('Please give it a name.');
    if (!body.trim()) return setProblem(isLetter ? 'Please write something before you save it.' : 'Please tell it before you save it.');
    if (wantsPerson && !personId) return setProblem('Please choose the one person this is for.');
    setProblem('');
    onSave({
      kind,
      title: title.trim(),
      body: body.trim(),
      audience: isLetter ? 'PERSON' : audience,
      audienceUserId: wantsPerson ? personId : null,
      // Letters only. A story is for people to read now, and asking the server to
      // hold one is the one request it answers with a refusal.
      ...(isLetter ? { releaseWhen: canHold ? releaseWhen : 'NOW' } : {}),
    });
  }

  const bodyId = `passon-body-${kind.toLowerCase()}`;

  return (
    <form onSubmit={submit} style={cardStyle}>
      <div style={{ marginBottom: '18px' }}>
        <label htmlFor="passon-title" style={labelStyle}>{STORY_BOX.namePrompt}</label>
        <SmoothInput
          id="passon-title"
          className="field"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={isLetter ? 'For Sarah' : STORY_BOX.namePlaceholder}
          maxLength={120}
        />
      </div>

      <div style={{ marginBottom: '18px' }}>
        <label htmlFor={bodyId} style={labelStyle}>
          {isLetter ? LETTERS.bodyPrompt : STORY_BOX.bodyPrompt}
        </label>
        <textarea
          id={bodyId}
          className="field"
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={8}
          maxLength={20000}
          style={{ fontSize: '18px', lineHeight: 1.6, resize: 'vertical', minHeight: '180px' }}
        />
      </div>

      {!isLetter && (
        <p style={{
          fontSize: '16px', color: 'var(--gold-deep)', lineHeight: 1.5,
          margin: '0 0 18px',
        }}>
          {NOT_HERE}
        </p>
      )}

      {!isLetter && (
        <div style={{ marginBottom: wantsPerson ? '18px' : '22px' }}>
          <RadioCards
            prompt={STORY_BOX.audiencePrompt}
            options={AUDIENCES}
            value={audience}
            onChange={setAudience}
          />
        </div>
      )}

      {wantsPerson && (
        <div style={{ marginBottom: isLetter ? '18px' : '22px' }}>
          <PersonPicker
            people={people}
            value={personId}
            onChange={setPersonId}
            label={LETTERS.personPrompt}
            emptyMessage={LETTERS.noneToWriteTo}
          />
        </div>
      )}

      {isLetter && (
        <div style={{ marginBottom: '22px' }}>
          <RadioCards
            prompt={LETTERS.whenPrompt}
            options={LETTERS.WHEN.map(o => (
              o.key === 'AFTER' && !canHold
                ? { ...o, disabled: true, describedBy: NEEDS_KEYHOLDERS_ID }
                : o
            ))}
            value={releaseWhen}
            onChange={setReleaseWhen}
          />
          {!canHold && <NeedsKeyholders onGoToSealedBox={onGoToSealedBox} />}
        </div>
      )}

      {problem && (
        <p className="danger-text" role="alert" style={{ fontSize: '16px', fontWeight: 500, margin: '0 0 14px' }}>
          {problem}
        </p>
      )}

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button type="submit" disabled={saving} style={{ ...fillBtn, flex: 1, minWidth: '160px' }}>
          {saving ? 'Saving…' : isLetter ? LETTERS.save : STORY_BOX.save}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} style={{ ...ghostBtn, flex: 1, minWidth: '120px' }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * One question, one large tappable card per answer, in the elder's own words.
 *
 * Shared by the four audiences and by the two release times rather than written
 * twice: they are the same question shape, and an elder who has learned to tap
 * these cards once should not meet a second control that behaves differently
 * further down the same form.
 *
 * An option may be `disabled`, which the audiences never use and the release
 * times do. Arrow keys walk only the ones she can actually choose, and the
 * disabled card carries `aria-describedby` so the reason is read out with it
 * rather than sitting on screen unattached.
 *
 * @param options [{ key, title, blurb, disabled?, describedBy? }]
 */
function RadioCards({ prompt, options, value, onChange }) {
  const onKeyDown = (e) => {
    const keys = options.filter(o => !o.disabled).map(o => o.key);
    const i = keys.indexOf(value);
    let next = null;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = keys[(i + 1) % keys.length];
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = keys[(i - 1 + keys.length) % keys.length];
    else if (e.key === 'Home') next = keys[0];
    else if (e.key === 'End') next = keys[keys.length - 1];
    if (next == null) return;
    e.preventDefault();
    onChange(next);
    e.currentTarget.closest('[role="radiogroup"]')?.querySelector(`[data-choice="${next}"]`)?.focus();
  };

  return (
    <div>
      <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--ink)', margin: '0 0 10px' }}>
        {prompt}
      </p>
      <div role="radiogroup" aria-label={prompt}
        style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {options.map(o => {
          const chosen = value === o.key;
          return (
            <button
              key={o.key}
              type="button"
              role="radio"
              data-choice={o.key}
              aria-checked={chosen}
              aria-describedby={o.describedBy}
              disabled={o.disabled}
              tabIndex={chosen ? 0 : -1}
              onClick={() => onChange(o.key)}
              onKeyDown={onKeyDown}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                cursor: o.disabled ? 'default' : 'pointer',
                minHeight: '56px', padding: '12px 16px', borderRadius: '14px',
                border: chosen ? '1.5px solid var(--blue)' : '1px solid var(--border)',
                background: chosen ? 'var(--blue-wash)' : 'var(--canvas)',
                fontFamily: 'inherit',
                transition: 'background-color 140ms cubic-bezier(0.22, 1, 0.36, 1), border-color 140ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              {/* A card she cannot choose goes quiet, never faint: this is a form about
                  her death read by somebody in her eighties, and an option dimmed below
                  reading contrast is one she cannot find out how to unlock. */}
              <span style={{
                display: 'block', fontSize: '17px', fontWeight: 600,
                color: o.disabled ? 'var(--ink-3)' : 'var(--ink)',
              }}>
                {o.title}
              </span>
              <span style={{ display: 'block', fontSize: '16px', color: 'var(--ink-3)', lineHeight: 1.45, marginTop: '2px' }}>
                {o.blurb}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Ties the disabled card to its reason, for anybody reading with a screen reader. */
const NEEDS_KEYHOLDERS_ID = 'passon-needs-keyholders';

/**
 * Why she cannot hold a letter yet, and the one place that changes it.
 *
 * Said out loud under the greyed-out card rather than hidden behind it. The
 * Sealed box is where her Keyholders and her quorum live, and without them there
 * is nobody who could ever ask for a held letter to be opened — so the honest
 * thing is to show her the choice, say what it needs, and point at it.
 */
function NeedsKeyholders({ onGoToSealedBox }) {
  return (
    <div id={NEEDS_KEYHOLDERS_ID} style={{
      background: 'var(--gold-wash)', border: '1px solid var(--gold-deep)',
      borderRadius: '14px', padding: '14px 18px', marginTop: '10px',
    }}>
      <p style={{ fontSize: '16px', color: 'var(--ink)', lineHeight: 1.6, margin: 0 }}>
        {LETTERS.needsKeyholders}
      </p>
      <button
        type="button"
        onClick={onGoToSealedBox}
        style={{
          display: 'inline-flex', alignItems: 'center', minHeight: '44px',
          background: 'transparent', border: 'none', padding: 0, marginTop: '4px',
          fontFamily: 'inherit', fontSize: '16px', fontWeight: 600,
          color: 'var(--blue)', cursor: 'pointer', textDecoration: 'underline',
        }}
      >
        {LETTERS.needsKeyholdersLink}
      </button>
    </div>
  );
}

const cardStyle = {
  background: 'var(--canvas)',
  borderRadius: '18px',
  border: '1px solid var(--border)',
  padding: '22px 24px',
  marginBottom: '14px',
};

const labelStyle = {
  display: 'block',
  fontSize: '17px',
  fontWeight: 600,
  color: 'var(--ink)',
  marginBottom: '8px',
};

const fillBtn = {
  background: 'var(--action-fill)',
  color: 'var(--action-ink)',
  border: 'none',
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
  minHeight: '48px',
  fontSize: '17px',
  fontWeight: 600,
  fontFamily: 'inherit',
  cursor: 'pointer',
};
