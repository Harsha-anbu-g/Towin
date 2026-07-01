import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';
import NavBar from '../components/NavBar';
import TrustJourney from '../components/TrustJourney';
import SegmentedTabs, { SegmentEmpty } from '../components/SegmentedTabs';
import DashTab from '../components/DashTab';
import PeekabooCard from '../components/PeekabooCard';
import BlurFade from '../components/magic/BlurFade';
import LocationPrompt from '../components/LocationPrompt';
import LocationPrimer from '../components/LocationPrimer';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import SmoothInput from '../components/SmoothInput';
import { useAuth } from '../context/AuthContext';
import { useSeenIds } from '../lib/useSeenIds';

function TabBadge({ count }) {
  if (!count) return null;
  return (
    <span style={{
      marginLeft: '8px', verticalAlign: 'middle',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: '22px', height: '22px', padding: '0 7px', boxSizing: 'border-box',
      background: 'var(--ink-slate)', color: '#fff', fontSize: 'var(--text-xs)', fontWeight: 600,
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
  { id: 'photo-1576765974256-9b879d60a571', label: 'Elder with helper' },
  { id: 'photo-1529156069898-49953e39b3ac', label: 'Community' },
  { id: 'photo-1559839734-2b71ea197ec2', label: 'Elder woman' },
  { id: 'photo-1507679799987-c73779587ccf', label: 'Elder man' },
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
  // Within OPEN: urgent before normal
  if (a.status === 'OPEN' && b.status === 'OPEN') {
    const aU = a.urgency === 'URGENT' ? 0 : 1;
    const bU = b.urgency === 'URGENT' ? 0 : 1;
    return aU - bU;
  }
  return 0;
};

const statusStyle = (status) => {
  const active = ['OPEN', 'ACTIVE', 'ASSIGNED', 'PENDING'].includes(status);
  return {
    background: active ? '#f5f5f7' : '#f3f4f6',
    color: active ? '#4FA3CE' : '#7a7a7a',
    fontSize: '11px', fontWeight: 600,
    padding: '3px 10px', borderRadius: '9999px',
    letterSpacing: '0.3px', textTransform: 'uppercase',
  };
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

// Status pill colors for My Requests, per the design.
const NEED_STATUS = {
  OPEN:      { label: 'Looking for Help', color: 'var(--ink-slate)', bg: '#F2F4F7' },
  ASSIGNED:  { label: 'Helper Found',     color: 'var(--blue-deep)', bg: '#E6F2FA' },
  COMPLETED: { label: 'Completed',        color: '#5E8E72', bg: '#EEF6F0' },
  CANCELLED: { label: 'Cancelled',        color: 'var(--ink-3)', bg: '#f3f4f6' },
};

// Tab icons match the design's leading glyphs.
function TabIcon({ id, active }) {
  const color = active ? '#fff' : '#5a6470';
  const svgProps = {
    width: 16, height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: '2.1',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    style: { flexShrink: 0 },
  };
  if (id === 'connections') return (
    <svg {...svgProps}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
  if (id === 'discover') return (
    <svg {...svgProps}>
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
  if (id === 'needs' || id === 'browse') return (
    <svg {...svgProps}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  );
  return null;
}

const focusIn = (e) => { e.target.style.borderColor = '#4FA3CE'; e.target.style.boxShadow = '0 0 0 3px rgba(79,163,206,0.15)'; };
const focusOut = (e) => { e.target.style.borderColor = '#d8dce2'; e.target.style.boxShadow = 'none'; };

export default function ElderDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const seenConn = useSeenIds(user?.userId, 'connections');
  const seenApplicants = useSeenIds(user?.userId, 'applicants');
  const [profile, setProfile] = useState(null);
  const [connections, setConnections] = useState([]);
  const [myNeeds, setMyNeeds] = useState([]);
  // Which tab/section is open lives in the URL (?tab=…&hseg=…&nseg=…) so a full
  // page refresh restores the view the user was on instead of snapping back to
  // the default. replace:true keeps tab switches out of the back-button history.
  const [searchParams, setSearchParams] = useSearchParams();
  const setParam = (key, value) => setSearchParams(prev => {
    const next = new URLSearchParams(prev);
    if (value == null) next.delete(key); else next.set(key, value);
    return next;
  }, { replace: true });
  const tab = searchParams.get('tab') || 'connections';
  // Switching tabs resets the sub-section, so each tab opens on its own default
  // (My Helpers → Active) instead of carrying over a segment picked in another
  // tab. A refresh keeps the current section because it reloads the URL as-is
  // rather than going through this handler.
  const setTab = (next) => setSearchParams(prev => {
    const p = new URLSearchParams(prev);
    p.set('tab', next);
    p.delete('hseg');
    p.delete('nseg');
    return p;
  }, { replace: true });
  // Sub-filter segment per tab. Param absent (null) = follow the smart default
  // (the segment that needs the user's action first); a value = user picked one.
  const needsSeg = searchParams.get('nseg');
  const setNeedsSeg = (next) => setParam('nseg', next);
  const helpersSeg = searchParams.get('hseg');
  const setHelpersSeg = (next) => setParam('hseg', next);
  const [needForm, setNeedForm] = useState({ title: '', description: '', category: 'COMPANIONSHIP', urgency: 'NORMAL', categoryOther: '' });
  const [posting, setPosting] = useState(false);
  const [postMsg, setPostMsg] = useState('');
  const [accepting, setAccepting] = useState(null);
  const [showPostForm, setShowPostForm] = useState(false);
  const [endingConn, setEndingConn] = useState(null);
  const [respondingConn, setRespondingConn] = useState(null);
  const [confirmingTrust, setConfirmingTrust] = useState(null);
  const [reviewingNeed, setReviewingNeed] = useState(null);
  const [reviewingConn, setReviewingConn] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, tags: [], comment: '', safetyConcern: false });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewedNeeds, setReviewedNeeds] = useState(new Set());
  const [reviewedConns, setReviewedConns] = useState(new Set());
  const [location, setLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('idle');
  const [loading, setLoading] = useState(true);
  const [cancelConfirm, setCancelConfirm] = useState(null);
  const [helpers, setHelpers] = useState([]);
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState(false);
  const [radiusKm, setRadiusKm] = useState(25);
  const [connectingTo, setConnectingTo] = useState(null);
  const [connectMsg, setConnectMsg] = useState({});

  async function loadConnections() {
    setLoading(true);
    try { const r = await api.get('/connections'); setConnections(r.data); } catch {}
    finally { setLoading(false); }
  }
  async function loadNeeds() {
    setLoading(true);
    try { const res = await api.get('/needs/mine'); setMyNeeds(res.data.content ?? []); } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => {
    api.get('/profile/me').then(r => setProfile(r.data)).catch(() => {});
    loadConnections();
    loadNeeds();
    initLocation();
  }, []);

  useEffect(() => {
    if (tab === 'needs') loadNeeds();
    if (tab === 'connections') loadConnections();
    if (tab === 'discover') loadHelpers();
  }, [tab, radiusKm]);

  // The "Post Request" button in the top nav lands here with ?post=1 — open the
  // form, then strip the flag so a refresh doesn't force it back open.
  useEffect(() => {
    if (searchParams.get('post') === '1') {
      setShowPostForm(true);
      setParam('post', null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function loadHelpers(loc) {
    const coords = loc ?? location;
    setDiscovering(true);
    setDiscoverError(false);
    try {
      const res = coords
        ? await api.get(`/discover/helpers?lat=${coords.lat}&lng=${coords.lng}&radiusKm=${radiusKm}`)
        : await api.get('/discover/helpers');
      setHelpers(res.data || []);
    } catch {
      setDiscoverError(true);
    } finally {
      setDiscovering(false);
    }
  }

  async function connectToHelper(helperId) {
    setConnectingTo(helperId);
    try {
      await api.post('/connections/request', { targetUserId: helperId });
      setConnectMsg(prev => ({ ...prev, [helperId]: 'Request sent!' }));
      await loadConnections();
    } catch (err) {
      setConnectMsg(prev => ({ ...prev, [helperId]: err?.response?.data?.message || 'Could not connect.' }));
    } finally { setConnectingTo(null); }
  }

  async function endConnection(connId) {
    try {
      await api.delete(`/connections/${connId}`);
      toast.info('Connection ended.');
      await loadConnections();
    } catch (err) { toast.error(err?.response?.data?.message || 'Could not end connection.'); }
  }

  // Bumble-style: don't fire the OS popup cold. If permission was already
  // granted, get location silently. If not yet decided, show our primer first
  // so the user taps "Enable location" to trigger the real popup. If blocked,
  // fall back to the type-your-town box.
  function initLocation() {
    if (!navigator.geolocation) { setLocationStatus('denied'); loadHelpers(); return; }
    if (!navigator.permissions?.query) { setLocationStatus('primer'); return; }
    navigator.permissions.query({ name: 'geolocation' }).then(p => {
      if (p.state === 'granted') requestLocation();
      else if (p.state === 'denied') { setLocationStatus('denied'); loadHelpers(); }
      else setLocationStatus('primer');
    }).catch(() => setLocationStatus('primer'));
  }

  function requestLocation() {
    if (!navigator.geolocation) { setLocationStatus('denied'); return; }
    setLocationStatus('asking');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(loc);
        setLocationStatus('granted');
        api.put('/profile/location', { locationLat: loc.lat, locationLng: loc.lng }).catch(() => {});
        loadHelpers(loc);
      },
      () => setLocationStatus('denied'),
      // Don't hang on an unanswered permission prompt — fall back to showing all helpers
      { timeout: 8000, maximumAge: 300000 }
    );
  }

  async function respondToConnection(connId, accept) {
    setRespondingConn(connId);
    try {
      await api.post(`/connections/${connId}/respond`, { accept });
      await loadConnections();
      if (accept) toast.success('Connection accepted!');
    }
    catch (err) { toast.error(err?.response?.data?.message || 'Could not respond to request.'); }
    finally { setRespondingConn(null); }
  }

  async function confirmTrust(connId) {
    setConfirmingTrust(connId);
    try {
      await api.post(`/trust/${connId}/confirm`);
      await loadConnections();
      toast.success('Trust level confirmed!');
    }
    catch { toast.error('Could not advance trust level. Try again.'); }
    finally { setConfirmingTrust(null); }
  }

  async function postNeed(e) {
    e.preventDefault(); setPosting(true); setPostMsg('');
    try {
      const { categoryOther, ...rest } = needForm;
      const body = { ...rest };
      if (needForm.category === 'OTHER') {
        const detail = categoryOther.trim();
        body.description = body.description ? `Kind of help: ${detail}\n\n${body.description}` : `Kind of help: ${detail}`;
      }
      if (location) { body.locationLat = location.lat; body.locationLng = location.lng; }
      await api.post('/needs', body);
      setNeedForm({ title: '', description: '', category: 'COMPANIONSHIP', urgency: 'NORMAL', categoryOther: '' });
      setPostMsg('Request posted!'); await loadNeeds(); setShowPostForm(false); setTab('needs');
    } catch (err) { setPostMsg(err?.response?.data?.message || 'Failed to post.'); }
    finally { setPosting(false); }
  }

  async function completeNeed(needId) {
    try {
      await api.post(`/needs/${needId}/complete`);
      await loadNeeds();
      toast.success('Marked as complete!');
    }
    catch { toast.error('Could not mark as complete. Try again.'); }
  }

  async function cancelNeed(needId) {
    try {
      await api.delete(`/needs/${needId}`);
      await loadNeeds();
      toast.success('Request cancelled.');
    }
    catch { toast.error('Could not cancel. Try again.'); }
  }

  async function acceptHelper(needId, helperId) {
    setAccepting(`${needId}-${helperId}`);
    try {
      await api.post(`/needs/${needId}/accept/${helperId}`);
      await Promise.all([loadNeeds(), loadConnections()]);
      toast.success('Helper accepted!');
    }
    catch { toast.error('Could not accept helper. Try again.'); }
    finally { setAccepting(null); }
  }

  const REVIEW_TAGS = ['Friendly', 'Punctual', 'Respectful', 'Helpful', 'Patient'];

  function toggleTag(tag) {
    setReviewForm(f => ({ ...f, tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag] }));
  }

  async function submitHelperReview(conn) {
    setSubmittingReview(true);
    try {
      await api.post('/reviews', { revieweeId: conn.otherUserId, ...reviewForm, comment: reviewForm.comment || null });
      setReviewedConns(prev => new Set([...prev, conn.id]));
      setReviewingConn(null);
      setReviewForm({ rating: 5, tags: [], comment: '', safetyConcern: false });
      toast.success('Review submitted! Thank you.');
    } catch (err) { toast.error(err?.response?.data?.message || 'Could not submit review.'); }
    finally { setSubmittingReview(false); }
  }

  async function submitReview(need) {
    const accepted = need.applications?.find(a => a.status === 'ACCEPTED');
    if (!accepted) return;
    setSubmittingReview(true);
    try {
      await api.post('/reviews', { revieweeId: accepted.helperId, needId: need.id, ...reviewForm });
      setReviewedNeeds(prev => new Set([...prev, need.id]));
      setReviewingNeed(null);
      setReviewForm({ rating: 5, tags: [], comment: '', safetyConcern: false });
      toast.success('Review submitted! Thank you.');
    } catch (err) { toast.error(err?.response?.data?.message || 'Could not submit review.'); }
    finally { setSubmittingReview(false); }
  }

  const TRUST_LABELS = { DISCOVERED: 'Just Connected', MESSAGING: 'Messaging', PHONE_CALL: 'Phone Ready', VIDEO_CALL: 'Video Ready', VERIFIED: 'Verified', FIRST_MEET: 'Ready to Meet', TRUSTED: 'Fully Trusted' };
  const trustLabel = (l) => TRUST_LABELS[l] || l;
  // Only ACTIVE connections count as "Connected" — a pending request must not
  // show the Connected badge in Discover.
  const connectedHelperIds = new Set(connections.filter(c => c.status === 'ACTIVE').map(c => c.otherUserId));

  const connTokens = connections.map(c => `${c.id}:${c.status}`);
  const applicantTokens = myNeeds.flatMap(n => (n.applications || []).map(a => `${n.id}:${a.helperId}`));
  const connBadge = seenConn.unseenCount(connTokens);
  const requestsBadge = seenApplicants.unseenCount(applicantTokens);

  useEffect(() => {
    if (tab === 'connections') seenConn.markSeen(connTokens);
    if (tab === 'needs') seenApplicants.markSeen(applicantTokens);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, connections, myNeeds]);

  const tabs = [
    ['connections', 'My Helpers', connBadge],
    ['needs', 'My Requests', requestsBadge],
    ['discover', 'Find New Helper', 0],
  ];

  // ── My Helpers — classify connections by trust state ──
  const helperCounts = {
    active:   connections.filter(c => c.status === 'ACTIVE' && c.currentTrustLevel === 'TRUSTED').length,
    building: connections.filter(c => c.status === 'ACTIVE' && c.currentTrustLevel !== 'TRUSTED').length,
    requests: connections.filter(c => c.status === 'PENDING').length,
  };
  // Always open on the Active section. Pending requests still appear in the
  // New Invites tab with their own count, so nothing is hidden — Active is simply
  // what the dashboard lands on. A section the user explicitly picks wins via
  // the URL (?hseg=…) and survives a refresh.
  const helpersDefault = 'active';
  const activeHelpersSeg = helpersSeg ?? helpersDefault;
  const helperSegments = [
    { id: 'active',   label: 'Active',         count: helperCounts.active },
    { id: 'building', label: 'Building Trust', count: helperCounts.building },
    { id: 'requests', label: 'New Invites',     count: helperCounts.requests, notify: true },
  ];
  const visibleConnections = [...connections].filter(c => {
    if (activeHelpersSeg === 'active')   return c.status === 'ACTIVE' && c.currentTrustLevel === 'TRUSTED';
    if (activeHelpersSeg === 'building') return c.status === 'ACTIVE' && c.currentTrustLevel !== 'TRUSTED';
    return c.status === 'PENDING';
  }).sort(sortConnections);
  const helpersEmptyText = {
    active:   <>No fully trusted helpers yet. As your trust grows with a helper, they'll appear here.</>,
    building: <>No connections in progress. Connect with a helper to start building trust together.</>,
    requests: <>No new invites right now. New connection invites will show up here.</>,
  }[activeHelpersSeg];

  // ── My Requests — classify needs by status ──
  const needCounts = {
    OPEN:      myNeeds.filter(n => n.status === 'OPEN').length,
    ASSIGNED:  myNeeds.filter(n => n.status === 'ASSIGNED').length,
    COMPLETED: myNeeds.filter(n => n.status === 'COMPLETED').length,
  };
  const needsDefault = needCounts.OPEN > 0 ? 'OPEN' : needCounts.ASSIGNED > 0 ? 'ASSIGNED' : 'COMPLETED';
  const activeNeedsSeg = needsSeg ?? needsDefault;
  const needsSegments = [
    { id: 'OPEN',      label: 'Pending Request',  count: needCounts.OPEN, notify: true },
    { id: 'ASSIGNED',  label: 'In Progress',     count: needCounts.ASSIGNED },
    { id: 'COMPLETED', label: 'Completed',       count: needCounts.COMPLETED },
  ];
  const visibleNeeds = [...myNeeds].filter(n => n.status === activeNeedsSeg).sort(sortNeeds);
  const needsEmptyText = {
    OPEN:      'No open requests right now. Post a new request and helpers nearby will offer to help.',
    ASSIGNED:  'Nothing in progress yet. Once you choose a helper, the request shows here to mark complete.',
    COMPLETED: 'No finished requests yet. Completed help shows here so you can leave a review.',
  }[activeNeedsSeg];

  return (
    <div style={{ minHeight: '100svh', background: 'var(--surface-pearl)', fontFamily: "-apple-system, 'SF Pro Text', system-ui, sans-serif" }}>
      <NavBar />

      {/* ── Sticky tab bar — frosted "liquid glass" so page content blurs
            softly beneath it as you scroll (Apple-style translucent chrome) ── */}
      <div style={{
        position: 'sticky', top: '60px', zIndex: 50,
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: '1px solid #ececef',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
        <div className="dash-tab-wrap">
          <div className="dash-tab-scroll">
            {tabs.map(([id, label, badge]) => {
              const active = tab === id && !showPostForm;
              return (
                <DashTab key={id} active={active} onClick={() => { setShowPostForm(false); setTab(id); }}>
                  <TabIcon id={id} active={active} />
                  {label}
                  <TabBadge count={badge} />
                </DashTab>
              );
            })}

          </div>
        </div>
      </div>

      <div className="dash-content">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <PeekabooCard />

          {/* My Helpers tab (landing) */}
          {!showPostForm && tab === 'connections' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <style>{`@keyframes shimmer { 0%,100% { opacity:0.6 } 50% { opacity:1 } }`}</style>
              <h2 style={{ fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif", fontSize: 'var(--text-lg)', fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--ink)', margin: '8px 0 0' }}>
                My Helpers
              </h2>
              {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[1,2].map(i => (
                    <div key={i} style={{ background: 'var(--surface)', borderRadius: '18px', height: '80px', animation: 'shimmer 1.5s ease-in-out infinite' }} />
                  ))}
                </div>
              )}
              {!loading && connections.length === 0 && (
                <div style={{ background: '#ffffff', borderRadius: '18px', textAlign: 'center', padding: '48px 24px', border: '1px solid #e0e0e0' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--surface)', border: '1px solid #BFD9EA', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4FA3CE" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  </div>
                  <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>No helpers yet</p>
                  <p style={{ fontSize: '16px', color: 'var(--ink-3)', marginBottom: '20px' }}>Helpers in your area will send you connection requests. You'll see them here.</p>
                </div>
              )}
              {!loading && connections.length > 0 && (
                <SegmentedTabs segments={helperSegments} value={activeHelpersSeg} onChange={setHelpersSeg} />
              )}
              {!loading && connections.length > 0 && visibleConnections.length === 0 && (
                <SegmentEmpty icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4FA3CE" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}>
                  {helpersEmptyText}
                </SegmentEmpty>
              )}
              {!loading && visibleConnections.map((conn, i) => {
                const isIncoming = conn.status === 'PENDING' && !conn.initiatedByMe;
                const avatar = (
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '50%',
                    background: 'var(--slate-tint)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '17px', fontWeight: 700, color: 'var(--ink-slate)', flexShrink: 0,
                  }}>
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
                            <p style={{ fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--ink)', margin: 0 }}>{conn.otherUserName || 'User'}</p>
                            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-slate)', margin: '4px 0 0' }}>wants to connect with you</p>
                            {conn.requestMessage && (
                              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-slate)', fontStyle: 'italic', margin: '6px 0 0' }}>"{conn.requestMessage}"</p>
                            )}
                          </div>
                        </div>
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--blue-deep)', background: 'var(--blue-tint)', padding: '5px 12px', borderRadius: '9999px', letterSpacing: '0.3px', textTransform: 'uppercase' }}>New Request</span>
                      </div>
                      <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                        <button onClick={() => respondToConnection(conn.id, true)} disabled={respondingConn === conn.id}
                          style={{ flex: 1, height: '44px', background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>Accept</button>
                        <button onClick={() => respondToConnection(conn.id, false)} disabled={respondingConn === conn.id}
                          style={{ flex: 1, height: '44px', background: '#fff', color: 'var(--ink-slate)', border: '1px solid #e0e0e0', borderRadius: '10px', fontSize: '16px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>Decline</button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Identity row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        {avatar}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <p style={{ fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--ink)', margin: 0 }}>{conn.otherUserName || 'User'}</p>
                            {conn.status !== 'ACTIVE' ? (
                              <span style={{ display: 'inline-block', ...statusStyle('PENDING') }}>Request Sent</span>
                            ) : conn.currentTrustLevel !== 'TRUSTED' && (
                              // In-progress stages show a blue pill; "Fully Trusted" is omitted
                              // here since it's already shown in the trust-ladder card below.
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#E6F2FA', padding: '3px 10px', borderRadius: '9999px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2E7DA6' }} />
                                <span style={{ fontSize: '14px', fontWeight: 700, color: '#2E7DA6' }}>{trustLabel(conn.currentTrustLevel)}</span>
                              </div>
                            )}
                          </div>
                          {conn.status === 'ACTIVE' && conn.otherUserPhone && (
                            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-slate-dark)', margin: '6px 0 0', display: 'flex', alignItems: 'center', gap: '7px' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5a6470" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                              {conn.otherUserPhone}
                            </p>
                          )}
                          {conn.requestMessage && conn.status !== 'ACTIVE' && (
                            <p style={{ fontSize: '14px', color: 'var(--ink-4)', fontStyle: 'italic', margin: '6px 0 0' }}>"{conn.requestMessage}"</p>
                          )}
                        </div>
                      </div>

                      {/* Action bar */}
                      {conn.status === 'ACTIVE' && (
                        endingConn === conn.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-slate)', flex: 1, minWidth: '160px' }}>End your connection with {conn.otherUserName || 'this helper'}?</span>
                            <button onClick={() => { setEndingConn(null); endConnection(conn.id); }} style={{ height: '36px', padding: '0 16px', background: 'var(--red-deep)', color: '#fff', border: 'none', borderRadius: '9999px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Yes, end</button>
                            <button onClick={() => setEndingConn(null)} style={{ height: '36px', padding: '0 16px', background: '#fff', color: 'var(--ink-slate)', border: '1px solid #e0e0e0', borderRadius: '9999px', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}>Keep</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
                            <button onClick={() => navigate(`/messages/${conn.id}`)} style={{ height: '36px', padding: '0 18px', background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: '9999px', fontSize: 'var(--text-sm)', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                              Message
                            </button>
                            <button onClick={() => navigate(`/user/${conn.otherUserId}`)} style={{ height: '36px', padding: '0 14px', background: '#fff', color: 'var(--blue)', border: '1px solid #BFD9EA', borderRadius: '9999px', fontSize: '14px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>View Profile</button>
                            {conn.currentTrustLevel === 'TRUSTED' && !reviewedConns.has(conn.id) && (
                              <button onClick={() => setReviewingConn(reviewingConn === conn.id ? null : conn.id)} style={{ height: '36px', padding: '0 14px', background: '#fff', color: 'var(--blue)', border: '1px solid #BFD9EA', borderRadius: '9999px', fontSize: '14px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="#F4C95E" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                                Review
                              </button>
                            )}
                            {reviewedConns.has(conn.id) && (
                              <span style={{ height: '36px', padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: 'var(--green-deep)', fontWeight: 600 }}>
                                <svg width="13" height="10" viewBox="0 0 11 9" fill="none"><path d="M1 4.5L3.8 7.5L10 1" stroke="#1a5c2e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                Reviewed
                              </span>
                            )}
                            <button onClick={() => setEndingConn(conn.id)} style={{ marginLeft: 'auto', height: '36px', padding: '0 14px', background: 'var(--red-tint)', color: '#CF6A66', border: '1px solid #F3CDCD', borderRadius: '9999px', fontSize: '14px', fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}>End</button>
                          </div>
                        )
                      )}
                    </>
                  )}

                  {/* Trust Journey — only on active connections */}
                  {conn.status === 'ACTIVE' && (
                    <TrustJourney
                      currentTrustLevel={conn.currentTrustLevel}
                      confirmedByMe={conn.confirmedByMe}
                      confirmedByOther={conn.confirmedByOther}
                      otherUserName={conn.otherUserName || 'them'}
                      isElder={true}
                      onConfirm={() => confirmTrust(conn.id)}
                      confirming={confirmingTrust === conn.id}
                    />
                  )}

                  {/* Review form for helper */}
                  {reviewingConn === conn.id && (
                    <div style={{ marginTop: '14px', padding: '16px', background: 'var(--surface-pearl)', borderRadius: '12px', border: '1px solid #e8e8ed' }}>
                      <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink)', marginBottom: '12px' }}>Rate{conn.otherUserName}</p>
                      <div style={{ marginBottom: '12px' }}>
                        <StarPicker value={reviewForm.rating} onChange={r => setReviewForm(f => ({...f, rating: r}))} />
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                        {['Punctual','Kind','Trustworthy','Patient','Helpful'].map(tag => (
                          <button key={tag} type="button" onClick={() => toggleTag(tag)} style={{
                            fontSize: 'var(--text-xs)', padding: '4px 12px', borderRadius: '9999px', cursor: 'pointer',
                            border: '1px solid', transition: 'all 0.15s',
                            borderColor: reviewForm.tags.includes(tag) ? '#4FA3CE' : '#d2d2d7',
                            background: reviewForm.tags.includes(tag) ? '#4FA3CE' : '#fff',
                            color: reviewForm.tags.includes(tag) ? '#fff' : '#7a7a7a',
                          }}>{tag}</button>
                        ))}
                      </div>
                      <textarea value={reviewForm.comment} onChange={e => setReviewForm(f => ({...f, comment: e.target.value}))}
                        placeholder="Share your experience (optional)" rows={2}
                        style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #e0e0e0', fontSize: 'var(--text-sm)', resize: 'none', boxSizing: 'border-box', marginBottom: '10px' }} />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => submitHelperReview(conn)} disabled={submittingReview} className="btn-primary" style={{ flex: 1, padding: '10px' }}>
                          {submittingReview ? 'Submitting…' : 'Submit Review'}
                        </button>
                        <button onClick={() => setReviewingConn(null)} className="btn-ghost" style={{ padding: '10px 16px' }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}

          {/* Find Helpers tab */}
          {!showPostForm && tab === 'discover' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <h2 style={{ fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif", fontSize: 'var(--text-lg)', fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--ink)', margin: '0 0 6px' }}>
                  Find a New Helper
                </h2>
                <p style={{ fontSize: '16px', color: 'var(--ink-slate)', margin: 0 }}>
                  Browse helpers near you and reach out to connect.
                </p>
              </div>

              {/* Radius bar */}
              <div style={{ background: '#ffffff', borderRadius: '14px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', border: '1px solid #e0e0e0' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-sm)', color: 'var(--ink-slate-dark)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4FA3CE" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {locationStatus === 'asking' && 'Getting your location…'}
                  {locationStatus === 'granted' && `Showing helpers within ${radiusKm} km of you`}
                  {locationStatus === 'denied' && 'Location unavailable, showing all helpers'}
                  {locationStatus === 'idle' && 'Detecting location…'}
                </span>
                {locationStatus === 'granted' && (
                  <select value={radiusKm} onChange={e => setRadiusKm(Number(e.target.value))}
                    style={{ fontSize: '14px', fontWeight: 600, color: 'var(--blue)', background: 'var(--blue-wash)', border: '1px solid #BFD9EA', borderRadius: '9999px', padding: '6px 12px', outline: 'none', cursor: 'pointer' }}>
                    {[5, 10, 25, 50, 100].map(v => <option key={v} value={v}>{v} km</option>)}
                  </select>
                )}
              </div>

              {locationStatus === 'primer' && (
                <LocationPrimer
                  onEnable={requestLocation}
                  onManual={() => { setLocationStatus('denied'); loadHelpers(); }}
                />
              )}

              {locationStatus === 'denied' && (
                <LocationPrompt onResolved={(loc) => {
                  const coords = { lat: loc.lat, lng: loc.lng };
                  setLocation(coords);
                  setLocationStatus('granted');
                  loadHelpers(coords);
                }} />
              )}

              {/* Searching — let people know we're looking, never a blank flash (H1) */}
              {discovering && helpers.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {[1,2].map(i => (
                    <div key={i} style={{ background: 'var(--surface)', borderRadius: '18px', height: '110px', animation: 'shimmer 1.5s ease-in-out infinite' }} />
                  ))}
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)', textAlign: 'center', margin: 0 }}>Looking for helpers near you…</p>
                </div>
              )}

              {/* Fetch failed — tell the truth and offer a way out (H9) */}
              {!discovering && discoverError && (
                <div style={{ background: '#fff', borderRadius: '18px', border: '1px solid #fecaca', padding: '40px 24px', textAlign: 'center' }}>
                  <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>Couldn't load helpers</p>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)', marginBottom: '18px' }}>Something went wrong on our side. Please try again.</p>
                  <button onClick={() => loadHelpers()} className="btn-primary" style={{ padding: '10px 24px', fontSize: 'var(--text-sm)' }}>
                    Try Again
                  </button>
                </div>
              )}

              {!discovering && !discoverError && helpers.length === 0 && locationStatus !== 'primer' && (
                <div style={{ background: '#fff', borderRadius: '18px', border: '1px solid #e0e0e0', padding: '48px 24px', textAlign: 'center' }}>
                  <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
                    {locationStatus === 'granted' ? 'No helpers found nearby' : 'No helpers available right now'}
                  </p>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)' }}>
                    {locationStatus === 'granted'
                      ? 'Try a larger radius above, or check back later.'
                      : 'New helpers join often. Please check back soon.'}
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {helpers.map((helper, i) => {
                const alreadyConnected = connectedHelperIds.has(helper.userId);
                const sent = connectMsg[helper.userId];
                return (
                  <div key={helper.userId} style={{
                    background: '#ffffff', borderRadius: '18px', padding: '20px',
                    border: '1px solid #e0e0e0',
                    animation: `fadeSlideUp 0.4s ease ${i * 0.05}s both`,
                  }}>
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                      <div style={{
                        width: '50px', height: '50px', borderRadius: '50%',
                        background: 'var(--slate-tint)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '17px', fontWeight: 700, color: 'var(--ink-slate)', flexShrink: 0,
                      }}>
                        {initials(helper.name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <p style={{ fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--ink)', margin: 0 }}>{helper.name || 'Helper'}</p>
                          {(helper.trustScore != null || helper.trustTier) && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'var(--slate-tint)', padding: '3px 10px', borderRadius: '9999px', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--ink-slate)' }}>
                              ★ {helper.trustScore ?? '—'}{helper.trustTier ? ` · ${helper.trustTier}` : ''}
                            </span>
                          )}
                        </div>
                        {(helper.city || helper.distanceKm > 0) && (
                          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-slate)', margin: '4px 0 0' }}>
                            {helper.city}{helper.city && helper.distanceKm > 0 ? ' · ' : ''}{helper.distanceKm > 0 ? `${Math.round(helper.distanceKm * 10) / 10} km away` : ''}
                          </p>
                        )}
                        {helper.bio && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-slate-dark)', margin: '8px 0 0', lineHeight: 1.5 }}>{helper.bio}</p>}
                        {helper.skillsOffered?.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                            {helper.skillsOffered.map(s => (
                              <span key={s} style={{ fontSize: 'var(--text-xs)', fontWeight: 600, background: '#F2F4F7', color: 'var(--ink-slate)', padding: '4px 11px', borderRadius: '9999px' }}>{s}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'stretch', flexShrink: 0 }}>
                        {alreadyConnected ? (
                          <span style={{ fontSize: 'var(--text-xs)', background: 'var(--blue-tint)', color: 'var(--blue-deep)', padding: '9px 18px', borderRadius: '9999px', fontWeight: 700, textAlign: 'center' }}>Connected</span>
                        ) : sent ? (
                          <span style={{
                            fontSize: 'var(--text-xs)', padding: '9px 18px', borderRadius: '9999px', fontWeight: 600, textAlign: 'center',
                            background: sent.includes('!') ? '#E6F2FA' : '#f3f4f6',
                            color: sent.includes('!') ? '#2E7DA6' : '#5a6470',
                          }}>{sent}</span>
                        ) : (
                          <button onClick={() => connectToHelper(helper.userId)} disabled={connectingTo === helper.userId}
                            style={{ height: '40px', padding: '0 22px', background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: '9999px', fontSize: 'var(--text-sm)', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                            {connectingTo === helper.userId ? '…' : 'Connect'}
                          </button>
                        )}
                        <button onClick={() => navigate(`/user/${helper.userId}`)}
                          style={{ height: '36px', padding: '0 14px', background: '#fff', color: 'var(--blue)', border: '1px solid #BFD9EA', borderRadius: '9999px', fontSize: '14px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
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

          {/* My Requests tab */}
          {!showPostForm && tab === 'needs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <h2 style={{ fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif", fontSize: 'var(--text-lg)', fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--ink)', margin: 0 }}>
                  My Help Requests
                </h2>
              </div>
              {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[1,2].map(i => (
                    <div key={i} style={{ background: 'var(--surface)', borderRadius: '18px', height: '80px', animation: 'shimmer 1.5s ease-in-out infinite' }} />
                  ))}
                </div>
              )}
              {!loading && myNeeds.length === 0 && (
                <div style={{ background: '#ffffff', borderRadius: '18px', textAlign: 'center', padding: '48px 24px', border: '1px solid #e0e0e0' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--surface)', border: '1px solid #BFD9EA', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4FA3CE" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
                  </div>
                  <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>No requests yet</p>
                  <p style={{ fontSize: '16px', color: 'var(--ink-3)', marginBottom: '20px' }}>Post a request and helpers near you will offer to assist. It only takes a minute.</p>
                  <button onClick={() => setShowPostForm(true)} className="btn-primary" style={{ padding: '10px 24px', fontSize: 'var(--text-sm)' }}>
                    Post a Request
                  </button>
                </div>
              )}
              {!loading && myNeeds.length > 0 && (
                <SegmentedTabs segments={needsSegments} value={activeNeedsSeg} onChange={setNeedsSeg} />
              )}
              {!loading && myNeeds.length > 0 && visibleNeeds.length === 0 && (
                <SegmentEmpty icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4FA3CE" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}>
                  {needsEmptyText}
                </SegmentEmpty>
              )}
              {!loading && visibleNeeds.map((need, i) => {
                const ns = NEED_STATUS[need.status] || NEED_STATUS.OPEN;
                const acceptedApp = need.applications?.find(a => a.status === 'ACCEPTED');
                return (
                <div key={need.id} style={{
                  background: '#ffffff', borderRadius: '18px', padding: '20px',
                  border: '1px solid #e0e0e0',
                  animation: `fadeSlideUp 0.4s ease ${i * 0.06}s both`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: '16px', color: 'var(--ink)', margin: 0, lineHeight: 1.3 }}>{need.title}</p>
                      {need.description && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-slate-dark)', margin: '10px 0 0', lineHeight: 1.5 }}>{need.description}</p>}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '12px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, background: '#F2F4F7', color: 'var(--ink-slate)', padding: '4px 11px', borderRadius: '9999px' }}>{catLabel(need.category)}</span>
                        {need.urgency === 'URGENT' && (
                          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, background: '#EEF1F4', color: 'var(--ink-slate-dark)', padding: '4px 11px', borderRadius: '9999px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--red)' }} />Urgent
                          </span>
                        )}
                      </div>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: ns.color, background: ns.bg, padding: '5px 11px', borderRadius: '9999px', letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap', flexShrink: 0 }}>{ns.label}</span>
                  </div>

                  {need.status === 'OPEN' && need.applications?.length > 0 && (
                    <div style={{ borderTop: '1px solid #f0f0f0', marginTop: '14px', paddingTop: '14px' }}>
                      <p style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--ink-slate)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 10px' }}>
                        {need.applications.length} helper{need.applications.length !== 1 ? 's' : ''} want to help
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {need.applications.map(app => (
                          <div key={app.helperId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: 'var(--surface-pearl)', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--slate-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--ink-slate)', flexShrink: 0 }}>{initials(app.helperName)}</div>
                              <div style={{ minWidth: 0 }}>
                                <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>{app.helperName}</p>
                                {app.message && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-slate)', margin: '2px 0 0' }}>{app.message}</p>}
                              </div>
                            </div>
                            <button onClick={() => acceptHelper(need.id, app.helperId)} disabled={accepting === `${need.id}-${app.helperId}`}
                              style={{ height: '38px', padding: '0 18px', background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: '9999px', fontSize: 'var(--text-sm)', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}>
                              {accepting === `${need.id}-${app.helperId}` ? '...' : 'Accept'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {need.status === 'OPEN' && (!need.applications || need.applications.length === 0) && (
                    <div style={{ borderTop: '1px solid #f0f0f0', marginTop: '12px', paddingTop: '12px' }}>
                      {cancelConfirm === need.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #fee2e2', paddingTop: '10px', marginTop: '0', background: 'var(--red-tint)', borderRadius: '10px', padding: '10px 12px' }}>
                          <span style={{ fontSize: '14px', color: 'var(--ink-slate)', flex: 1 }}>Cancel this request?</span>
                          <button onClick={() => { cancelNeed(need.id); setCancelConfirm(null); }} style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: '#fff', background: 'var(--ink-slate)', border: 'none', borderRadius: '9999px', padding: '5px 14px', cursor: 'pointer' }}>Yes, cancel</button>
                          <button onClick={() => setCancelConfirm(null)} style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)', background: 'none', border: '1px solid #e0e0e0', borderRadius: '9999px', padding: '5px 12px', cursor: 'pointer' }}>Keep</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <p style={{ fontSize: '14px', color: 'var(--ink-4)', margin: 0 }}>No applicants yet</p>
                          <button onClick={() => setCancelConfirm(need.id)} style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-slate)', background: 'none', border: '1px solid #fecaca', borderRadius: '9999px', padding: '4px 14px', cursor: 'pointer' }}>
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {need.status === 'ASSIGNED' && (
                    <div style={{ borderTop: '1px solid #f0f0f0', marginTop: '14px', paddingTop: '14px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      {acceptedApp && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '180px' }}>
                          <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--slate-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--ink-slate)' }}>{initials(acceptedApp.helperName)}</div>
                          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-slate-dark)' }}><strong style={{ color: 'var(--ink)' }}>{acceptedApp.helperName}</strong> is helping you</span>
                        </div>
                      )}
                      <button onClick={() => completeNeed(need.id)}
                        style={{ height: '42px', padding: '0 22px', background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', marginLeft: acceptedApp ? 0 : 'auto' }}>
                        Mark as Complete
                      </button>
                    </div>
                  )}
                  {need.status === 'COMPLETED' && !reviewedNeeds.has(need.id) && need.applications?.some(a => a.status === 'ACCEPTED') && (
                    <div style={{ borderTop: '1px solid #f0f0f0', marginTop: '14px', paddingTop: '14px' }}>
                      {reviewingNeed === need.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink)' }}>Rate your helper</p>
                          <StarPicker value={reviewForm.rating} onChange={r => setReviewForm(f => ({...f, rating: r}))} />
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {REVIEW_TAGS.map(tag => (
                              <button key={tag} type="button" onClick={() => toggleTag(tag)} style={{
                                fontSize: '14px', padding: '5px 14px', borderRadius: '9999px',
                                border: '1px solid', transition: 'all 0.15s',
                                borderColor: reviewForm.tags.includes(tag) ? '#4FA3CE' : '#d2d2d7',
                                background: reviewForm.tags.includes(tag) ? '#4FA3CE' : '#fff',
                                color: reviewForm.tags.includes(tag) ? '#fff' : '#7a7a7a', cursor: 'pointer',
                              }}>{tag}</button>
                            ))}
                          </div>
                          <textarea value={reviewForm.comment} onChange={e => setReviewForm(f => ({...f, comment: e.target.value}))}
                            placeholder="Add a comment (optional)" rows={2}
                            style={{ width: '100%', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '10px 14px', fontSize: 'var(--text-sm)', outline: 'none', fontFamily: 'inherit', resize: 'vertical' }} />
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--ink-3)', cursor: 'pointer' }}>
                            <input type="checkbox" checked={reviewForm.safetyConcern} onChange={e => setReviewForm(f => ({...f, safetyConcern: e.target.checked}))} />
                            Flag a safety concern
                          </label>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => submitReview(need)} disabled={submittingReview} className="btn-primary" style={{ flex: 1, padding: '10px' }}>
                              {submittingReview ? 'Submitting...' : 'Submit Review'}
                            </button>
                            <button onClick={() => setReviewingNeed(null)} className="btn-ghost">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                          {acceptedApp && <span style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-slate)' }}>Helped by <strong style={{ color: 'var(--ink)' }}>{acceptedApp.helperName}</strong></span>}
                          <button onClick={() => setReviewingNeed(need.id)} style={{ height: '42px', padding: '0 20px', background: '#fff', color: 'var(--blue)', border: '1px solid #BFD9EA', borderRadius: '10px', fontSize: 'var(--text-sm)', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', marginLeft: acceptedApp ? 0 : 'auto' }}>
                            ★ Leave a Review
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {need.status === 'COMPLETED' && reviewedNeeds.has(need.id) && (
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--blue)', fontWeight: 500, borderTop: '1px solid #f0f0f0', marginTop: '14px', paddingTop: '14px' }}>Review submitted</p>
                  )}
                </div>
                );
              })}
            </div>
          )}

          {/* Post Request form — lives inside My Requests */}
          {showPostForm && (
            <div style={{ background: '#ffffff', borderRadius: '18px', padding: '28px', border: '1px solid #e0e0e0' }}>
              <button type="button" onClick={() => setShowPostForm(false)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--blue)', fontSize: 'var(--text-sm)', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', padding: 0, marginBottom: '16px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                Back
              </button>
              <h2 style={{ fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif", fontSize: '24px', fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.4px', margin: '0 0 6px' }}>
                Ask for Help
              </h2>
              <p style={{ fontSize: '16px', color: 'var(--ink-slate)', margin: '0 0 24px' }}>
                Tell us what you need. Helpers near you will offer to assist — it only takes a minute.
              </p>
              <form onSubmit={postNeed} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>What do you need help with?</label>
                  <SmoothInput value={needForm.title} onChange={e => setNeedForm(f => ({...f, title: e.target.value}))}
                    placeholder="e.g. Help with grocery shopping" required
                    style={{ width: '100%', boxSizing: 'border-box', height: '48px', border: '1.5px solid #d8dce2', borderRadius: '12px', padding: '0 16px', fontSize: '16px', fontFamily: 'inherit', color: 'var(--ink)', outline: 'none' }}
                    onFocus={focusIn} onBlur={focusOut} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>Add a few details</label>
                  <textarea value={needForm.description} onChange={e => setNeedForm(f => ({...f, description: e.target.value}))}
                    placeholder="When do you need it, and anything that would help the helper..." rows={4}
                    style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #d8dce2', borderRadius: '12px', padding: '12px 16px', fontSize: '16px', fontFamily: 'inherit', color: 'var(--ink)', outline: 'none', resize: 'vertical', lineHeight: 1.5 }}
                    onFocus={focusIn} onBlur={focusOut} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>What kind of help?</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                    {['COMPANIONSHIP', 'TRANSPORTATION', 'ERRANDS', 'CLEANING', 'OTHER'].map(key => {
                      const selected = needForm.category === key;
                      return (
                        <div key={key} onClick={() => setNeedForm(f => ({ ...f, category: key }))}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${selected ? '#4FA3CE' : '#e0e0e0'}`, background: selected ? '#EAF5FB' : '#fff', borderRadius: '12px', padding: '14px', cursor: 'pointer' }}>
                          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: selected ? '#1d1d1f' : '#3a4450' }}>{catLabel(key)}</span>
                        </div>
                      );
                    })}
                  </div>
                  {needForm.category === 'OTHER' && (
                    <SmoothInput value={needForm.categoryOther} onChange={e => setNeedForm(f => ({ ...f, categoryOther: e.target.value }))}
                      placeholder="Please tell us what kind of help" required autoFocus
                      style={{ width: '100%', boxSizing: 'border-box', height: '48px', border: '1.5px solid #d8dce2', borderRadius: '12px', padding: '0 16px', fontSize: '16px', fontFamily: 'inherit', color: 'var(--ink)', outline: 'none', marginTop: '4px' }}
                      onFocus={focusIn} onBlur={focusOut} />
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>How urgent is it?</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {[['NORMAL', 'Normal'], ['URGENT', 'Urgent']].map(([key, label]) => {
                      const selected = needForm.urgency === key;
                      return (
                        <div key={key} onClick={() => setNeedForm(f => ({ ...f, urgency: key }))}
                          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '9px', border: `2px solid ${selected ? '#4FA3CE' : '#e0e0e0'}`, background: selected ? '#EAF5FB' : '#fff', borderRadius: '12px', padding: '13px 16px', cursor: 'pointer' }}>
                          <span style={{ width: '20px', height: '20px', borderRadius: '50%', border: selected ? '6px solid #4FA3CE' : '2px solid #c8ccd2', background: '#fff', boxSizing: 'border-box', flexShrink: 0 }} />
                          <span style={{ fontSize: 'var(--text-sm)', fontWeight: selected ? 700 : 600, color: selected ? '#1d1d1f' : '#3a4450' }}>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: 'var(--text-sm)', color: 'var(--ink-slate)', padding: '2px 0' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: locationStatus === 'granted' ? '#2E7DA6' : locationStatus === 'denied' ? '#d0d0d5' : '#e0e0e0' }} />
                  {locationStatus === 'asking' && 'Getting your location…'}
                  {locationStatus === 'granted' && 'Location on. Nearby helpers will be matched first.'}
                  {locationStatus === 'denied' && 'Location off. Your request will still reach all helpers.'}
                  {locationStatus === 'idle' && (
                    <button type="button" onClick={requestLocation} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--blue)', padding: 0, fontWeight: 600 }}>
                      Share location to reach nearby helpers first
                    </button>
                  )}
                </div>
                {postMsg && <p style={{ fontSize: 'var(--text-sm)', color: postMsg.includes('!') ? '#2E7DA6' : '#5a6470', fontWeight: 500 }}>{postMsg}</p>}
                <button type="submit" disabled={posting} style={{ height: '50px', background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 3px 12px rgba(79,163,206,0.35)' }}>
                  {posting ? 'Posting...' : 'Post My Request'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
