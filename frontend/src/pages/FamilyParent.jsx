import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import NavBar from '../components/NavBar';
import BlurFade from '../components/magic/BlurFade';
import api from '../api/axios';
import { useToast } from '../context/useToast';
import TrustBadge from '../components/TrustBadge';
import TrustJourney from '../components/TrustJourney';
import SegmentedTabs from '../components/SegmentedTabs';
import FamilyHelperUpdates from '../components/FamilyHelperUpdates';
import FamilyHelperConnect from '../components/FamilyHelperConnect';
import FamilyNeedsForParent from '../components/FamilyNeedsForParent';
import FamilyTrustAdvance from '../components/FamilyTrustAdvance';
import FamilyReviewForParent from '../components/FamilyReviewForParent';
import { POWERS } from '../components/familyPowers';
import { SHARING_GIVES } from '../components/sharingGives';

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

// One quiet line of context under a tab heading — never more than a sentence.
const tabLead = {
  fontSize: '15px',
  color: 'var(--ink-3)',
  fontFamily: SFText,
  lineHeight: 1.5,
  margin: '6px 0 14px',
};

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const ClockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

// Check-in chip — the one thing family wants at a glance, so it rides in the
// page header and stays visible whichever tab is open.
const CheckInChip = ({ checkedIn }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    fontSize: '14px', fontWeight: 600,
    color: checkedIn ? 'var(--green-deep)' : 'var(--ink-3)',
    background: checkedIn ? 'transparent' : 'color-mix(in srgb, var(--ink-3) 7%, transparent)',
    border: checkedIn
      ? '1px solid color-mix(in srgb, var(--green-deep) 25%, transparent)'
      : '1px solid var(--border)',
    borderRadius: '9999px', padding: '5px 12px', whiteSpace: 'nowrap',
  }}>
    {checkedIn ? <CheckIcon /> : <ClockIcon />}
    {checkedIn ? 'Checked in today' : 'No check-in yet today'}
  </span>
);

/**
 * One parent, in full. The family home page got too crowded once a parent had
 * help requests, friendships, trust ladders and guardian actions all stacked in
 * a single card (user call 2026-07-20), so the list stayed there and the depth
 * moved here.
 *
 * That depth then became one 2,300px scroll of equally loud cards. It is three
 * tabs now, one job each (user call 2026-07-26): the friendships they share,
 * how they are today, and what this family member is allowed to do. Friendships
 * is the landing tab — the trust ladder is what family should see on arrival
 * (user call 2026-07-26) — and the check-in chip sits in the header so the
 * "are they alright?" answer never hides behind a tab.
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
  const [askingPower, setAskingPower] = useState(null);
  const [tab, setTab] = useState('friendships');
  const tabsRef = useRef(null);

  // Tabs are different lengths, so switching from the bottom of a long one used
  // to drop you into the middle of the next. 'nearest' only moves the page when
  // the strip has actually scrolled away, and it moves without animation —
  // navigation is not the place for motion.
  const changeTab = (next) => {
    setTab(next);
    tabsRef.current?.scrollIntoView({ block: 'nearest' });
  };

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
  // Consent flow: powers I've asked for that are still waiting on their answer.
  const pendingAsks = (link?.pendingPowerRequests || []).map(r => r.power);

  const sharedHelpers = j?.sharedHelpers || [];
  const elderName = j?.elderName || link?.otherUserName || 'your parent';
  const firstName = elderName.split(' ')[0];
  const openNeedsCount = j?.openNeedsCount || 0;

  const askFor = async (powerKey) => {
    if (!link || askingPower) return;
    setAskingPower(powerKey);
    try {
      await api.post(`/family/links/${link.id}/power-requests`, { power: powerKey });
      toast.success(`Asked. ${elderName} decides on their My Family page.`);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not send the ask. Please try again.');
    } finally {
      setAskingPower(null);
    }
  };

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
          {/* Wraps rather than collides: on a phone the Message button drops to
              its own line instead of sitting on top of the check-in chip. */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flexWrap: 'wrap', margin: '16px 0 18px' }}>
            <DefaultAvatar color="var(--blue)" size={52} />
            <div style={{ flex: '1 1 200px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h1 style={{ ...sectionH }}>{elderName}</h1>
                {j && <CheckInChip checkedIn={j.checkedInToday} />}
              </div>
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
                alignSelf: 'center',
                minHeight: '44px', padding: '9px 16px', background: 'var(--blue)', color: '#fff',
                border: 'none', borderRadius: '9999px', cursor: openingChat ? 'default' : 'pointer',
                fontSize: '15px', fontWeight: 600, fontFamily: SFText, opacity: openingChat ? 0.6 : 1,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {openingChat ? 'Opening…' : `Message ${firstName}`}
            </button>
          </div>
        </BlurFade>

        {/* Three jobs, three tabs. Only the "today" tab carries a count badge —
            an open help request is the one thing that may want acting on. */}
        <div ref={tabsRef}>
          <SegmentedTabs
            segments={[
              { id: 'friendships', label: 'Friendships' },
              /* "Today", not "Margaret today" — the name is in the heading right
                 above, and the longer label truncated on a phone. */
              { id: 'today', label: 'Today', count: openNeedsCount, notify: openNeedsCount > 0 },
              { id: 'powers', label: 'What I can do' },
            ]}
            value={tab}
            onChange={changeTab}
            label={`${elderName}: friendships, how they are today, and what you can do`}
          />
        </div>

        {/* ── Friendships they chose to share ──────────────────────────────
            One card each, holding both what you can see and, where the parent
            has trusted you, what you can do in their name. What sharing gives
            you is explained once — in the empty state, and on the What I can
            do tab — never as a standing preamble above the cards. */}
        {tab === 'friendships' && j && (
          <BlurFade delay={3}>
            <div role="tabpanel" aria-label={`Friendships ${elderName} shares with you`} style={{ marginTop: '18px' }}>
              <h2 style={{ ...sectionH, fontSize: 'var(--text-lg)' }}>
                Friendships shared with you
              </h2>
              <p style={tabLead}>
                {elderName} chooses which friendships you see here.
              </p>

              {sharedHelpers.length === 0 ? (
                <div style={{ ...cardStyle, padding: '28px 24px' }}>
                  <p style={{ fontSize: '16px', color: 'var(--ink)', fontWeight: 600, margin: '0 0 10px', lineHeight: 1.5 }}>
                    No friendships shared with you yet.
                  </p>
                  <p style={{ fontSize: '16px', color: 'var(--ink-3)', margin: '0 0 8px', lineHeight: 1.5 }}>
                    When {elderName} shares one, you can:
                  </p>
                  <ul style={{ margin: 0, padding: '0 0 0 20px', listStyleType: 'disc' }}>
                    {SHARING_GIVES.map(g => (
                      <li key={g.key} style={{ fontSize: '16px', color: 'var(--ink-3)', lineHeight: 1.5, marginBottom: '4px' }}>
                        {g.family(elderName)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                sharedHelpers.map(h => {
                  // The doing is folded in beside the seeing. Each control only
                  // shows when the parent granted that power AND the ladder is at
                  // the point it applies — the same gate each component holds on
                  // its own, so the "for them" note never sits above empty space.
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
                      {/* Identity is one target: avatar, name, badge and chevron
                          all open the profile, instead of a name link plus a
                          second "see their full profile" line saying the same. */}
                      <button
                        type="button"
                        onClick={() => navigate(`/user/${h.helperUserId}`)}
                        aria-label={`View ${h.helperName}'s profile`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
                          background: 'none', border: 'none', padding: 0, margin: 0,
                          cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                        }}
                      >
                        {h.helperPhotoUrl ? (
                          <img
                            src={h.helperPhotoUrl}
                            alt=""
                            style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                          />
                        ) : (
                          <DefaultAvatar color="var(--ink-4)" size={44} />
                        )}
                        <span style={{
                          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center',
                          gap: '8px', flexWrap: 'wrap',
                        }}>
                          <span style={{
                            fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--blue-deep)',
                            fontFamily: SF, textDecoration: 'underline', textUnderlineOffset: '2px',
                          }}>
                            {h.helperName}
                          </span>
                          <TrustBadge tier={h.tier} score={h.trustScore} />
                        </span>
                        <svg width="9" height="15" viewBox="0 0 10 16" fill="none" aria-hidden="true"
                          style={{ flexShrink: 0, color: 'var(--ink-4)' }}>
                          <path d="M1.5 1L8.5 8L1.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>

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

                      {/* Act for me — only what the parent has actually trusted
                          you with, right beside the friendship it acts on. */}
                      {canAct && (
                        <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gold-deep)', fontFamily: SFText, margin: '0 0 8px', lineHeight: 1.5 }}>
                            Acting for {firstName}
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
                })
              )}
            </div>
          </BlurFade>
        )}

        {/* ── How they are today: the check-in, and the help they've asked for ── */}
        {tab === 'today' && j && (
          <BlurFade delay={3}>
            <div role="tabpanel" aria-label={`How ${elderName} is today`} style={{ marginTop: '18px' }}>
              <h2 style={{ ...sectionH, fontSize: 'var(--text-lg)' }}>How {elderName} is today</h2>
              <p style={tabLead}>
                {j.checkedInToday
                  ? `${elderName} has checked in today.`
                  : `${elderName} has not checked in yet today.`}
              </p>

              <div style={{ ...cardStyle, paddingTop: '4px' }}>
                {/* Seeing their open requests was never a power; acting on them
                    is. Both live here — the list reads only unless the parent
                    granted MANAGE_HELP_REQUESTS, and the server re-checks that
                    grant before any change goes through. */}
                <FamilyNeedsForParent
                  elderId={j.elderId}
                  elderName={elderName}
                  openNeeds={j.openNeeds}
                  canManage={powers.includes('MANAGE_HELP_REQUESTS')}
                  onChanged={load}
                />
              </div>
            </div>
          </BlurFade>
        )}

        {/* ── What I can do — consent flow. Each power is on, waiting, or
            askable. Asking never grants anything; it puts a plain yes/no card
            in front of the parent, in the same words their Controls switches
            use. This tab is also where sharing is explained, once. */}
        {tab === 'powers' && link && (
          <BlurFade delay={3}>
            <div role="tabpanel" aria-label={`What you can do for ${elderName}`} style={{ marginTop: '18px' }}>
              <h2 style={{ ...sectionH, fontSize: 'var(--text-lg)' }}>
                What I can do for {elderName}
              </h2>
              <p style={tabLead}>
                {elderName} decides each of these. Anything you do is done for {firstName},
                with your name on it.
              </p>

              <div style={cardStyle}>
                {POWERS.map(p => {
                  const isGranted = powers.includes(p.key);
                  const isWaiting = pendingAsks.includes(p.key);
                  return (
                    <div key={p.key} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      gap: '12px', padding: '12px 0', borderBottom: '1px solid var(--hairline)',
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', fontFamily: SFText, margin: 0 }}>
                          {p.title}
                        </p>
                        <p style={{ fontSize: '14px', color: 'var(--ink-3)', margin: '2px 0 0', lineHeight: 1.45 }}>
                          {isGranted
                            ? `${elderName} lets you do this.`
                            : isWaiting
                              ? `You asked. Waiting for ${elderName} to decide — they answer on their My Family page.`
                              : p.key === 'LEAVE_REVIEWS'
                                ? `Not on yet — you can ask ${elderName}. Reviews unlock when a friendship is fully trusted.`
                                : `Not on yet — you can ask ${elderName}.`}
                        </p>
                      </div>
                      {isGranted ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0,
                          fontSize: '14px', fontWeight: 600, color: 'var(--green-deep)',
                          background: 'transparent',
                          border: '1px solid color-mix(in srgb, var(--green-deep) 25%, transparent)',
                          borderRadius: '9999px', padding: '5px 12px', whiteSpace: 'nowrap',
                        }}>
                          <CheckIcon />
                          On
                        </span>
                      ) : isWaiting ? (
                        <span style={{
                          flexShrink: 0, fontSize: '14px', fontWeight: 600, color: 'var(--ink-3)',
                          background: 'var(--chip-neutral)', border: '1px solid var(--border)',
                          borderRadius: '9999px', padding: '5px 12px', whiteSpace: 'nowrap',
                        }}>
                          Waiting
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => askFor(p.key)}
                          disabled={askingPower !== null}
                          style={{
                            flexShrink: 0, minHeight: '44px', padding: '9px 16px',
                            background: 'none', color: 'var(--blue-deep)',
                            border: '1px solid var(--blue-soft)', borderRadius: '9999px',
                            fontSize: '15px', fontWeight: 600, fontFamily: SFText,
                            cursor: askingPower ? 'wait' : 'pointer', whiteSpace: 'nowrap',
                          }}
                        >
                          {askingPower === p.key ? 'Asking…' : `Ask ${firstName}`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* The one home for what sharing gives you — it used to sit above
                  every friendship card, on every visit. */}
              <div style={cardStyle}>
                <h3 style={{ ...sectionH, fontSize: '16px', marginBottom: '8px' }}>
                  On a friendship {elderName} shares, you can:
                </h3>
                <ul style={{ margin: 0, padding: '0 0 0 20px', listStyleType: 'disc' }}>
                  {SHARING_GIVES.map(g => (
                    <li key={g.key} style={{ fontSize: '16px', color: 'var(--ink-3)', lineHeight: 1.5, marginBottom: '4px' }}>
                      {g.family(elderName)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </BlurFade>
        )}

      </div>
    </div>
  );
}
