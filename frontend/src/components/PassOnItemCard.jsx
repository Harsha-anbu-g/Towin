import { NO_CAPTURE } from '../lib/analytics';
import { AUDIENCES, LETTERS } from './passOnLocks';

/**
 * One thing she has written, as it sits on her own page.
 *
 * The words are shown in full rather than clipped to a preview. She wrote them,
 * they are hers to re-read, and a "…" with no way to open it is a dead end on a
 * page whose whole subject is being read.
 *
 * A letter carries two facts a story does not: who it is for, and whether that
 * person has read it yet. Both are stated plainly — a waiting state that does not
 * say what it is waiting for is the thing people ask about most.
 */
export default function PassOnItemCard({ item, onChange, onRemove }) {
  const isLetter = item.kind === 'LETTER';
  const audience = AUDIENCES.find(a => a.key === item.audience);
  // Anything but NOW is held. Written this way round so a release value this build
  // has never heard of reads as "held" — the shut side is the safe side to guess.
  const held = isLetter && item.releaseWhen && item.releaseWhen !== 'NOW';

  return (
    <article style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        {/* Her words, hidden from session replay. The chips and buttons around them are not
            marked, so a recording still shows how she moved through the page. */}
        <h3 className={NO_CAPTURE} style={{
          fontFamily: 'var(--font-display)', fontWeight: 400, letterSpacing: '-0.02em',
          fontSize: 'var(--text-lg)', color: 'var(--ink)', margin: 0,
        }}>
          {item.title}
        </h3>
        {isLetter
          ? <span style={quietChip}>To {item.audienceUserName || 'someone'}</span>
          : audience && <span style={quietChip}>{audience.title}</span>}
      </div>

      <p className={NO_CAPTURE} style={{
        fontSize: '17px', color: 'var(--ink-slate)', lineHeight: 1.65,
        whiteSpace: 'pre-wrap', margin: '12px 0 0',
      }}>
        {item.body}
      </p>

      {isLetter && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '14px' }}>
          {/* Which of the two kinds of letter this is, on every one of them. Gold rather
              than green: green is the colour of something achieved, and a letter waiting
              to be read after her death has not achieved anything yet. */}
          {held
            ? <span style={goldChip}>{LETTERS.heldUntilGone}</span>
            : <span style={greenChip}>{LETTERS.readableNow}</span>}
          {item.firstReadAt && (
            <span style={{ fontSize: '16px', color: 'var(--ink-3)' }}>
              {item.audienceUserName} read this on {onDay(item.firstReadAt)}
            </span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => onChange(item)} style={ghostBtn}>Change</button>
        <button type="button" onClick={() => onRemove(item)} style={ghostBtn}>Remove</button>
      </div>
    </article>
  );
}

/** "3 June" — the way a date is said out loud, not 03/06/2026. */
function onDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}

const cardStyle = {
  background: 'var(--canvas)',
  borderRadius: '18px',
  border: '1px solid var(--border)',
  padding: '20px 24px',
  marginBottom: '14px',
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

const greenChip = {
  fontSize: '15px',
  fontWeight: 600,
  color: 'var(--green-deep)',
  background: 'transparent',
  border: '1px solid color-mix(in srgb, var(--green-deep) 25%, transparent)',
  borderRadius: '9999px',
  padding: '4px 12px',
  whiteSpace: 'nowrap',
};

const goldChip = {
  ...greenChip,
  color: 'var(--gold-deep)',
  border: '1px solid color-mix(in srgb, var(--gold-deep) 30%, transparent)',
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
