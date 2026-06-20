const SF    = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFT   = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

/* H2: Real-world language — no technical enum names visible to user */
const LEVELS = [
  { key: 'DISCOVERED', label: 'Just Connected', short: 'Connected', nextAction: 'Both tap "Advance" to start messaging' },
  { key: 'MESSAGING',  label: 'Messaging',      short: 'Messaging', nextAction: 'Both agree you\'re comfortable sharing phone numbers' },
  { key: 'PHONE_CALL', label: 'Phone Ready',    short: 'Phone',     nextAction: 'Both agree you\'re comfortable with a video call' },
  { key: 'VIDEO_CALL', label: 'Video Ready',    short: 'Video',     nextAction: 'Both confirm your identities are verified' },
  { key: 'VERIFIED',   label: 'Verified',       short: 'Verified',  nextAction: 'Both agree to plan your first in-person meeting' },
  { key: 'FIRST_MEET', label: 'Ready to Meet',  short: 'Met',       nextAction: 'Both confirm a fully trusted friendship' },
  { key: 'TRUSTED',    label: 'Fully Trusted',  short: 'Trusted',   nextAction: null },
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

  // The contextual prompt + action under the ladder (non-trusted only).
  const advanceBtn = (label) => (
    <button onClick={onConfirm} disabled={confirming} style={{
      flexShrink: 0, height: '40px', padding: '0 20px',
      background: confirming ? '#e0e0e0' : '#4FA3CE',
      color: '#fff', border: 'none', borderRadius: '9999px',
      fontSize: '14px', fontWeight: 700, fontFamily: SFT,
      cursor: confirming ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
    }}>{confirming ? '…' : label}</button>
  );

  let footer;
  if (isTrusted) {
    footer = (
      <p style={{ fontSize: '15px', color: '#5a6470', margin: '12px 0 0', fontFamily: SFT, lineHeight: 1.5 }}>
        You've reached the top of the trust ladder with {otherUserName}. Enjoy your friendship.
      </p>
    );
  } else {
    let message, button = null;
    if (isElder && !confirmedByMe)            { message = current.nextAction;                                                  button = advanceBtn('Advance →'); }
    else if (isElder && confirmedByMe)        { message = `Trust request sent — waiting for ${otherUserName} to accept.`; }
    else if (!isElder && !confirmedByOther)   { message = `Waiting for ${otherUserName} to start the next trust step.`; }
    else if (!isElder && confirmedByOther && !confirmedByMe) { message = `${otherUserName} wants to advance your trust.`; button = advanceBtn('Accept →'); }
    else                                      { message = `You accepted — trust is advancing.`; }
    footer = (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #D8EAF4' }}>
        <p style={{ fontSize: '14px', color: '#5a6470', margin: 0, lineHeight: 1.4, flex: 1, minWidth: '180px', fontFamily: SFT }}>{message}</p>
        {button}
      </div>
    );
  }

  return (
    <div style={{ marginTop: '22px', background: '#F4FAFD', border: '1px solid #D8EAF4', borderRadius: '16px', padding: '18px 20px' }}>
      {/* Header: current level + stage pill */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#2E7DA6' }} />
          <span style={{ fontSize: '17px', fontWeight: 700, color: '#1d1d1f', fontFamily: SF }}>{current.label}</span>
        </div>
        <span style={{ fontSize: '15px', fontWeight: 700, color: '#2E7DA6', background: '#E6F2FA', padding: '4px 12px', borderRadius: '9999px' }}>
          Stage {idx + 1} of {LEVELS.length} · {pct}%
        </span>
      </div>

      {/* Progress bar with the tortoise riding to the trusted end */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ flex: 1, height: '12px', background: '#E2EEF5', borderRadius: '9999px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, minWidth: pct > 0 ? '8px' : 0, background: 'linear-gradient(90deg,#7FC0E0,#4FA3CE)', borderRadius: '9999px', transition: 'width 0.4s ease' }} />
        </div>
        <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#E6F2FA', border: '2px solid #BFD9EA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} title={current.label}>
          <img src="/tortoise-right.png" alt="" style={{ width: '30px', height: '30px', objectFit: 'contain' }} />
        </div>
      </div>

      {/* Ladder stage labels */}
      <div className="trust-ladder-stages" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', gap: '4px' }}>
        {LEVELS.map((level, i) => (
          <span key={level.key} style={{ fontWeight: i === idx ? 700 : 400, color: i === idx ? '#2E7DA6' : '#7a8490', whiteSpace: 'nowrap', fontFamily: SFT }}>
            {level.short}
          </span>
        ))}
      </div>

      {footer}
    </div>
  );
}
