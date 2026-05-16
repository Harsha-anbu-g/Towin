import { useEffect, useRef, useState } from 'react';

const SF  = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFT = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

/* H2: Real-world language — no technical enum names visible to user */
const LEVELS = [
  {
    key: 'DISCOVERED',
    label: 'Just Connected',
    short: 'Connected',
    emoji: '👋',
    unlocks: ['View their profile', 'Send a connection request'],
    nextAction: 'Both tap "Advance to Messaging" to start chatting',
  },
  {
    key: 'MESSAGING',
    label: 'Messaging',
    short: 'Messaging',
    emoji: '💬',
    unlocks: ['Send and receive messages', 'Share photos in chat'],
    nextAction: 'Both agree you\'re comfortable sharing phone numbers',
  },
  {
    key: 'PHONE_CALL',
    label: 'Phone Ready',
    short: 'Phone',
    emoji: '📞',
    unlocks: ['Exchange phone numbers', 'Call each other directly'],
    nextAction: 'Both agree you\'re comfortable with a video call',
  },
  {
    key: 'VIDEO_CALL',
    label: 'Video Ready',
    short: 'Video',
    emoji: '📹',
    unlocks: ['Video calls', 'See each other face to face'],
    nextAction: 'Both confirm your identities are verified',
  },
  {
    key: 'VERIFIED',
    label: 'Verified',
    short: 'Verified',
    emoji: '✓',
    unlocks: ['Verified badge on your profile', 'Higher community trust score'],
    nextAction: 'Both agree to plan your first in-person meeting',
  },
  {
    key: 'FIRST_MEET',
    label: 'Ready to Meet',
    short: 'Meet',
    emoji: '🤝',
    unlocks: ['Plan in-person visits', 'Emergency contact access'],
    nextAction: 'Both confirm a fully trusted friendship',
  },
  {
    key: 'TRUSTED',
    label: 'Fully Trusted',
    short: 'Trusted',
    emoji: '⭐',
    unlocks: ['Community Champion status', 'Leave & receive reviews', 'Max trust score boost'],
    nextAction: null,
  },
];

const LEVEL_IDX = Object.fromEntries(LEVELS.map((l, i) => [l.key, i]));

export default function TrustJourney({
  currentTrustLevel = 'DISCOVERED',
  confirmedByMe = false,
  otherUserName = 'them',
  onConfirm,
  confirming = false,
}) {
  const [expanded, setExpanded] = useState(false);
  const trackRef = useRef(null);

  const idx = LEVEL_IDX[currentTrustLevel] ?? 0;
  const current = LEVELS[idx];
  const next = LEVELS[idx + 1] ?? null;
  const pct = Math.round((idx / (LEVELS.length - 1)) * 100);
  const isTrusted = idx === LEVELS.length - 1;

  /* H1: animate fill on mount and whenever level changes */
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    el.style.width = '0%';
    const id = requestAnimationFrame(() => {
      el.style.transition = 'width 1s cubic-bezier(0.4,0,0.2,1)';
      el.style.width = `${pct}%`;
    });
    return () => cancelAnimationFrame(id);
  }, [pct]);

  return (
    <div style={{
      marginTop: '14px',
      border: '1px solid #e8e8ed',
      borderRadius: '14px',
      overflow: 'hidden',
      background: '#ffffff',
    }}>
      {/* ── Collapsed summary row — always visible (H8: minimalist by default) ── */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%', border: 'none', cursor: 'pointer',
          background: isTrusted ? '#1d1d1f' : '#fafafc',
          padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: '10px',
          textAlign: 'left',
          borderBottom: expanded ? '1px solid #e8e8ed' : 'none',
          transition: 'background 0.15s',
        }}
      >
        {/* Emoji + label */}
        <span style={{ fontSize: '18px', flexShrink: 0 }}>{current.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* H2: human label, not enum */}
          <span style={{
            fontSize: '13px', fontWeight: 600,
            color: isTrusted ? '#ffffff' : '#1d1d1f',
            fontFamily: SFT, letterSpacing: '-0.1px',
          }}>
            {current.label}
          </span>
          {/* H1: always show the next step clearly */}
          {!isTrusted && next && !expanded && (
            <span style={{
              fontSize: '12px', color: '#a0a0a5',
              fontFamily: SFT, marginLeft: '8px',
            }}>
              → {next.short} next
            </span>
          )}
        </div>

        {/* Progress pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: isTrusted ? 'rgba(255,255,255,0.1)' : '#f0f6ff',
          border: `1px solid ${isTrusted ? 'rgba(255,255,255,0.15)' : '#c3d9f5'}`,
          borderRadius: '9999px', padding: '3px 10px', flexShrink: 0,
        }}>
          <div style={{
            width: '5px', height: '5px', borderRadius: '50%',
            background: isTrusted ? '#34c759' : '#0066cc',
            boxShadow: `0 0 5px ${isTrusted ? '#34c759' : '#0066cc'}99`,
          }} />
          <span style={{
            fontSize: '12px', fontWeight: 600,
            color: isTrusted ? '#ffffff' : '#0066cc',
            fontFamily: SFT,
          }}>{pct}%</span>
        </div>

        {/* Expand chevron — H6: recognise affordance */}
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{
            flexShrink: 0,
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        >
          <path d="M2 4L6 8L10 4" stroke={isTrusted ? 'rgba(255,255,255,0.5)' : '#a0a0a5'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* ── Inline confirm CTA when not expanded — H6: recognition, not recall ── */}
      {!expanded && !isTrusted && onConfirm && !confirmedByMe && (
        <div style={{
          padding: '10px 16px',
          borderTop: '1px solid #f0f0f5',
          background: '#fafafc',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
        }}>
          <p style={{
            fontSize: '12px', color: '#7a7a7a', fontFamily: SFT, margin: 0, lineHeight: 1.4,
          }}>
            {current.nextAction}
          </p>
          <button
            onClick={onConfirm}
            disabled={confirming}
            style={{
              flexShrink: 0,
              padding: '7px 16px',
              background: confirming ? '#a0c4e8' : '#0066cc',
              color: '#fff', border: 'none', borderRadius: '9999px',
              fontSize: '12px', fontWeight: 600, fontFamily: SFT,
              cursor: confirming ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s, transform 0.1s',
              whiteSpace: 'nowrap',
            }}
            onMouseDown={e => !confirming && (e.currentTarget.style.transform = 'scale(0.96)')}
            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {confirming ? '…' : 'Advance →'}
          </button>
        </div>
      )}

      {/* Waiting state */}
      {!expanded && !isTrusted && confirmedByMe && (
        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid #f0f0f5',
          background: '#f0fdf4',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
            <path d="M1.5 5L4.5 8L10.5 1.5" stroke="#22c55e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: '12px', color: '#166534', fontFamily: SFT, fontWeight: 500 }}>
            You confirmed — waiting for {otherUserName}
          </span>
        </div>
      )}

      {/* ── Expanded full journey (H8: revealed on demand) ── */}
      {expanded && (
        <div style={{ padding: '16px 16px 0' }}>

          {/* Track */}
          <div style={{ position: 'relative', marginBottom: '6px' }}>
            <div style={{
              position: 'absolute', top: '13px', left: '13px', right: '13px',
              height: '2px', background: '#e8e8ed', borderRadius: '9999px',
            }} />
            <div ref={trackRef} style={{
              position: 'absolute', top: '13px', left: '13px',
              height: '2px',
              background: 'linear-gradient(90deg, #0066cc, #2997ff)',
              borderRadius: '9999px', width: '0%',
            }} />
            <div style={{
              position: 'relative', zIndex: 1,
              display: 'flex', justifyContent: 'space-between',
            }}>
              {LEVELS.map((level, i) => {
                const done   = i < idx;
                const active = i === idx;
                const locked = i > idx;
                return (
                  <div key={level.key} style={{
                    flex: i < LEVELS.length - 1 ? 1 : 'none',
                    display: 'flex', justifyContent: 'center',
                  }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {active && (
                        <div style={{
                          position: 'absolute', width: '30px', height: '30px',
                          borderRadius: '50%', border: '2px solid #0066cc44',
                          animation: 'tJPulse 2s ease-in-out infinite',
                        }} />
                      )}
                      <div style={{
                        width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                        background: done ? '#0066cc' : active ? '#0066cc' : '#f0f0f5',
                        border: done ? 'none' : active ? '3px solid #0066cc' : '2px solid #d1d1d6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: active ? '0 0 0 4px #0066cc18' : done ? '0 1px 4px #0066cc44' : 'none',
                      }}>
                        {done   && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        {active && <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#fff' }} />}
                        {locked && <svg width="7" height="9" viewBox="0 0 7 9" fill="none"><rect x="0.7" y="3.7" width="5.6" height="5" rx="1" stroke="#c7c7cc" strokeWidth="1.3"/><path d="M1.8 3.7V2.5a1.7 1.7 0 0 1 3.4 0v1.2" stroke="#c7c7cc" strokeWidth="1.3" strokeLinecap="round"/></svg>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Level short labels */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            {LEVELS.map((level, i) => (
              <div key={level.key} style={{
                flex: i < LEVELS.length - 1 ? 1 : 'none',
                display: 'flex', justifyContent: 'center',
              }}>
                <span style={{
                  fontSize: '9px', fontWeight: i === idx ? 700 : i < idx ? 500 : 400,
                  color: i === idx ? '#0066cc' : i < idx ? '#1d1d1f' : '#a0a0a5',
                  fontFamily: SFT, whiteSpace: 'nowrap',
                }}>
                  {level.short}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Two-panel access section — H6: show what's available now vs next ── */}
      {expanded && (
        <div style={{
          display: 'grid', gridTemplateColumns: next ? '1fr 1fr' : '1fr',
          gap: '1px', background: '#e8e8ed',
          borderTop: '1px solid #e8e8ed',
        }}>
          {/* NOW unlocked */}
          <div style={{ background: '#ffffff', padding: '14px 16px' }}>
            <p style={{
              fontSize: '10px', fontWeight: 700, color: '#34c759',
              textTransform: 'uppercase', letterSpacing: '0.7px',
              marginBottom: '8px', fontFamily: SFT,
            }}>✦ You can now</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {current.unlocks.map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px' }}>
                  <div style={{
                    width: '15px', height: '15px', borderRadius: '50%', flexShrink: 0, marginTop: '1px',
                    background: '#f0fdf4', border: '1px solid #bbf7d0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="6" height="5" viewBox="0 0 6 5" fill="none">
                      <path d="M0.8 2.5L2.3 4L5.2 1" stroke="#22c55e" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <span style={{ fontSize: '12px', color: '#1d1d1f', fontFamily: SFT, lineHeight: 1.45 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* NEXT level */}
          {next && (
            <div style={{ background: '#fafafc', padding: '14px 16px' }}>
              <p style={{
                fontSize: '10px', fontWeight: 700, color: '#0066cc',
                textTransform: 'uppercase', letterSpacing: '0.7px',
                marginBottom: '8px', fontFamily: SFT,
              }}>→ Unlock next</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                {next.unlocks.map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px' }}>
                    <div style={{
                      width: '15px', height: '15px', borderRadius: '50%', flexShrink: 0, marginTop: '1px',
                      background: '#f0f6ff', border: '1px solid #bfdbfe',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#0066cc' }} />
                    </div>
                    <span style={{ fontSize: '12px', color: '#7a7a7a', fontFamily: SFT, lineHeight: 1.45 }}>{item}</span>
                  </div>
                ))}
              </div>

              {/* H5: Confirm action with clear label — prevent accidental advance */}
              {confirmedByMe ? (
                <div style={{
                  background: '#f0fdf4', border: '1px solid #bbf7d0',
                  borderRadius: '9999px', padding: '6px 12px',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="#22c55e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span style={{ fontSize: '11px', color: '#166534', fontWeight: 600, fontFamily: SFT }}>
                    Confirmed — waiting for {otherUserName}
                  </span>
                </div>
              ) : onConfirm ? (
                <button
                  onClick={onConfirm}
                  disabled={confirming}
                  style={{
                    width: '100%', padding: '8px 14px',
                    background: confirming ? '#a0c4e8' : '#0066cc',
                    color: '#fff', border: 'none', borderRadius: '9999px',
                    fontSize: '12px', fontWeight: 600, fontFamily: SFT,
                    cursor: confirming ? 'not-allowed' : 'pointer',
                    transition: 'background 0.15s, transform 0.1s',
                  }}
                  onMouseDown={e => !confirming && (e.currentTarget.style.transform = 'scale(0.96)')}
                  onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  {confirming ? '…' : `Advance to ${next.label}`}
                </button>
              ) : null}
            </div>
          )}

          {/* Final state */}
          {!next && (
            <div style={{
              background: '#1d1d1f', padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <span style={{ fontSize: '20px' }}>⭐</span>
              <div>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', margin: '0 0 2px', fontFamily: SF }}>
                  Community Champion
                </p>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', margin: 0, fontFamily: SFT }}>
                  You and {otherUserName} have built full trust.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes tJPulse {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50%       { opacity: 0.9;  transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
