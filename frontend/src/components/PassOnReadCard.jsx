import { NO_CAPTURE } from '../lib/analytics';
import { FROM_PAGE, REPORT_STORY } from './passOnLocks';

/**
 * One story or letter as a visitor reads it.
 *
 * Deliberately not PassOnItemCard with a flag. That card is the owner's, and it carries
 * Change and Remove; a visitor's card must have no branch that could ever render either,
 * so the two are separate files rather than one file with an `isMine` running through it.
 *
 * The audience chip is absent on purpose too. "My family" tells the reader who *else* can
 * see this, which is the writer's business and not the reader's. A letter is the one thing
 * worth naming, because a letter reaching you at all means it was written to you.
 */
export default function PassOnReadCard({
  item,
  reportOpen,
  reportSent,
  reportError,
  sending,
  onOpenReport,
  onCancelReport,
  onSendReport,
}) {
  const isLetter = item.kind === 'LETTER';

  return (
    <article style={cardStyle}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        gap: '12px', flexWrap: 'wrap',
      }}>
        {/* Somebody else's words, hidden from session replay for the same reason as on the
            owner's card: a reader is still reading a letter written to them. */}
        <h2 className={NO_CAPTURE} style={{
          fontFamily: 'var(--font-display)', fontWeight: 400, letterSpacing: '-0.02em',
          fontSize: 'var(--text-lg)', color: 'var(--ink)', margin: 0,
        }}>
          {item.title}
        </h2>
        {isLetter && <span style={letterChip}>{FROM_PAGE.letterChip}</span>}
      </div>

      <p className={NO_CAPTURE} style={{
        fontSize: '17px', color: 'var(--ink-slate)', lineHeight: 1.65,
        whiteSpace: 'pre-wrap', margin: '12px 0 0',
      }}>
        {item.body}
      </p>

      {/* Only a story carries this. See REPORT_STORY in passOnLocks for why. */}
      {!isLetter && (
        <div style={{ marginTop: '16px' }}>
          {reportSent && <p style={thanksStyle}>{REPORT_STORY.sent}</p>}

          {!reportSent && !reportOpen && (
            <button type="button" onClick={() => onOpenReport(item)} style={quietBtn}>
              {REPORT_STORY.open}
            </button>
          )}

          {reportOpen && (
            <ReportForm
              itemId={item.id}
              sending={sending}
              error={reportError}
              onCancel={onCancelReport}
              onSend={onSendReport}
            />
          )}
        </div>
      )}
    </article>
  );
}

/**
 * Asked before anything is sent, because a report is read by a person and acted on. The
 * reason is a required choice and the note is optional — somebody upset enough to object
 * should not be made to write an essay first.
 */
function ReportForm({ itemId, sending, error, onCancel, onSend }) {
  const reasonId = `report-reason-${itemId}`;
  const noteId = `report-note-${itemId}`;

  const submit = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    onSend({
      reason: form.elements[reasonId].value,
      description: form.elements[noteId].value.trim(),
    });
  };

  return (
    <form
      onSubmit={submit}
      style={{
        borderTop: '1px solid var(--hairline)', paddingTop: '16px',
        display: 'flex', flexDirection: 'column', gap: '14px',
      }}
    >
      <div>
        <label htmlFor={reasonId} style={labelStyle}>{REPORT_STORY.reasonPrompt}</label>
        <select id={reasonId} name={reasonId} className="field" defaultValue={REPORT_STORY.reasons[0]}>
          {REPORT_STORY.reasons.map(reason => (
            <option key={reason} value={reason}>{reason}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={noteId} style={labelStyle}>{REPORT_STORY.notePrompt}</label>
        <textarea id={noteId} name={noteId} rows={3} className="field" style={{ resize: 'vertical' }} />
      </div>

      {error && <p style={errorStyle}>{error}</p>}

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button type="submit" disabled={sending} style={fillBtn}>
          {sending ? REPORT_STORY.sending : REPORT_STORY.send}
        </button>
        <button type="button" onClick={onCancel} disabled={sending} style={quietBtn}>
          {REPORT_STORY.cancel}
        </button>
      </div>
    </form>
  );
}

const cardStyle = {
  background: 'var(--canvas)',
  borderRadius: '18px',
  border: '1px solid var(--border)',
  padding: '20px 24px',
  marginBottom: '14px',
};

const letterChip = {
  fontSize: '15px',
  fontWeight: 600,
  color: 'var(--gold-deep)',
  background: 'transparent',
  border: '1px solid color-mix(in srgb, var(--gold-deep) 30%, transparent)',
  borderRadius: '9999px',
  padding: '4px 12px',
  whiteSpace: 'nowrap',
};

const labelStyle = {
  display: 'block',
  fontSize: '16px',
  fontWeight: 600,
  color: 'var(--ink)',
  marginBottom: '6px',
};

const thanksStyle = {
  fontSize: '16px',
  color: 'var(--ink-slate)',
  lineHeight: 1.5,
  margin: 0,
};

const errorStyle = {
  fontSize: '16px',
  color: 'var(--red-mid)',
  lineHeight: 1.5,
  margin: 0,
};

const quietBtn = {
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

const fillBtn = {
  background: 'var(--action-fill)',
  color: 'var(--action-ink)',
  border: 'none',
  borderRadius: '9999px',
  padding: '10px 22px',
  minHeight: '44px',
  fontSize: '16px',
  fontWeight: 600,
  fontFamily: 'inherit',
  cursor: 'pointer',
};
