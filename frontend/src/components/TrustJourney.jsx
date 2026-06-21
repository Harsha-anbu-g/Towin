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

  // Reaching full trust turns the ladder leaf-green (the brand accent);
  // every stage along the way stays sky-blue.
  const accent       = isTrusted ? '#1a5c2e' : '#2E7DA6';
  const accentBg     = isTrusted ? '#EBF6EE' : '#E6F2FA';
  const accentBorder = isTrusted ? '#BFE0C9' : '#BFD9EA';
  const barGradient  = 'linear-gradient(90deg,#7FC0E0,#4FA3CE)';

  // The contextual prompt + action under the ladder (non-trusted only).
  const advanceBtn = (label) => (
    <button onClick={onConfirm} disabled={confirming} style={{
      flexShrink: 0, height: '36px', padding: '0 16px',
      background: confirming ? '#e0e0e0' : '#4FA3CE',
      color: '#fff', border: 'none', borderRadius: '9999px',
      fontSize: '13px', fontWeight: 700, fontFamily: SFT,
      cursor: confirming ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
    }}>{confirming ? '…' : label}</button>
  );

  let footer;
  if (isTrusted) {
    footer = (
      <p style={{ fontSize: '13px', color: '#5a6470', margin: '10px 0 0', fontFamily: SFT, lineHeight: 1.5 }}>
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #D8EAF4' }}>
        <p style={{ fontSize: '13px', color: '#5a6470', margin: 0, lineHeight: 1.4, flex: 1, minWidth: '170px', fontFamily: SFT }}>{message}</p>
        {button}
      </div>
    );
  }

  return (
    <div style={{ marginTop: '16px', background: '#F4FAFD', border: '1px solid #D8EAF4', borderRadius: '14px', padding: '14px 16px' }}>
      {/* Header: current level + stage pill */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: accent }} />
          <span style={{ fontSize: '15px', fontWeight: 700, color: isTrusted ? '#1a5c2e' : '#1d1d1f', fontFamily: SF }}>{current.label}</span>
        </div>
        <span style={{ fontSize: '13px', fontWeight: 700, color: accent, background: accentBg, padding: '3px 10px', borderRadius: '9999px' }}>
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

      {/* Ladder stage labels */}
      <div className="trust-ladder-stages" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', gap: '4px' }}>
        {LEVELS.map((level, i) => (
          <span key={level.key} style={{ fontWeight: i === idx ? 700 : 400, color: i === idx ? accent : '#7a8490', whiteSpace: 'nowrap', fontFamily: SFT }}>
            {level.short}
          </span>
        ))}
      </div>

      {footer}
    </div>
  );
}
