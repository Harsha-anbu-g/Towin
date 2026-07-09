const SF    = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFT   = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

/* H2: Real-world language — no technical enum names visible to user */
const LEVELS = [
  { key: 'DISCOVERED', label: 'Just Connected', short: 'Connected', nextAction: 'Tap "Advance" to invite your friend to start messaging', helperNextAction: 'start messaging together' },
  { key: 'MESSAGING',  label: 'Messaging',      short: 'Messaging', nextAction: 'Tap "Advance" when you\'re ready to share phone numbers', helperNextAction: 'share phone numbers' },
  { key: 'PHONE_CALL', label: 'Phone Ready',    short: 'Phone',     nextAction: 'Tap "Advance" when you\'re ready for a video call', helperNextAction: 'try a video call' },
  { key: 'VIDEO_CALL', label: 'Video Ready',    short: 'Video',     nextAction: 'Tap "Advance" when you\'re ready to exchange social media', helperNextAction: 'exchange social media' },
  { key: 'VERIFIED',   label: 'Social Media',   short: 'Socials',   nextAction: 'Tap "Advance" when you\'re ready to plan a first meeting', helperNextAction: 'plan a first meeting' },
  { key: 'FIRST_MEET', label: 'Ready to Meet',  short: 'Met',       nextAction: 'Tap "Advance" to confirm a fully trusted friendship', helperNextAction: 'confirm full trust' },
  { key: 'TRUSTED',    label: 'Fully Trusted',  short: 'Trusted',   nextAction: null, helperNextAction: null },
];

const LEVEL_IDX = Object.fromEntries(LEVELS.map((l, i) => [l.key, i]));

export default function TrustJourney({
  currentTrustLevel = 'DISCOVERED',
  confirmedByMe = false,
  confirmedByOther = false,
  otherUserName = 'them',
  isElder = false,
  onConfirm,
  confirming = false,
}) {
  const idx = LEVEL_IDX[currentTrustLevel] ?? 0;
  const current = LEVELS[idx];
  const denom = LEVELS.length - 1;
  const isTrusted = idx === denom;

  // Each step is a two-party handshake shown on the bar itself: the elder
  // initiates (fills the FIRST half of the step) and the helper accepts (fills
  // the SECOND half, landing on the next rung). One side confirmed but not both
  // === the elder has started this step and we're waiting on the helper. The
  // backend resets both flags the instant both confirm, so at most one is ever
  // true here — the bar sits at a rung, half-past a rung, or on the next rung.
  const pendingHalf = !isTrusted && (confirmedByMe || confirmedByOther);
  const baseFrac = idx / denom;                                 // solid: rung reached
  const fillFrac = baseFrac + (pendingHalf ? 0.5 / denom : 0);  // + the elder's half
  const midFrac  = isTrusted ? baseFrac : (idx + 0.5) / denom;  // this step's midpoint
  const pct = Math.round(fillFrac * 100);

  const nextLabel = LEVELS[idx + 1]?.label || 'the next step';
  const barAria = isTrusted
    ? 'Trust ladder: fully trusted — the top of the ladder'
    : pendingHalf
      ? `Trust ladder: stage ${idx + 1} of ${LEVELS.length}, ${current.label}; move to ${nextLabel} started, waiting for the other person to accept`
      : `Trust ladder: stage ${idx + 1} of ${LEVELS.length}, ${current.label}`;

  const accent       = 'var(--blue-deep)';
  const accentBg     = 'var(--blue-tint)';
  const accentBorder = 'var(--blue-soft)';
  // Brand rule: any UI text containing the word "trust" reads in the golden
  // family. The 19px heading keeps --trust-gold (large-text contrast); the
  // small 13px stage label uses --gold-deep, the palette's own small-text
  // gold, to hold 4.5:1.
  const trustGold     = 'var(--trust-gold)';
  const trustGoldText = 'var(--gold-deep)';
  const isTrustWord   = (s) => s.toLowerCase().includes('trust');

  // The contextual prompt + action under the ladder (non-trusted only).
  const advanceBtn = (label) => (
    <button onClick={onConfirm} disabled={confirming} style={{
      flexShrink: 0, height: '36px', padding: '0 16px',
      background: confirming ? 'var(--blue-mid)' : 'var(--action-fill)',
      color: 'var(--action-ink)', border: 'none', borderRadius: '9999px',
      fontSize: '14px', fontWeight: 700, fontFamily: SFT,
      cursor: confirming ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
    }}>{confirming ? 'Confirming…' : label}</button>
  );

  let footer;
  if (isTrusted) {
    footer = (
      <p style={{ fontSize: '14px', color: 'var(--ink-slate)', margin: '10px 0 0', fontFamily: SFT, lineHeight: 1.5 }}>
        You've reached the top of the trust ladder with {otherUserName}. Enjoy your friendship.
      </p>
    );
  } else {
    let message, button = null;
    if (isElder && !confirmedByMe)            { message = current.nextAction;                                                  button = advanceBtn('Advance →'); }
    else if (isElder && confirmedByMe)        { const next = LEVELS[idx + 1]; message = `You asked to move to ${next?.label || 'the next step'}, waiting for ${otherUserName} to confirm. They'll get a tap on their side.`; }
    else if (!isElder && !confirmedByOther)   { const next = LEVELS[idx + 1]; message = `Waiting for the elder to move to ${next?.label || 'the next step'}.`; }
    else if (!isElder && confirmedByOther && !confirmedByMe) { message = `${otherUserName} is ready to ${current.helperNextAction || 'advance'}. Confirm to move forward together.`; button = advanceBtn('Accept →'); }
    else                                      { const next = LEVELS[idx + 1]; message = `You accepted, trust is advancing to ${next?.label || 'the next step'}.`; }
    footer = (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--sky-line-2)' }}>
        <p style={{ fontSize: '14px', color: 'var(--ink-slate)', margin: 0, lineHeight: 1.4, flex: 1, minWidth: '170px', fontFamily: SFT }}>{message}</p>
        {button}
      </div>
    );
  }

  return (
    <div style={{ marginTop: '16px', background: 'var(--sky-ghost)', border: '1px solid var(--sky-line-2)', borderRadius: '14px', padding: '14px 16px' }}>
      {/* Header: current level + stage pill */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span aria-hidden="true" style={{ width: '9px', height: '9px', borderRadius: '50%', background: isTrustWord(current.label) ? trustGold : accent }} />
          <span style={{ fontSize: '19px', fontWeight: 700, color: isTrustWord(current.label) ? trustGold : 'var(--ink)', fontFamily: SF }}>{current.label}</span>
        </div>
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink-slate)', background: 'var(--canvas)', border: '1px solid var(--sky-line-2)', padding: '3px 10px', borderRadius: '9999px' }}>
          Stage {idx + 1} of {LEVELS.length}{pct < 100 ? ` · ${pct}%` : ''}
        </span>
      </div>

      {/* Progress bar — the tortoise rides along it to the current stage.
          Announced as one progress image; the tortoise marker is decorative
          and inert so it never reads as a draggable slider handle. */}
      <div role="img" aria-label={barAria} style={{ position: 'relative', height: '34px' }}>
        <div aria-hidden="true" style={{ position: 'absolute', left: '17px', right: '17px', top: '50%', transform: 'translateY(-50%)', height: '9px', background: 'var(--sky-hairline)', borderRadius: '9999px', overflow: 'hidden' }}>
          {/* Elder's half — the LIGHT in-progress fill, reaches the step's
              midpoint while we wait on the helper. Sits UNDER the earned fill,
              so it only shows in the stretch the elder has claimed but the
              helper hasn't yet completed. Light = not yet earned. */}
          <div style={{ position: 'absolute', inset: 0, background: 'var(--blue-soft)', borderRadius: '9999px', transform: `scaleX(${fillFrac})`, transformOrigin: 'left center', transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }} />
          {/* Earned fill — the DARKER solid blue up to the last fully-completed
              rung. Darker = trust actually built; the elder's pending half
              stays lighter until the helper completes it. */}
          <div style={{ position: 'absolute', inset: 0, background: 'var(--blue-deep)', borderRadius: '9999px', transform: `scaleX(${baseFrac})`, transformOrigin: 'left center', transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }} />
        </div>
        {/* Active-step tick — the halfway checkpoint of the step in play. The
            elder fills up to it; the tortoise rests on it while awaiting the
            helper. Hidden at the top of the ladder (no next step). */}
        {!isTrusted && (
          <div aria-hidden="true" style={{ position: 'absolute', top: '50%', left: `calc((100% - 34px) * ${midFrac} + 17px)`, transform: 'translate(-50%, -50%)', width: '2px', height: '13px', borderRadius: '9999px', background: 'var(--blue-mid)', opacity: 0.55, transition: 'left 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }} />
        )}
        <div aria-hidden="true" style={{ position: 'absolute', top: '50%', left: `calc((100% - 34px) * ${fillFrac})`, transform: 'translateY(-50%)', width: '34px', height: '34px', borderRadius: '50%', background: accentBg, border: `2px solid ${accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'left 0.4s cubic-bezier(0.16, 1, 0.3, 1)', pointerEvents: 'none' }}>
          <img src="/tortoise-right.png" alt="" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
        </div>
      </div>

      {/* Ladder stage labels — each anchored to its node's x-position so the
          active label sits exactly under the tortoise. The node track is inset
          17px on each side, so node center = (100% - 34px) * pct + 17px. */}
      <div className="trust-ladder-stages" style={{ position: 'relative', height: '17px', marginTop: '8px' }}>
        {LEVELS.map((level, i) => {
          const stagePct = Math.round((i / (LEVELS.length - 1)) * 100) / 100;
          return (
            <span key={level.key} className={i === idx ? 'tl-stage tl-stage-active' : 'tl-stage'} style={{
              position: 'absolute', top: 0,
              left: `calc((100% - 34px) * ${stagePct} + 17px)`,
              transform: 'translateX(-50%)',
              fontWeight: i === idx ? 700 : 400,
              color: isTrustWord(level.short) ? trustGoldText : (i === idx ? 'var(--ink)' : 'var(--ink-slate)'),
              whiteSpace: 'nowrap', fontFamily: SFT,
            }}>
              {level.short}
            </span>
          );
        })}
      </div>

      {footer}
    </div>
  );
}
