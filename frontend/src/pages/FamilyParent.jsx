import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import NavBar from '../components/NavBar';
import BlurFade from '../components/magic/BlurFade';
import api from '../api/axios';
import { useToast } from '../context/useToast';
import TrustBadge from '../components/TrustBadge';
import TrustJourney from '../components/TrustJourney';
import FamilyHelperUpdates from '../components/FamilyHelperUpdates';
import FamilyHelperConnect from '../components/FamilyHelperConnect';
import FamilyNeedsForParent from '../components/FamilyNeedsForParent';
import FamilyTrustAdvance from '../components/FamilyTrustAdvance';
import FamilyReviewForParent from '../components/FamilyReviewForParent';

const SF = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

const DefaultAvatar = ({ color = 'var(--blue)', size = 52 }) => (
  <div style={{
    width: `${size}px`, height: `${size}px`, borderRadius: '50%',
    background: `color-mix(in srgb, ${color} 10%, transparent)`,
    flexShrink: 0, display: 'flex', alignItems: 'flex-end',
    justifyContent: 'center', overflow: 'hidden',
  }}>
    <svg width={size * 0.75} height={size * 0.75} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M12 14c-4.4 0-8 2.7-8 6v2h16v-2c0-3.3-3.6-6-8-6z" />
    </svg>
  </div>
);

const cardStyle = {
  background: 'var(--canvas)',
  borderRadius: '18px',
  border: '1px solid var(--border)',
  padding: '20px 24px',
  marginBottom: '14px',
};

const sectionH = {
  fontSize: 'var(--text-xl)',
  fontWeight: 600,
  color: 'var(--ink)',
  fontFamily: SF,
  letterSpacing: '-0.3px',
  margin: 0,
};

/**
 * One parent, in full. The family home page got too crowded once a parent had
 * help requests, friendships, trust ladders and guardian actions all stacked in
 * a single card (user call 2026-07-20), so the list stayed there and the depth
 * moved here.
 */
export default function FamilyParent() {
  const { elderId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [family, setFamily] = useState({ activeLinks: [] });
  const [journey, setJourney] = useState([]);
  const [standings, setStandings] = useState([]);
  const [standingsLoaded, setStandingsLoaded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);

  const load = useCallback(() => {
    return Promise.all([
      api.get('/family/links').then(r => setFamily(r.data)).catch(() => {}),
      api.get('/family/journey').then(r => setJourney(r.data?.elders || [])).catch(() => {}),
      api.get('/family/standings')
        .then(r => { setStandings(r.data?.standings || []); setStandingsLoaded(true); })
        .catch(() => {}),
    ]).finally(() => setLoaded(true));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Open (or reopen) the private chat with the parent. The link is the only
  // permission; the server checks it and hands back the conversation to open.
  const messageParent = async () => {
    if (openingChat) return;
    setOpeningChat(true);
    try {
      const r = await api.post(`/family/chat/${elderId}`);
      navigate(`/messages/${r.data}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not open the chat. Please try again.');
      setOpeningChat(false);
    }
  };

  // Only the family side of the link — this page never renders my own elder seat.
  const link = (family.activeLinks || []).find(l => !l.iAmElder && l.elderId === elderId);
  const j = journey.find(e => e.elderId === elderId);
  const powers = link?.delegatedPowers || [];
  const sharedHelpers = j?.sharedHelpers || [];
  const elderName = j?.elderName || link?.otherUserName || 'your parent';

  const backBtn = (
    <button
      type="button"
      onClick={() => navigate('/family-home')}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '44px',
        background: 'none', border: 'none', padding: '0 4px', cursor: 'pointer',
        color: 'var(--blue-deep)', fontSize: '16px', fontWeight: 600, fontFamily: SFText,
      }}
    >
      <svg width="10" height="16" viewBox="0 0 10 16" fill="none" aria-hidden="true">
        <path d="M8.5 1L1.5 8L8.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      My Parents
    </button>
  );

  if (loaded && !link) {
    return (
      <div style={{ minHeight: '100svh', background: 'var(--surface-pearl)', fontFamily: SFText }}>
        <NavBar />
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '24px 24px 60px' }}>
          {backBtn}
          <div style={{ ...cardStyle, padding: '40px 24px', textAlign: 'center', marginTop: '16px' }}>
            <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px', fontFamily: SF }}>
              This parent is no longer linked to you
            </p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)', margin: 0 }}>
              This link may have been removed. Go back to see who you are linked with now.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100svh', background: 'var(--surface-pearl)', fontFamily: SFText }}>
      <NavBar />
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '24px 24px 60px' }}>
        {backBtn}

        <BlurFade delay={2}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: '16px 0 18px' }}>
            <DefaultAvatar color="var(--blue)" size={52} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ ...sectionH }}>{elderName}</h1>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)', margin: '2px 0 0' }}>
                {link?.relationship ? `You're ${elderName}'s ${link.relationship.toLowerCase()}` : 'Your family member'}
              </p>
            </div>
            <button
              type="button"
              onClick={messageParent}
              disabled={openingChat}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '7px', flexShrink: 0,
                minHeight: '44px', padding: '9px 16px', background: 'var(--blue)', color: '#fff',
                border: 'none', borderRadius: '9999px', cursor: openingChat ? 'default' : 'pointer',
                fontSize: '15px', fontWeight: 600, fontFamily: SFText, opacity: openingChat ? 0.6 : 1,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {openingChat ? 'Opening…' : `Message ${elderName}`}
            </button>
          </div>
        </BlurFade>

        {/* How they are today */}
        {j && (
          <BlurFade delay={3}>
            <div style={{ ...cardStyle, marginTop: '14px' }}>
              <h2 style={{ ...sectionH, fontSize: 'var(--text-lg)', marginBottom: '12px' }}>How {elderName} is today</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  fontSize: '14px', fontWeight: 600,
                  color: j.checkedInToday ? 'var(--green-deep)' : 'var(--ink-3)',
                  background: j.checkedInToday
                    ? 'color-mix(in srgb, var(--green-deep) 8%, transparent)'
                    : 'color-mix(in srgb, var(--ink-3) 7%, transparent)',
                  border: j.checkedInToday
                    ? '1px solid color-mix(in srgb, var(--green-deep) 25%, transparent)'
                    : '1px solid var(--border)',
                  borderRadius: '9999px', padding: '5px 12px', whiteSpace: 'nowrap',
                }}>
                  {j.checkedInToday ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3 2" />
                    </svg>
                  )}
                  {j.checkedInToday ? 'Checked in today' : 'No check-in yet today'}
                </span>
                {j.openNeedsCount > 0 && (
                  <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--ink-3)' }}>
                    {j.openNeedsCount} help request{j.openNeedsCount === 1 ? '' : 's'} open
                  </span>
                )}
              </div>

              {/* Seeing their open requests was never a power; acting on them is.
                  Both live here now — the list reads only unless the parent has
                  granted MANAGE_HELP_REQUESTS, and the server re-checks that grant
                  before any change goes through. */}
              <FamilyNeedsForParent
                elderId={j.elderId}
                elderName={elderName}
                openNeeds={j.openNeeds}
                canManage={powers.includes('MANAGE_HELP_REQUESTS')}
                onChanged={load}
              />
            </div>
          </BlurFade>
        )}

        {/* Friendships they chose to share — one card each, holding both what you
            can see and, where the parent has trusted you, what you can do in their
            name. Seeing and doing used to live on separate tabs (user call
            2026-07-21: make it one). */}
        {j && (
          <BlurFade delay={4}>
            <div>
              <h2 style={{ ...sectionH, fontSize: 'var(--text-lg)', margin: '22px 0 12px' }}>
                Friendships shared with you
              </h2>

              {sharedHelpers.length === 0 && (
                <div style={{ ...cardStyle, padding: '32px 24px', textAlign: 'center' }}>
                  <p style={{ fontSize: '16px', color: 'var(--ink-3)', margin: 0, lineHeight: 1.5 }}>
                    No friendships shared with you yet. {elderName} chooses what to share.
                  </p>
                </div>
              )}

              {sharedHelpers.map(h => {
                // The doing is folded in beside the seeing now. Each control only
                // shows when the parent granted that power AND the ladder is at the
                // point it applies — the same gate each component holds on its own,
                // so the "in their name" note never sits above an empty space.
                const canAdvance = powers.includes('ADVANCE_TRUST') && h.currentTrustLevel !== 'TRUSTED';
                const canReview = powers.includes('LEAVE_REVIEWS') && h.currentTrustLevel === 'TRUSTED' && !!h.helperUserId;
                const canAct = canAdvance || canReview;
                return (
                <div
                  key={h.connectionId}
                  style={{
                    ...cardStyle,
                    border: h.readyToMeet
                      ? '1px solid color-mix(in srgb, var(--blue-deep) 35%, transparent)'
                      : '1px solid var(--border)',
                    background: h.readyToMeet
                      ? 'color-mix(in srgb, var(--blue) 6%, transparent)'
                      : 'var(--canvas)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {h.helperPhotoUrl ? (
                      <img
                        src={h.helperPhotoUrl}
                        alt=""
                        style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                      />
                    ) : (
                      <DefaultAvatar color="var(--ink-4)" size={44} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => navigate(`/user/${h.helperUserId}`)}
                          aria-label={`View ${h.helperName}'s profile`}
                          style={{
                            background: 'none', border: 'none', padding: '2px 0', margin: 0, cursor: 'pointer',
                            fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--blue-deep)',
                            fontFamily: SF, textAlign: 'left', textDecoration: 'underline', textUnderlineOffset: '2px',
                          }}
                        >
                          {h.helperName}
                        </button>
                        <TrustBadge tier={h.tier} score={h.trustScore} />
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(`/user/${h.helperUserId}`)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          background: 'none', border: 'none', padding: '8px 0 0', margin: 0, cursor: 'pointer',
                          minHeight: '32px', fontSize: '14px', fontWeight: 600, color: 'var(--ink-3)', fontFamily: SFText,
                        }}
                      >
                        See their full profile →
                      </button>
                    </div>
                  </div>

                  <TrustJourney
                    currentTrustLevel={h.currentTrustLevel}
                    otherUserName={h.helperName}
                    readOnly
                  />

                  {h.readyToMeet && (
                    <p style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      fontSize: '14px', fontWeight: 600, color: 'var(--blue-deep)',
                      margin: '10px 0 0', lineHeight: 1.4,
                    }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      {h.helperName} is getting ready to meet in person
                    </p>
                  )}

                  <FamilyHelperConnect
                    helper={h}
                    standing={standings.find(s => s.standingConnectionId === h.connectionId)}
                    standingsLoaded={standingsLoaded}
                    elderName={elderName}
                    onChanged={load}
                  />

                  <FamilyHelperUpdates helper={h} elderName={elderName} />

                  {/* Act for me — only what the parent has actually trusted you
                      with, in their name, right beside the friendship it acts on. */}
                  {canAct && (
                    <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                      <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--gold-deep)', fontFamily: SFText, margin: '0 0 4px', lineHeight: 1.5 }}>
                        Anything you do here is in {elderName}&apos;s name
                      </p>
                      {canAdvance && (
                        <FamilyTrustAdvance
                          connectionId={h.connectionId}
                          helperName={h.helperName}
                          elderName={elderName}
                          currentTrustLevel={h.currentTrustLevel}
                          onChanged={load}
                        />
                      )}
                      {canReview && (
                        <FamilyReviewForParent
                          helper={h}
                          elderId={j.elderId}
                          elderName={elderName}
                        />
                      )}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </BlurFade>
        )}
      </div>
    </div>
  );
}
