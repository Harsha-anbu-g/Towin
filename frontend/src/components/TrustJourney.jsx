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
  const pct = Math.round((idx / (LEVELS.length - 1)) * 100);
  const isTrusted = idx === LEVELS.length - 1;

  const accent       = '#2E7DA6';
  const accentBg     = '#E6F2FA';
  const accentBorder = '#BFD9EA';
  const barGradient  = 'linear-gradient(90deg,#7FC0E0,#4FA3CE)';
  // Brand rule: any UI text containing the word "trust" reads in this
  // golden-brown. Applied to the heading + the "Trusted" stage below.
  const trustGold    = '#9C7A3C';
  const isTrustWord  = (s) => s.toLowerCase().includes('trust');

  // The contextual prompt + action under the ladder (non-trusted only).
  const advanceBtn = (label) => (
    <button onClick={onConfirm} disabled={confirming} style={{
      flexShrink: 0, height: '36px', padding: '0 16px',
      background: confirming ? '#e0e0e0' : '#4FA3CE',
      color: '#fff', border: 'none', borderRadius: '9999px',
      fontSize: '14px', fontWeight: 700, fontFamily: SFT,
      cursor: confirming ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
    }}>{confirming ? '…' : label}</button>
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
    else if (isElder && confirmedByMe)        { message = `Request sent — waiting for ${otherUserName} to accept.`; }
    else if (!isElder && !confirmedByOther)   { message = `Waiting for ${otherUserName} to move to the next step.`; }
    else if (!isElder && confirmedByOther && !confirmedByMe) { message = `${otherUserName} is ready to ${current.helperNextAction || 'advance'}. Confirm to move forward together.`; button = advanceBtn('Accept →'); }
    else                                      { message = `You accepted — trust is advancing.`; }
    footer = (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #D8EAF4' }}>
        <p style={{ fontSize: '14px', color: 'var(--ink-slate)', margin: 0, lineHeight: 1.4, flex: 1, minWidth: '170px', fontFamily: SFT }}>{message}</p>
        {button}
      </div>
    );
  }

  return (
    <div style={{ marginTop: '16px', background: '#F4FAFD', border: '1px solid #D8EAF4', borderRadius: '14px', padding: '14px 16px' }}>
      {/* Header: current level + stage pill */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: isTrustWord(current.label) ? trustGold : accent }} />
          <span style={{ fontSize: '16px', fontWeight: 700, color: isTrustWord(current.label) ? trustGold : 'var(--ink)', fontFamily: SF }}>{current.label}</span>
        </div>
        <span style={{ fontSize: '14px', fontWeight: 700, color: accent, background: accentBg, padding: '3px 10px', borderRadius: '9999px' }}>
          Stage {idx + 1} of {LEVELS.length} · {pct}%
        </span>
      </div>

      {/* Progress bar — the tortoise rides along it to the current stage */}
      <div style={{ position: 'relative', height: '34px' }}>
        <div style={{ position: 'absolute', left: '17px', right: '17px', top: '50%', transform: 'translateY(-50%)', height: '9px', background: '#E2EEF5', borderRadius: '9999px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: barGradient, borderRadius: '9999px', transition: 'width 0.4s ease' }} />
        </div>
        <div style={{ position: 'absolute', top: '50%', left: `calc((100% - 34px) * ${pct / 100})`, transform: 'translateY(-50%)', width: '34px', height: '34px', borderRadius: '50%', background: accentBg, border: `2px solid ${accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'left 0.4s ease' }} title={current.label}>
          <img src="/tortoise-right.png" alt="" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
        </div>
      </div>

      {/* Ladder stage labels — each anchored to its node's x-position so the
          active label sits exactly under the tortoise. The node track is inset
          17px on each side, so node center = (100% - 34px) * pct + 17px. */}
      <div className="trust-ladder-stages" style={{ position: 'relative', height: '15px', marginTop: '8px' }}>
        {LEVELS.map((level, i) => {
          const stagePct = Math.round((i / (LEVELS.length - 1)) * 100) / 100;
          return (
            <span key={level.key} style={{
              position: 'absolute', top: 0,
              left: `calc((100% - 34px) * ${stagePct} + 17px)`,
              transform: 'translateX(-50%)',
              fontWeight: i === idx ? 700 : 400,
              color: isTrustWord(level.short) ? trustGold : (i === idx ? accent : '#7a8490'),
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
