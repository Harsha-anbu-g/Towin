import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';
import NavBar from '../components/NavBar';
import TrustJourney from '../components/TrustJourney';
import SegmentedTabs, { SegmentEmpty } from '../components/SegmentedTabs';
import BlurFade from '../components/magic/BlurFade';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useSeenIds } from '../lib/useSeenIds';

function TabBadge({ count }) {
  if (!count) return null;
  return (
    <span style={{
      marginLeft: '8px', verticalAlign: 'middle',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: '22px', height: '22px', padding: '0 7px', boxSizing: 'border-box',
      background: '#5a6470', color: '#fff', fontSize: '13px', fontWeight: 600,
      borderRadius: '9999px', lineHeight: 1,
    }}>{count}</span>
  );
}

const unsplash = (id, w, h) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

function StarPicker({ value, onChange }) {
  const SFT = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      {[1,2,3,4,5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '32px', padding: '0',
            color: n <= value ? '#F5B400' : '#e0e0e0',
            transition: 'color 0.1s',
            fontFamily: SFT,
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

const COMMUNITY_PHOTOS = [
  { id: 'photo-1529156069898-49953e39b3ac', label: 'Community' },
  { id: 'photo-1544005313-94ddf0286df2', label: 'Elder woman' },
  { id: 'photo-1573497491208-6b1acb260507', label: 'Helping hands' },
  { id: 'photo-1438761681033-6461ffad8d80', label: 'Community member' },
];

const TRUST_LEVEL_ORDER = { DISCOVERED: 1, MESSAGING: 2, PHONE_CALL: 3, VIDEO_CALL: 4, VERIFIED: 5, FIRST_MEET: 6, TRUSTED: 7 };
const STATUS_ORDER = { ACTIVE: 0, PENDING: 1 };
const sortConnections = (a, b) => {
  const aS = STATUS_ORDER[a.status] ?? 2;
  const bS = STATUS_ORDER[b.status] ?? 2;
  if (aS !== bS) return aS - bS;
  return (TRUST_LEVEL_ORDER[b.currentTrustLevel] ?? 0) - (TRUST_LEVEL_ORDER[a.currentTrustLevel] ?? 0);
};

const NEED_STATUS_ORDER = { OPEN: 0, ASSIGNED: 1, COMPLETED: 2, CANCELLED: 3 };
const sortNeeds = (a, b) => {
  const aS = NEED_STATUS_ORDER[a.status] ?? 4;
  const bS = NEED_STATUS_ORDER[b.status] ?? 4;
  if (aS !== bS) return aS - bS;
  if (a.status === 'OPEN' && b.status === 'OPEN') {
    return (a.urgency === 'URGENT' ? 0 : 1) - (b.urgency === 'URGENT' ? 0 : 1);
  }
  return 0;
};

const statusStyle = (status) => {
  const map = {
    ACTIVE:  { bg: '#f5f5f7', color: '#4FA3CE' },
    PENDING: { bg: '#f3f4f6', color: '#5a6470' },
    DECLINED: { bg: '#f3f4f6', color: '#5a6470' },
  };
  const s = map[status] ?? { bg: '#f3f4f6', color: '#6b7280' };
  return { background: s.bg, color: s.color, fontSize: '11px', fontWeight: 600,
    padding: '3px 10px', borderRadius: '9999px', letterSpacing: '0.3px', textTransform: 'uppercase' };
};

const initials = (name) => name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';

// Plain, everyday words for the help categories.
const CATEGORY = {
  COMPANIONSHIP:  'Company',
  TRANSPORTATION: 'Rides',
  ERRANDS:        'Shopping',
  CLEANING:       'Cleaning',
  OTHER:          'Other',
};
const catLabel = (c) => CATEGORY[c] || c;

const TAB_ICONS = {
  connections: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  discover:    '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  browse:      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
};
function TabIcon({ id, active }) {
  const path = TAB_ICONS[id];
  if (!path) return null;
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: active ? '#fff' : '#5a6470' }} dangerouslySetInnerHTML={{ __html: path }} />;
}

export default function HelperDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const seenConn = useSeenIds(user?.userId, 'connections');
  const seenNeeds = useSeenIds(user?.userId, 'needs');
  const [profile, setProfile] = useState(null);
  const [connections, setConnections] = useState([]);
  const [needs, setNeeds] = useState([]);
  const [elders, setElders] = useState([]);
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState(false);
  const [tab, setTab] = useState('connections');
  // Sub-filter for My Elders. null = follow the smart default (action-first).
  const [eldersSeg, setEldersSeg] = useState(null);
  const [applying, setApplying] = useState(null);
  const [applyMsg, setApplyMsg] = useState({});
  const [connectingTo, setConnectingTo] = useState(null);
  const [endingConn, setEndingConn] = useState(null);
  const [connectMsg, setConnectMsg] = useState({});
  const [respondingConn, setRespondingConn] = useState(null);
  const [confirmingTrust, setConfirmingTrust] = useState(null);
  const [reviewingConn, setReviewingConn] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, tags: [], comment: '', safetyConcern: false });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewedConns, setReviewedConns] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('idle');
  const [radiusKm, setRadiusKm] = useState(25);

  async function loadNeeds(loc) {
    try {
      const coords = loc ?? location;
      const res = coords
        ? await api.get(`/needs/nearby?lat=${coords.lat}&lng=${coords.lng}&radiusKm=${radiusKm}`)
        : await api.get('/needs/open');
      setNeeds(res.data);
    } catch {}
  }
  async function loadConnections() {
    setLoading(true);
    try { const r = await api.get('/connections'); setConnections(r.data); } catch {}
    finally { setLoading(false); }
  }
  async function loadElders(loc) {
    setDiscovering(true);
    setDiscoverError(false);
    try {
      const coords = loc ?? location;
      let url = '/discover/elders';
      if (coords) url += `?lat=${coords.lat}&lng=${coords.lng}&radiusKm=${radiusKm}`;
      const r = await api.get(url);
      setElders(r.data);
    } catch {
      setDiscoverError(true);
    } finally {
      setDiscovering(false);
    }
  }

  function requestLocation() {
    if (!navigator.geolocation) { setLocationStatus('denied'); loadNeeds(); return; }
    setLocationStatus('asking');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(loc); setLocationStatus('granted'); loadNeeds(loc);
      },
      () => { setLocationStatus('denied'); loadNeeds(); },
      // Don't hang on an unanswered permission prompt — fall back to showing everything
      { timeout: 8000, maximumAge: 300000 }
    );
  }

  useEffect(() => {
    api.get('/profile/me').then(r => setProfile(r.data)).catch(() => {});
    loadConnections();
    requestLocation();
  }, []);

  useEffect(() => {
    if (tab === 'browse') loadNeeds();
    if (tab === 'connections') loadConnections();
    if (tab === 'discover') loadElders();
  }, [tab, radiusKm]);

  async function withdrawApplication(needId) {
    try {
      await api.delete(`/needs/${needId}/apply`);
      setApplyMsg(prev => { const next = {...prev}; delete next[needId]; return next; });
      toast.info('Application withdrawn.');
    } catch { toast.error('Could not withdraw. Try again.'); }
  }

  async function apply(needId) {
    setApplying(needId);
    try {
      await api.post(`/needs/${needId}/apply`);
      setApplyMsg(prev => ({...prev, [needId]: 'Applied!'}));
      toast.success('Application sent!');
      await loadNeeds();
    } catch (err) {
      setApplyMsg(prev => ({...prev, [needId]: err?.response?.data?.message || 'Could not apply.'}));
    } finally { setApplying(null); }
  }

  async function connectToElder(elderId) {
    setConnectingTo(elderId);
    try {
      await api.post('/connections/request', { targetUserId: elderId });
      setConnectMsg(prev => ({...prev, [elderId]: 'Request sent!'}));
      await loadConnections();
    } catch (err) {
      setConnectMsg(prev => ({...prev, [elderId]: err?.response?.data?.message || 'Could not connect.'}));
    } finally { setConnectingTo(null); }
  }

  async function respondToConnection(connId, accept) {
    setRespondingConn(connId);
    try {
      await api.post(`/connections/${connId}/respond`, { accept });
      if (accept) toast.success('Connection accepted!');
      await loadConnections();
    }
    catch (err) { toast.error(err?.response?.data?.message || 'Could not respond to request.'); }
    finally { setRespondingConn(null); }
  }

  async function endConnection(connId) {
    try {
      await api.delete(`/connections/${connId}`);
      toast.info('Connection ended.');
      await loadConnections();
    } catch (err) { toast.error(err?.response?.data?.message || 'Could not end connection.'); }
  }

  async function confirmTrust(connId) {
    setConfirmingTrust(connId);
    try {
      await api.post(`/trust/${connId}/confirm`);
      toast.success('Trust level confirmed!');
      await loadConnections();
    }
    catch (err) { toast.error('Could not advance trust level. Try again.'); }
    finally { setConfirmingTrust(null); }
  }

  const REVIEW_TAGS = ['Friendly', 'Punctual', 'Respectful', 'Helpful', 'Patient'];

  async function submitElderReview(conn) {
    setSubmittingReview(true);
    try {
      await api.post('/reviews', { revieweeId: conn.otherUserId, ...reviewForm, comment: reviewForm.comment || null });
      setReviewedConns(prev => new Set([...prev, conn.id]));
      setReviewingConn(null);
      setReviewForm({ rating: 5, tags: [], comment: '', safetyConcern: false });
      toast.success('Review submitted!');
    } catch (err) { toast.error(err?.response?.data?.message || 'Could not submit review.'); }
    finally { setSubmittingReview(false); }
  }

  const TRUST_LABELS = { DISCOVERED: 'Just Connected', MESSAGING: 'Messaging', PHONE_CALL: 'Phone Ready', VIDEO_CALL: 'Video Ready', VERIFIED: 'Verified', FIRST_MEET: 'Ready to Meet', TRUSTED: 'Fully Trusted' };
  const trustLabel = (l) => TRUST_LABELS[l] || l;
  // Only ACTIVE connections count as "Connected" — a pending request must not
  // show the Connected badge in Discover.
  const connectedElderIds = new Set(connections.filter(c => c.status === 'ACTIVE').map(c => c.otherUserId));

  const connTokens = connections.map(c => `${c.id}:${c.status}`);
  const needTokens = needs.map(n => n.id);
  const connBadge = seenConn.unseenCount(connTokens);
  const browseBadge = seenNeeds.unseenCount(needTokens);

  useEffect(() => {
    if (tab === 'connections') seenConn.markSeen(connTokens);
    if (tab === 'browse') seenNeeds.markSeen(needTokens);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, connections, needs]);

  const tabs = [
    ['connections', 'My Elders', connBadge],
    ['discover', 'Find New Elder', 0],
    ['browse', 'Browse Needs', browseBadge],
  ];

  // One warm greeting, shown once at the top of the landing tab.
  const greeting = (() => {
    if (!profile?.name) return null;
    const now = new Date();
    const h = now.getHours();
    const greet = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    const firstName = profile.name.split(' ')[0];
    const dateStr = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    return (
      <div style={{
        background: 'linear-gradient(135deg, #EAF5FB 0%, #F6FBFE 60%, #EDF4F8 100%)',
        border: '1px solid #D8EAF4', borderRadius: '18px',
        padding: '24px 28px',
      }}>
        <p style={{
          fontSize: '13px', fontWeight: 600, color: '#3D8AB0',
          letterSpacing: '1px', textTransform: 'uppercase', margin: '0 0 6px',
        }}>
          {dateStr}
        </p>
        <p style={{
          fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif",
          fontSize: '28px', fontWeight: 700, color: '#1d1d1f',
          letterSpacing: '-0.5px', margin: 0, lineHeight: 1.2,
        }}>
          {greet}, {firstName}
        </p>
        <p style={{ fontSize: '15px', color: '#5a6470', margin: '6px 0 0' }}>
          Welcome back. Here&apos;s what&apos;s happening with the people you help.
        </p>
      </div>
    );
  })();

  const activeConnections = connections.filter(c => c.status === 'ACTIVE');
  const pendingApplications = needs.filter(n => applyMsg[n.id]);

  const RadiusBar = ({ noun = 'people' }) => (
    <div style={{ background: '#ffffff', borderRadius: '14px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', border: '1px solid #e0e0e0' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#3a4450' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4FA3CE" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        {locationStatus === 'asking' && 'Getting your location...'}
        {locationStatus === 'granted' && `Showing ${noun} within ${radiusKm} km of you`}
        {locationStatus === 'denied' && `Location unavailable, showing all ${noun}`}
        {locationStatus === 'idle' && 'Detecting location...'}
      </span>
      {locationStatus === 'granted' && (
        <select value={radiusKm} onChange={e => setRadiusKm(Number(e.target.value))}
          style={{ fontSize: '13px', fontWeight: 600, color: '#4FA3CE', background: '#EAF5FB', border: '1px solid #BFD9EA', borderRadius: '9999px', padding: '6px 12px', outline: 'none', cursor: 'pointer' }}>
          {[5,10,25,50,100].map(v => <option key={v} value={v}>{v} km</option>)}
        </select>
      )}
    </div>
  );

  // ── My Elders — classify connections by trust state (mirrors the elder view) ──
  const incomingPending = connections.filter(c => c.status === 'PENDING' && !c.initiatedByMe);
  const elderCounts = {
    active:   connections.filter(c => c.status === 'ACTIVE' && c.currentTrustLevel === 'TRUSTED').length,
    building: connections.filter(c => c.status === 'ACTIVE' && c.currentTrustLevel !== 'TRUSTED').length,
    requests: connections.filter(c => c.status === 'PENDING').length,
  };
  const eldersDefault = incomingPending.length > 0 ? 'requests'
    : elderCounts.active > 0 ? 'active'
    : elderCounts.building > 0 ? 'building' : 'requests';
  const activeEldersSeg = eldersSeg ?? eldersDefault;
  const elderSegments = [
    { id: 'active',   label: 'Active',         count: elderCounts.active },
    { id: 'building', label: 'Building Trust', count: elderCounts.building },
    { id: 'requests', label: 'Requests',       count: elderCounts.requests },
  ];
  const visibleConnections = [...connections].filter(c => {
    if (activeEldersSeg === 'active')   return c.status === 'ACTIVE' && c.currentTrustLevel === 'TRUSTED';
    if (activeEldersSeg === 'building') return c.status === 'ACTIVE' && c.currentTrustLevel !== 'TRUSTED';
    return c.status === 'PENDING';
  }).sort(sortConnections);
  const eldersEmptyText = {
    active:   <>No fully trusted elders yet. As your trust grows with an elder, they'll appear here.</>,
    building: <>No connections in progress. Reach out to an elder to start building trust together.</>,
    requests: <>No pending requests. New connection requests will show up here.</>,
  }[activeEldersSeg];

  return (
    <div style={{ minHeight: '100svh', background: '#fafafc', fontFamily: "-apple-system, 'SF Pro Text', system-ui, sans-serif" }}>
      <NavBar />

      {/* ── Sticky tab bar ── */}
      <div style={{
        position: 'sticky', top: '60px', zIndex: 50,
        background: '#ffffff',
        borderBottom: '1px solid #ececef',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
        <div className="dash-tab-wrap">
          <div className="dash-tab-scroll">
            {tabs.map(([id, label, badge]) => {
              const active = tab === id;
              return (
                <button key={id} onClick={() => setTab(id)} style={{
                  flex: '1 1 auto',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  height: '44px', padding: '0 16px',
                  fontSize: '15px', letterSpacing: '-0.1px',
                  fontWeight: active ? 700 : 600,
                  color: active ? '#ffffff' : '#5a6470',
                  background: active ? '#4FA3CE' : 'transparent',
                  border: active ? '1px solid #4FA3CE' : '1px solid transparent',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s',
                  whiteSpace: 'nowrap',
                  fontFamily: 'inherit',
                  position: 'relative',
                }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f0f0f3'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                >
                  <TabIcon id={id} active={active} />
                  {label}
                  <TabBadge count={badge} />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="dash-content">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* My Elders tab (landing) */}
          {tab === 'connections' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <style>{`@keyframes shimmer { 0%,100%{opacity:0.6} 50%{opacity:1} }`}</style>
              {greeting}
              <h2 style={{ fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif", fontSize: '22px', fontWeight: 700, letterSpacing: '-0.3px', color: '#1d1d1f', margin: '8px 0 0' }}>
                My Elders
              </h2>
              {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[1,2].map(i => (
                    <div key={i} style={{ background: '#f5f5f7', borderRadius: '18px', height: '80px', animation: 'shimmer 1.5s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
                  ))}
                  <style>{`@keyframes shimmer { 0%,100%{opacity:0.6} 50%{opacity:1} }`}</style>
                </div>
              )}
              {!loading && connections.length === 0 && (
                <div style={{ background: '#ffffff', borderRadius: '18px', textAlign: 'center', padding: '48px 24px', border: '1px solid #e0e0e0' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#f5f5f7', border: '1px solid #BFD9EA', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4FA3CE" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  </div>
                  <p style={{ fontSize: '17px', fontWeight: 600, color: '#1d1d1f', marginBottom: '6px' }}>No connections yet</p>
                  <p style={{ fontSize: '14px', color: '#7a7a7a', marginBottom: '20px', maxWidth: '280px', margin: '0 auto 20px' }}>Discover elders near you and send a connection request to get started.</p>
                  <button onClick={() => setTab('discover')} className="btn-primary" style={{ padding: '10px 24px', fontSize: '14px' }}>
                    Find New Elder
                  </button>
                </div>
              )}
              {!loading && connections.length > 0 && (
                <SegmentedTabs segments={elderSegments} value={activeEldersSeg} onChange={setEldersSeg} />
              )}
              {!loading && connections.length > 0 && visibleConnections.length === 0 && (
                <SegmentEmpty icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4FA3CE" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}>
                  {eldersEmptyText}
                </SegmentEmpty>
              )}
              {visibleConnections.map((conn, i) => {
                const isIncoming = conn.status === 'PENDING' && !conn.initiatedByMe;
                const avatar = (
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#E6F2FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', fontWeight: 700, color: '#2E7DA6', flexShrink: 0 }}>
                    {initials(conn.otherUserName)}
                  </div>
                );
                return (
                <div key={conn.id} style={{
                  background: '#ffffff', borderRadius: '18px', padding: '22px',
                  border: isIncoming ? '1px solid #BFD9EA' : '1px solid #e0e0e0',
                  animation: `fadeSlideUp 0.4s ease ${i * 0.05}s both`,
                }}>
                  {isIncoming ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                          {avatar}
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontWeight: 600, fontSize: '18px', color: '#1d1d1f', margin: 0 }}>{conn.otherUserName || 'Elder'}</p>
                            <p style={{ fontSize: '14px', color: '#5a6470', margin: '4px 0 0' }}>wants to connect with you</p>
                            {conn.requestMessage && (
                              <p style={{ fontSize: '14px', color: '#5a6470', fontStyle: 'italic', margin: '6px 0 0' }}>"{conn.requestMessage}"</p>
                            )}
                          </div>
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#2E7DA6', background: '#E6F2FA', padding: '5px 12px', borderRadius: '9999px', letterSpacing: '0.3px', textTransform: 'uppercase' }}>New Request</span>
                      </div>
                      <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                        <button onClick={() => respondToConnection(conn.id, true)} disabled={respondingConn === conn.id}
                          style={{ flex: 1, height: '44px', background: '#4FA3CE', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>Accept</button>
                        <button onClick={() => respondToConnection(conn.id, false)} disabled={respondingConn === conn.id}
                          style={{ flex: 1, height: '44px', background: '#fff', color: '#5a6470', border: '1px solid #e0e0e0', borderRadius: '10px', fontSize: '15px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>Decline</button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Identity row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        {avatar}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <p style={{ fontWeight: 600, fontSize: '18px', color: '#1d1d1f', margin: 0 }}>{conn.otherUserName || 'Elder'}</p>
                            {conn.status === 'ACTIVE' ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#E6F2FA', padding: '3px 10px', borderRadius: '9999px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2E7DA6' }} />
                                <span style={{ fontSize: '13px', fontWeight: 700, color: '#2E7DA6' }}>{trustLabel(conn.currentTrustLevel)}</span>
                              </div>
                            ) : (
                              <span style={{ display: 'inline-block', ...statusStyle('PENDING') }}>Request Sent</span>
                            )}
                          </div>
                          {conn.status === 'ACTIVE' && conn.otherUserPhone && (
                            <p style={{ fontSize: '14px', color: '#3a4450', margin: '6px 0 0', display: 'flex', alignItems: 'center', gap: '7px' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5a6470" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                              {conn.otherUserPhone}
                            </p>
                          )}
                          {conn.requestMessage && conn.status !== 'ACTIVE' && (
                            <p style={{ fontSize: '13px', color: '#a0a0a5', fontStyle: 'italic', margin: '6px 0 0' }}>"{conn.requestMessage}"</p>
                          )}
                        </div>
                      </div>

                      {/* Action bar */}
                      {conn.status === 'ACTIVE' && (
                        endingConn === conn.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '14px', color: '#5a6470', flex: 1, minWidth: '160px' }}>End your connection with {conn.otherUserName || 'this elder'}?</span>
                            <button onClick={() => { setEndingConn(null); endConnection(conn.id); }} style={{ height: '36px', padding: '0 16px', background: '#9b3535', color: '#fff', border: 'none', borderRadius: '9999px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Yes, end</button>
                            <button onClick={() => setEndingConn(null)} style={{ height: '36px', padding: '0 16px', background: '#fff', color: '#5a6470', border: '1px solid #e0e0e0', borderRadius: '9999px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>Keep</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
                            <button onClick={() => navigate(`/messages/${conn.id}`)} style={{ height: '36px', padding: '0 18px', background: '#4FA3CE', color: '#fff', border: 'none', borderRadius: '9999px', fontSize: '14px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                              Message
                            </button>
                            <button onClick={() => navigate(`/user/${conn.otherUserId}`)} style={{ height: '36px', padding: '0 14px', background: '#fff', color: '#4FA3CE', border: '1px solid #BFD9EA', borderRadius: '9999px', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>View Profile</button>
                            {conn.currentTrustLevel === 'TRUSTED' && !reviewedConns.has(conn.id) && (
                              <button onClick={() => setReviewingConn(reviewingConn === conn.id ? null : conn.id)} style={{ height: '36px', padding: '0 14px', background: '#fff', color: '#4FA3CE', border: '1px solid #BFD9EA', borderRadius: '9999px', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="#4FA3CE" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                                Review
                              </button>
                            )}
                            {reviewedConns.has(conn.id) && (
                              <span style={{ height: '36px', padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#4FA3CE', fontWeight: 600 }}>
                                <svg width="13" height="10" viewBox="0 0 11 9" fill="none"><path d="M1 4.5L3.8 7.5L10 1" stroke="#4FA3CE" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                Reviewed
                              </span>
                            )}
                            <button onClick={() => setEndingConn(conn.id)} style={{ marginLeft: 'auto', height: '36px', padding: '0 14px', background: '#fff', color: '#8a929c', border: '1px solid #e0e0e0', borderRadius: '9999px', fontSize: '13px', fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}>End</button>
                          </div>
                        )
                      )}
                    </>
                  )}

                  {reviewingConn === conn.id && (
                    <div style={{ borderTop: '1px solid #f0f0f0', marginTop: '14px', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: '#1d1d1f' }}>Rate {conn.otherUserName || 'this elder'}</p>
                      <StarPicker value={reviewForm.rating} onChange={r => setReviewForm(f => ({...f, rating: r}))} />
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {REVIEW_TAGS.map(t => (
                          <button key={t} onClick={() => setReviewForm(f => ({
                            ...f, tags: f.tags.includes(t) ? f.tags.filter(x => x !== t) : [...f.tags, t]
                          }))} style={{
                            fontSize: '13px', padding: '5px 14px', borderRadius: '9999px', border: '1px solid', cursor: 'pointer', transition: 'all 0.15s',
                            borderColor: reviewForm.tags.includes(t) ? '#4FA3CE' : '#e0e0e0',
                            background: reviewForm.tags.includes(t) ? '#4FA3CE' : '#fff',
                            color: reviewForm.tags.includes(t) ? '#fff' : '#7a7a7a',
                          }}>{t}</button>
                        ))}
                      </div>
                      <textarea value={reviewForm.comment} onChange={e => setReviewForm(f => ({...f, comment: e.target.value}))}
                        placeholder="Any comments? (optional)" rows={2}
                        style={{ width: '100%', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '10px 14px', fontSize: '14px', outline: 'none', fontFamily: 'inherit' }} />
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#7a7a7a', cursor: 'pointer' }}>
                        <input type="checkbox" checked={reviewForm.safetyConcern} onChange={e => setReviewForm(f => ({...f, safetyConcern: e.target.checked}))} />
                        Report a safety concern
                      </label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => submitElderReview(conn)} disabled={submittingReview} className="btn-primary" style={{ flex: 1, padding: '10px' }}>
                          {submittingReview ? 'Submitting...' : 'Submit Review'}
                        </button>
                        <button onClick={() => setReviewingConn(null)} className="btn-ghost">Cancel</button>
                      </div>
                    </div>
                  )}

                  {/* Trust Journey — only on active connections */}
                  {conn.status === 'ACTIVE' && (
                    <TrustJourney
                      currentTrustLevel={conn.currentTrustLevel}
                      confirmedByMe={conn.confirmedByMe}
                      confirmedByOther={conn.confirmedByOther}
                      otherUserName={conn.otherUserName || 'them'}
                      isElder={false}
                      onConfirm={() => confirmTrust(conn.id)}
                      confirming={confirmingTrust === conn.id}
                    />
                  )}
                </div>
                );
              })}
            </div>
          )}

          {/* Browse Needs tab */}
          {tab === 'browse' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <h2 style={{ fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif", fontSize: '22px', fontWeight: 700, letterSpacing: '-0.3px', color: '#1d1d1f', margin: '0 0 6px' }}>
                  Requests Near You
                </h2>
                <p style={{ fontSize: '15px', color: '#5a6470', margin: 0 }}>
                  Elders nearby who could use a hand. Offer to help with one tap.
                </p>
              </div>
              <RadiusBar noun="requests" />
              {needs.length === 0 && locationStatus !== 'asking' && (
                <div style={{ background: '#ffffff', borderRadius: '18px', textAlign: 'center', padding: '64px 24px', border: '1px solid #e0e0e0' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#f5f5f7', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4FA3CE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                  </div>
                  <p style={{ fontSize: '16px', fontWeight: 600, color: '#1d1d1f', marginBottom: '6px' }}>No requests found</p>
                  <p style={{ fontSize: '14px', color: '#7a7a7a' }}>
                    {locationStatus === 'granted'
                      ? `Nothing within ${radiusKm} km right now. Use the radius selector above to expand your search area.`
                      : 'No open requests right now. Check back soon or enable location to filter by distance.'}
                  </p>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[...needs].sort(sortNeeds).map((need, i) => {
                const applied = applyMsg[need.id]?.includes('!');
                return (
                <div key={need.id} style={{
                  background: '#ffffff', borderRadius: '18px', padding: '20px',
                  border: '1px solid #e0e0e0',
                  animation: `fadeSlideUp 0.4s ease ${i * 0.05}s both`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: '16px', color: '#1d1d1f', margin: 0, lineHeight: 1.3 }}>{need.title}</p>
                      {need.description && <p style={{ fontSize: '14px', color: '#3a4450', margin: '10px 0 0', lineHeight: 1.5 }}>{need.description}</p>}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, background: '#F2F4F7', color: '#5a6470', padding: '4px 11px', borderRadius: '9999px' }}>{catLabel(need.category)}</span>
                        {need.urgency === 'URGENT' && (
                          <span style={{ fontSize: '12px', fontWeight: 700, background: '#EEF1F4', color: '#3a4450', padding: '4px 11px', borderRadius: '9999px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#cc0000' }} />Urgent
                          </span>
                        )}
                        <span style={{ fontSize: '13px', color: '#8a929c' }}>
                          {need.distanceKm != null ? `${Math.round(need.distanceKm * 10) / 10} km · ` : ''}Posted by {need.elderName}
                        </span>
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                      {applied ? (
                        <span style={{ height: '40px', display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '0 18px', background: '#E6F2FA', color: '#2E7DA6', borderRadius: '9999px', fontSize: '14px', fontWeight: 700 }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2E7DA6" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          Applied
                        </span>
                      ) : (
                        <button onClick={() => apply(need.id)} disabled={applying === need.id}
                          style={{ height: '40px', padding: '0 24px', background: '#4FA3CE', color: '#fff', border: 'none', borderRadius: '9999px', fontSize: '14px', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                          {applying === need.id ? '...' : 'Offer to Help'}
                        </button>
                      )}
                      {applied && (
                        <button onClick={() => withdrawApplication(need.id)}
                          style={{ fontSize: '13px', color: '#5a6470', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>
                          Withdraw
                        </button>
                      )}
                    </div>
                  </div>
                  {applyMsg[need.id] && !applied && (
                    <p style={{ fontSize: '14px', color: '#5a6470', marginTop: '10px' }}>{applyMsg[need.id]}</p>
                  )}
                </div>
                );
              })}
              </div>
            </div>
          )}

          {/* Find New Elder tab */}
          {tab === 'discover' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <h2 style={{ fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif", fontSize: '22px', fontWeight: 700, letterSpacing: '-0.3px', color: '#1d1d1f', margin: '0 0 6px' }}>
                  Find an Elder to Help
                </h2>
                <p style={{ fontSize: '15px', color: '#5a6470', margin: 0 }}>
                  Reach out to elders near you and start building trust.
                </p>
              </div>
              <RadiusBar noun="elders" />
              {/* Searching state — never flash a blank "nobody here" while loading (H1) */}
              {discovering && elders.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[1,2].map(i => (
                    <div key={i} style={{ background: '#f5f5f7', borderRadius: '18px', height: '110px', animation: 'shimmer 1.5s ease-in-out infinite' }} />
                  ))}
                  <p style={{ fontSize: '14px', color: '#7a7a7a', textAlign: 'center', margin: 0 }}>Looking for elders near you…</p>
                </div>
              )}

              {/* Fetch failed — be honest and give a retry (H9) */}
              {!discovering && discoverError && (
                <div style={{ background: '#ffffff', borderRadius: '18px', textAlign: 'center', padding: '40px 24px', border: '1px solid #fecaca' }}>
                  <p style={{ fontSize: '16px', fontWeight: 600, color: '#1d1d1f', marginBottom: '6px' }}>Couldn't load elders</p>
                  <p style={{ fontSize: '14px', color: '#7a7a7a', marginBottom: '18px' }}>Something went wrong on our side. Please try again.</p>
                  <button onClick={() => loadElders()} className="btn-primary" style={{ padding: '10px 24px', fontSize: '14px' }}>
                    Try Again
                  </button>
                </div>
              )}

              {!discovering && !discoverError && elders.length === 0 && (
                <div style={{ background: '#ffffff', borderRadius: '18px', textAlign: 'center', padding: '64px 24px', border: '1px solid #e0e0e0' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#f5f5f7', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4FA3CE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                    </svg>
                  </div>
                  <p style={{ fontSize: '16px', fontWeight: 600, color: '#1d1d1f', marginBottom: '6px' }}>
                    {locationStatus === 'granted' ? 'No elders found nearby' : 'No elders available right now'}
                  </p>
                  <p style={{ fontSize: '14px', color: '#7a7a7a' }}>
                    {locationStatus === 'granted'
                      ? 'Try a larger radius above, or check back later.'
                      : 'New members join often. Please check back soon.'}
                  </p>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {elders.map((elder, i) => {
                const alreadyConnected = connectedElderIds.has(elder.userId);
                const sent = connectMsg[elder.userId];
                return (
                  <div key={elder.userId} style={{
                    background: '#ffffff', borderRadius: '18px', padding: '20px',
                    border: '1px solid #e0e0e0',
                    animation: `fadeSlideUp 0.4s ease ${i * 0.05}s both`,
                  }}>
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                      <div style={{
                        width: '50px', height: '50px', borderRadius: '50%',
                        background: '#E6F2FA',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '17px', fontWeight: 700, color: '#2E7DA6', flexShrink: 0,
                      }}>
                        {initials(elder.name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <p style={{ fontWeight: 600, fontSize: '18px', color: '#1d1d1f', margin: 0 }}>{elder.name || 'Elder'}</p>
                          {(elder.trustScore != null || elder.trustTier) && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#E6F2FA', padding: '3px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 700, color: '#2E7DA6' }}>
                              {elder.trustTier || 'New'}{elder.trustScore != null ? ` · ${elder.trustScore}` : ''}
                            </span>
                          )}
                        </div>
                        {(elder.city || elder.distanceKm != null) && (
                          <p style={{ fontSize: '14px', color: '#5a6470', margin: '4px 0 0' }}>
                            {elder.city}{elder.city && elder.distanceKm != null ? ' · ' : ''}{elder.distanceKm != null ? `${Math.round(elder.distanceKm * 10) / 10} km away` : ''}
                          </p>
                        )}
                        {elder.bio && <p style={{ fontSize: '14px', color: '#3a4450', margin: '8px 0 0', lineHeight: 1.5 }}>{elder.bio}</p>}
                        {elder.interests?.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                            {elder.interests.map(interest => (
                              <span key={interest} style={{ fontSize: '12px', fontWeight: 600, background: '#F2F4F7', color: '#5a6470', padding: '4px 11px', borderRadius: '9999px' }}>{interest}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'stretch', flexShrink: 0 }}>
                        {alreadyConnected ? (
                          <span style={{ fontSize: '12px', background: '#E6F2FA', color: '#2E7DA6', padding: '9px 18px', borderRadius: '9999px', fontWeight: 700, textAlign: 'center' }}>Connected</span>
                        ) : sent ? (
                          <span style={{
                            fontSize: '12px', padding: '9px 18px', borderRadius: '9999px', fontWeight: 600, textAlign: 'center',
                            background: sent.includes('!') ? '#E6F2FA' : '#f3f4f6',
                            color: sent.includes('!') ? '#2E7DA6' : '#5a6470',
                          }}>{sent}</span>
                        ) : (
                          <button onClick={() => connectToElder(elder.userId)} disabled={connectingTo === elder.userId}
                            style={{ height: '40px', padding: '0 22px', background: '#4FA3CE', color: '#fff', border: 'none', borderRadius: '9999px', fontSize: '14px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                            {connectingTo === elder.userId ? '...' : 'Connect'}
                          </button>
                        )}
                        <button onClick={() => navigate(`/user/${elder.userId}`)}
                          style={{ height: '36px', padding: '0 14px', background: '#fff', color: '#4FA3CE', border: '1px solid #BFD9EA', borderRadius: '9999px', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                          View Profile
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
