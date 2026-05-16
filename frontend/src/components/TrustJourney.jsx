import { useEffect, useRef } from 'react';

const SF = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

const LEVELS = [
  {
    key: 'DISCOVERED',
    label: 'Discovered',
    icon: '👋',
    unlocks: ['View their profile', 'Send connection request'],
    action: 'Confirm you\'d like to start messaging',
  },
  {
    key: 'MESSAGING',
    label: 'Messaging',
    icon: '💬',
    unlocks: ['Send & receive messages', 'Share photos in chat'],
    action: 'Both confirm you\'re comfortable calling',
  },
  {
    key: 'PHONE_CALL',
    label: 'Phone Call',
    icon: '📞',
    unlocks: ['Exchange phone numbers', 'Call each other directly'],
    action: 'Both confirm you\'re ready for a video call',
  },
  {
    key: 'VIDEO_CALL',
    label: 'Video Call',
    icon: '📹',
    unlocks: ['Video calls', 'See each other face to face'],
    action: 'Both confirm identities are verified',
  },
  {
    key: 'VERIFIED',
    label: 'Verified',
    icon: '✓',
    unlocks: ['Verified badge shown on your profile', 'Higher trust score'],
    action: 'Both agree to plan a first in-person meeting',
  },
  {
    key: 'FIRST_MEET',
    label: 'First Meet',
    icon: '🤝',
    unlocks: ['Plan in-person visits', 'Emergency contact access'],
    action: 'Both confirm a fully trusted friendship',
  },
  {
    key: 'TRUSTED',
    label: 'Trusted',
    icon: '⭐',
    unlocks: ['Full community champion status', 'Leave reviews', 'Max trust score boost'],
    action: null,
  },
];

const LEVEL_INDEX = Object.fromEntries(LEVELS.map((l, i) => [l.key, i]));

export default function TrustJourney({ currentTrustLevel = 'DISCOVERED', confirmedByMe = false, otherUserName = 'them', onConfirm, confirming = false }) {
  const currentIdx = LEVEL_INDEX[currentTrustLevel] ?? 0;
  const current = LEVELS[currentIdx];
  const next = LEVELS[currentIdx + 1] ?? null;
  const pct = Math.round((currentIdx / (LEVELS.length - 1)) * 100);
  const trackRef = useRef(null);

  // Animate fill on mount
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    el.style.width = '0%';
    const raf = requestAnimationFrame(() => {
      el.style.transition = 'width 1s cubic-bezier(0.4, 0, 0.2, 1)';
      el.style.width = `${pct}%`;
    });
    return () => cancelAnimationFrame(raf);
  }, [pct]);

  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e8e8ed',
      borderRadius: '16px',
      overflow: 'hidden',
      marginTop: '16px',
    }}>
      {/* Header strip */}
      <div style={{
        background: currentIdx === LEVELS.length - 1 ? '#1d1d1f' : '#fafafc',
        borderBottom: '1px solid #e8e8ed',
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px', lineHeight: 1 }}>{current.icon}</span>
          <div>
            <p style={{
              fontSize: '13px', fontWeight: 700, margin: 0,
              color: currentIdx === LEVELS.length - 1 ? '#ffffff' : '#1d1d1f',
              fontFamily: SFText, letterSpacing: '0.2px', textTransform: 'uppercase',
            }}>
              Trust Level
            </p>
            <p style={{
              fontSize: '17px', fontWeight: 600, margin: 0,
              color: currentIdx === LEVELS.length - 1 ? '#ffffff' : '#0066cc',
              fontFamily: SF,
            }}>
              {current.label}
            </p>
          </div>
        </div>
        <div style={{
          background: currentIdx === LEVELS.length - 1 ? 'rgba(255,255,255,0.12)' : '#f0f6ff',
          border: `1px solid ${currentIdx === LEVELS.length - 1 ? 'rgba(255,255,255,0.2)' : '#c3d9f5'}`,
          borderRadius: '9999px',
          padding: '5px 14px',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <div style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: currentIdx === LEVELS.length - 1 ? '#34c759' : '#0066cc',
            boxShadow: `0 0 6px ${currentIdx === LEVELS.length - 1 ? '#34c759' : '#0066cc'}88`,
          }} />
          <span style={{
            fontSize: '13px', fontWeight: 600,
            color: currentIdx === LEVELS.length - 1 ? '#ffffff' : '#0066cc',
            fontFamily: SFText,
          }}>
            {pct}% complete
          </span>
        </div>
      </div>

      {/* Track */}
      <div style={{ padding: '20px 20px 0' }}>
        {/* Level nodes row */}
        <div style={{ position: 'relative', marginBottom: '8px' }}>
          {/* Background track line */}
          <div style={{
            position: 'absolute',
            top: '14px',
            left: '14px',
            right: '14px',
            height: '3px',
            background: '#e8e8ed',
            borderRadius: '9999px',
          }} />
          {/* Animated fill line */}
          <div
            ref={trackRef}
            style={{
              position: 'absolute',
              top: '14px',
              left: '14px',
              height: '3px',
              background: 'linear-gradient(90deg, #0066cc, #2997ff)',
              borderRadius: '9999px',
              width: '0%',
              transformOrigin: 'left',
            }}
          />
          {/* Nodes */}
          <div style={{
            position: 'relative', zIndex: 1,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            {LEVELS.map((level, idx) => {
              const done = idx < currentIdx;
              const active = idx === currentIdx;
              const locked = idx > currentIdx;
              return (
                <div key={level.key} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                  flex: idx < LEVELS.length - 1 ? 1 : 'none',
                }}>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {/* Pulse ring on active node */}
                    {active && (
                      <div style={{
                        position: 'absolute',
                        width: '34px', height: '34px',
                        borderRadius: '50%',
                        border: '2px solid #0066cc44',
                        animation: 'trustPulse 2s ease-in-out infinite',
                      }} />
                    )}
                    <div style={{
                      width: '28px', height: '28px',
                      borderRadius: '50%',
                      background: done ? '#0066cc' : active ? '#0066cc' : '#f0f0f5',
                      border: done ? 'none' : active ? '3px solid #0066cc' : '2px solid #d1d1d6',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: active ? '0 0 0 4px #0066cc1a' : done ? '0 2px 6px #0066cc44' : 'none',
                      transition: 'all 0.3s',
                      flexShrink: 0,
                    }}>
                      {done && (
                        <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
                          <path d="M1 4.5L4.5 8L11 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                      {active && (
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff' }} />
                      )}
                      {locked && (
                        <svg width="9" height="11" viewBox="0 0 9 11" fill="none">
                          <rect x="1" y="4.5" width="7" height="6" rx="1.2" stroke="#c7c7cc" strokeWidth="1.4"/>
                          <path d="M2.5 4.5V3a2 2 0 0 1 4 0v1.5" stroke="#c7c7cc" strokeWidth="1.4" strokeLinecap="round"/>
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Level labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          {LEVELS.map((level, idx) => {
            const active = idx === currentIdx;
            const done = idx < currentIdx;
            return (
              <div key={level.key} style={{
                flex: idx < LEVELS.length - 1 ? 1 : 'none',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
              }}>
                <span style={{
                  fontSize: idx === 0 || idx === LEVELS.length - 1 ? '10px' : '9px',
                  fontWeight: active ? 700 : done ? 500 : 400,
                  color: active ? '#0066cc' : done ? '#1d1d1f' : '#a0a0a5',
                  fontFamily: SFText,
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                }}>
                  {level.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Access panels */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: next ? '1fr 1fr' : '1fr',
        gap: '1px',
        background: '#e8e8ed',
        borderTop: '1px solid #e8e8ed',
      }}>
        {/* NOW panel */}
        <div style={{ background: '#ffffff', padding: '16px 18px' }}>
          <p style={{
            fontSize: '10px', fontWeight: 700, color: '#34c759',
            textTransform: 'uppercase', letterSpacing: '0.8px',
            marginBottom: '10px', fontFamily: SFText,
          }}>
            ✦ Unlocked now
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {current.unlocks.map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{
                  width: '16px', height: '16px', borderRadius: '50%',
                  background: '#f0fdf4', border: '1px solid #bbf7d0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: '1px',
                }}>
                  <svg width="7" height="5" viewBox="0 0 7 5" fill="none">
                    <path d="M1 2.5L2.8 4L6 1" stroke="#22c55e" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span style={{ fontSize: '13px', color: '#1d1d1f', fontFamily: SFText, lineHeight: 1.4 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* NEXT panel */}
        {next && (
          <div style={{ background: '#fafafc', padding: '16px 18px' }}>
            <p style={{
              fontSize: '10px', fontWeight: 700, color: '#0066cc',
              textTransform: 'uppercase', letterSpacing: '0.8px',
              marginBottom: '10px', fontFamily: SFText,
            }}>
              → Next: {next.label}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginBottom: '12px' }}>
              {next.unlocks.map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{
                    width: '16px', height: '16px', borderRadius: '50%',
                    background: '#f0f6ff', border: '1px solid #bfdbfe',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: '1px',
                  }}>
                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#0066cc' }} />
                  </div>
                  <span style={{ fontSize: '13px', color: '#7a7a7a', fontFamily: SFText, lineHeight: 1.4 }}>{item}</span>
                </div>
              ))}
            </div>

            {/* Confirm trust CTA */}
            {confirmedByMe ? (
              <div style={{
                background: '#f0fdf4', border: '1px solid #bbf7d0',
                borderRadius: '9999px', padding: '7px 14px',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="#22c55e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{ fontSize: '12px', color: '#166534', fontWeight: 600, fontFamily: SFText }}>
                  You confirmed — waiting for {otherUserName}
                </span>
              </div>
            ) : onConfirm ? (
              <button
                onClick={onConfirm}
                disabled={confirming}
                style={{
                  width: '100%', padding: '9px 14px',
                  background: confirming ? '#a0c4e8' : '#0066cc',
                  color: '#ffffff', border: 'none',
                  borderRadius: '9999px', cursor: confirming ? 'not-allowed' : 'pointer',
                  fontSize: '13px', fontWeight: 600, fontFamily: SFText,
                  transition: 'background 0.15s',
                  letterSpacing: '0.1px',
                }}
              >
                {confirming ? '…' : `Confirm ${current.label} level`}
              </button>
            ) : null}
          </div>
        )}

        {/* TRUSTED final state */}
        {!next && (
          <div style={{
            background: '#1d1d1f', padding: '16px 18px',
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <span style={{ fontSize: '24px' }}>⭐</span>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', margin: '0 0 2px', fontFamily: SF }}>
                Community Champion
              </p>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', margin: 0, fontFamily: SFText }}>
                You and {otherUserName} have built full trust.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Pulse animation keyframes injected once */}
      <style>{`
        @keyframes trustPulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.35); }
        }
      `}</style>
    </div>
  );
}
