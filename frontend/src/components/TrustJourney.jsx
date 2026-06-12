import { useState } from 'react';
import { Slider } from './ui/slider';

const SF  = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFT = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

/* H2: Real-world language — no technical enum names visible to user */
const LEVELS = [
  {
    key: 'DISCOVERED',
    label: 'Just Connected',
    short: 'Connected',
    unlocks: ['View their profile', 'Send a connection request'],
    nextAction: 'Both tap "Advance to Messaging" to start chatting',
  },
  {
    key: 'MESSAGING',
    label: 'Messaging',
    short: 'Messaging',
    unlocks: ['Send and receive messages', 'Share photos in chat'],
    nextAction: 'Both agree you\'re comfortable sharing phone numbers',
  },
  {
    key: 'PHONE_CALL',
    label: 'Phone Ready',
    short: 'Phone',
    unlocks: ['Exchange phone numbers', 'Call each other directly'],
    nextAction: 'Both agree you\'re comfortable with a video call',
  },
  {
    key: 'VIDEO_CALL',
    label: 'Video Ready',
    short: 'Video',
    unlocks: ['Video calls', 'See each other face to face'],
    nextAction: 'Both confirm your identities are verified',
  },
  {
    key: 'VERIFIED',
    label: 'Verified',
    short: 'Verified',
    unlocks: ['Verified badge on your profile', 'Higher community trust score'],
    nextAction: 'Both agree to plan your first in-person meeting',
  },
  {
    key: 'FIRST_MEET',
    label: 'Ready to Meet',
    short: 'Meet',
    unlocks: ['Plan in-person visits', 'Emergency contact access'],
    nextAction: 'Both confirm a fully trusted friendship',
  },
  {
    key: 'TRUSTED',
    label: 'Fully Trusted',
    short: 'Trusted',
    unlocks: ['Community Champion status', 'Leave & receive reviews', 'Max trust score boost'],
    nextAction: null,
  },
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
  const [expanded, setExpanded] = useState(false);

  const idx = LEVEL_IDX[currentTrustLevel] ?? 0;
  const current = LEVELS[idx];
  const next = LEVELS[idx + 1] ?? null;
  const pct = Math.round((idx / (LEVELS.length - 1)) * 100);
  const isTrusted = idx === LEVELS.length - 1;

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
          background: '#fafafc',
          padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: '10px',
          textAlign: 'left',
          borderBottom: expanded ? '1px solid #e8e8ed' : 'none',
          transition: 'background 0.15s',
        }}
      >
        {/* Emoji + label */}
        <div style={{
          width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
          background: isTrusted ? '#e0e0e0' : '#f5f5f7',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isTrusted ? '#4FA3CE' : '#4FA3CE' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* H2: human label, not enum */}
          <span style={{
            fontSize: '13px', fontWeight: 600,
            color: isTrusted ? '#4FA3CE' : '#1d1d1f',
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
          background: '#f5f5f7',
          border: '1px solid #c3d9f5',
          borderRadius: '9999px', padding: '3px 10px', flexShrink: 0,
        }}>
          <div style={{
            width: '5px', height: '5px', borderRadius: '50%',
            background: '#4FA3CE',
            boxShadow: '0 0 5px #4FA3CE99',
          }} />
          <span style={{
            fontSize: '12px', fontWeight: 600,
            color: '#4FA3CE',
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
          <path d="M2 4L6 8L10 4" stroke={isTrusted ? '#1d1d1f' : '#a0a0a5'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* ── Slider progress bar — always visible ── */}
      <div style={{ padding: '16px 20px 4px', background: '#fafafc' }}>
        <Slider
          value={[idx]}
          min={0}
          max={LEVELS.length - 1}
          step={1}
          disabled
          showTooltip
          tooltipContent={(v) => LEVELS[v]?.label}
          trackClassName="!h-3 !bg-[#e4eef5]"
          rangeClassName="!bg-[#4FA3CE]"
          thumbClassName="!h-14 !w-14"
          thumbContent={<img src="/tortoise-logo.png" alt="" style={{ width: 52, height: 52, objectFit: 'contain', transform: 'rotate(90deg)' }} />}
        />
        <span
          className="mt-2 flex w-full items-center justify-between gap-1 px-2.5"
          aria-hidden="true"
        >
          {LEVELS.map((level, i) => (
            <span key={level.key} className="flex w-0 flex-col items-center justify-center gap-1">
              <span style={{
                height: '4px', width: '1px',
                background: i <= idx ? '#1d1d1f' : '#d1d1d6',
                display: 'block',
              }} />
              <span style={{
                fontSize: '9px',
                fontWeight: i === idx ? 700 : i < idx ? 500 : 400,
                color: i === idx ? '#1d1d1f' : i < idx ? '#1d1d1f' : '#a0a0a5',
                fontFamily: SFT,
                whiteSpace: 'nowrap',
              }}>
                {level.short}
              </span>
            </span>
          ))}
        </span>
      </div>

      {/* ── Inline CTA when not expanded ── */}
      {!expanded && !isTrusted && (
        <>
          {/* Elder: can always advance if not yet confirmed */}
          {isElder && !confirmedByMe && (
            <div style={{
              padding: '10px 16px', borderTop: '1px solid #f0f0f5', background: '#fafafc',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
            }}>
              <p style={{ fontSize: '12px', color: '#7a7a7a', fontFamily: SFT, margin: 0, lineHeight: 1.4 }}>
                {current.nextAction}
              </p>
              <button onClick={onConfirm} disabled={confirming} style={{
                flexShrink: 0, padding: '7px 16px',
                background: confirming ? '#e0e0e0' : '#4FA3CE',
                color: '#fff', border: 'none', borderRadius: '9999px',
                fontSize: '12px', fontWeight: 600, fontFamily: SFT,
                cursor: confirming ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
              }}>
                {confirming ? '…' : 'Advance →'}
              </button>
            </div>
          )}

          {/* Elder: waiting for helper to accept */}
          {isElder && confirmedByMe && (
            <div style={{
              padding: '8px 16px', borderTop: '1px solid #f0f0f5', background: '#f5f5f7',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                <path d="M1.5 5L4.5 8L10.5 1.5" stroke="#1d1d1f" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{ fontSize: '12px', color: '#4FA3CE', fontFamily: SFT, fontWeight: 500 }}>
                Trust request sent — waiting for {otherUserName} to accept
              </span>
            </div>
          )}

          {/* Helper: elder hasn't initiated yet */}
          {!isElder && !confirmedByOther && (
            <div style={{
              padding: '8px 16px', borderTop: '1px solid #f0f0f5', background: '#fafafc',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <span style={{ fontSize: '12px', color: '#7a7a7a', fontFamily: SFT }}>
                Waiting for {otherUserName} to initiate the next trust step
              </span>
            </div>
          )}

          {/* Helper: elder has confirmed, helper can accept */}
          {!isElder && confirmedByOther && !confirmedByMe && (
            <div style={{
              padding: '10px 16px', borderTop: '1px solid #f0f0f5', background: '#eff6ff',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
            }}>
              <p style={{ fontSize: '12px', color: '#4FA3CE', fontFamily: SFT, margin: 0, fontWeight: 500 }}>
                {otherUserName} wants to advance your trust
              </p>
              <button onClick={onConfirm} disabled={confirming} style={{
                flexShrink: 0, padding: '7px 16px',
                background: confirming ? '#e0e0e0' : '#4FA3CE',
                color: '#fff', border: 'none', borderRadius: '9999px',
                fontSize: '12px', fontWeight: 600, fontFamily: SFT,
                cursor: confirming ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
              }}>
                {confirming ? '…' : 'Accept →'}
              </button>
            </div>
          )}

          {/* Helper: already accepted */}
          {!isElder && confirmedByMe && (
            <div style={{
              padding: '8px 16px', borderTop: '1px solid #f0f0f5', background: '#f5f5f7',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                <path d="M1.5 5L4.5 8L10.5 1.5" stroke="#1d1d1f" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{ fontSize: '12px', color: '#4FA3CE', fontFamily: SFT, fontWeight: 500 }}>
                You accepted — trust advancing
              </span>
            </div>
          )}
        </>
      )}

      {/* ── Expanded detail section (H8: revealed on demand) ── */}

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
              fontSize: '10px', fontWeight: 600, color: '#4FA3CE',
              textTransform: 'uppercase', letterSpacing: '0.7px',
              marginBottom: '8px', fontFamily: SFT,
            }}>Now available</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {current.unlocks.map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px' }}>
                  <div style={{
                    width: '15px', height: '15px', borderRadius: '50%', flexShrink: 0, marginTop: '1px',
                    background: '#f5f5f7', border: '1px solid #BFD9EA',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="6" height="5" viewBox="0 0 6 5" fill="none">
                      <path d="M0.8 2.5L2.3 4L5.2 1" stroke="#1d1d1f" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
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
                fontSize: '10px', fontWeight: 600, color: '#4FA3CE',
                textTransform: 'uppercase', letterSpacing: '0.7px',
                marginBottom: '8px', fontFamily: SFT,
              }}>Unlock next</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                {next.unlocks.map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px' }}>
                    <div style={{
                      width: '15px', height: '15px', borderRadius: '50%', flexShrink: 0, marginTop: '1px',
                      background: '#f5f5f7', border: '1px solid #bfdbfe',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#4FA3CE' }} />
                    </div>
                    <span style={{ fontSize: '12px', color: '#7a7a7a', fontFamily: SFT, lineHeight: 1.45 }}>{item}</span>
                  </div>
                ))}
              </div>

              {/* H5: Confirm action with clear label — prevent accidental advance */}
              {confirmedByMe ? (
                <div style={{
                  background: '#f5f5f7', border: '1px solid #BFD9EA',
                  borderRadius: '9999px', padding: '6px 12px',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="#1d1d1f" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span style={{ fontSize: '11px', color: '#4FA3CE', fontWeight: 600, fontFamily: SFT }}>
                    Confirmed — waiting for {otherUserName}
                  </span>
                </div>
              ) : onConfirm ? (
                <button
                  onClick={onConfirm}
                  disabled={confirming}
                  style={{
                    width: '100%', padding: '8px 14px',
                    background: confirming ? '#e0e0e0' : '#4FA3CE',
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
              <div style={{
                width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
                background: 'rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1L8.8 5.2L13.5 5.6L10.1 8.6L11.1 13.2L7 10.8L2.9 13.2L3.9 8.6L0.5 5.6L5.2 5.2L7 1Z" fill="rgba(255,255,255,0.9)" stroke="none"/>
                </svg>
              </div>
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', margin: '0 0 2px', fontFamily: SF }}>
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
