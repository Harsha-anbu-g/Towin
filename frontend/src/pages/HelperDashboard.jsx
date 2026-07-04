import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';
import NavBar from '../components/NavBar';
import TrustJourney from '../components/TrustJourney';
import SegmentedTabs, { SegmentEmpty } from '../components/SegmentedTabs';
import PeekabooCard from '../components/PeekabooCard';
import BlurFade from '../components/magic/BlurFade';
import LocationPrompt from '../components/LocationPrompt';
import LocationPrimer from '../components/LocationPrimer';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useSeenIds } from '../lib/useSeenIds';
import Avatar from '../components/ui/Avatar';
import { parseServerDate } from '../lib/utils';

function TabBadge({ count }) {
  if (!count) return null;
  return (
    <span style={{
      marginLeft: '8px', verticalAlign: 'middle',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: '22px', height: '22px', padding: '0 7px', boxSizing: 'border-box',
      background: 'var(--ink-slate)', color: '#fff', fontSize: '14px', fontWeight: 600,
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
    ACTIVE:  { bg: '#f5f5f7', color: 'var(--blue)' },
    PENDING: { bg: '#f3f4f6', color: 'var(--ink-slate)' },
    DECLINED: { bg: '#f3f4f6', color: 'var(--ink-slate)' },
  };
  const s = map[status] ?? { bg: '#f3f4f6', color: '#6b7280' };
  return { background: s.bg, color: s.color, fontSize: '12px', fontWeight: 600,
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

// Plain, everyday relative time — "just now", "2 days ago", "3 weeks ago" —
// so a helper can see how fresh (or stale) a request is at a glance.
function postedAgo(iso) {
  const date = parseServerDate(iso);
  if (!date) return '';
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return 'just now';
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} day${d === 1 ? '' : 's'} ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w} week${w === 1 ? '' : 's'} ago`;
  const mo = Math.floor(d / 30);
  return `${mo} month${mo === 1 ? '' : 's'} ago`;
}

// One request card, shared by all three Browse Needs sub-tabs. The action area
// on the right derives entirely from the request's own status + the helper's
// application status, so the same card works in Available / Applied / Completed.
function NeedCard({ need, index, applying, onApply, onWithdraw, onOpenProfile }) {
  const mine = need.myApplicationStatus;                 // null | PENDING | ACCEPTED | REJECTED
  const isCompleted = need.status === 'COMPLETED';
  const greenPill = { height: '40px', display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '0 18px', background: 'var(--green-tint)', color: 'var(--green-deep)', borderRadius: '9999px', fontSize: 'var(--text-sm)', fontWeight: 700 };
  const check = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1a5c2e" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
  return (
    <div style={{
      background: '#ffffff', borderRadius: '18px', padding: '20px',
      border: '1px solid #e0e0e0',
      animation: `fadeSlideUp 0.4s ease ${index * 0.05}s both`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, fontSize: '16px', color: 'var(--ink)', margin: 0, lineHeight: 1.3 }}>{need.title}</p>
          {need.description && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-slate-dark)', margin: '10px 0 0', lineHeight: 1.5 }}>{need.description}</p>}
          <div style={{ display: 'flex', gap: '6px', marginTop: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, background: '#F2F4F7', color: 'var(--ink-slate)', padding: '4px 11px', borderRadius: '9999px' }}>{catLabel(need.category)}</span>
            {need.urgency === 'URGENT' && (
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, background: '#EEF1F4', color: 'var(--ink-slate-dark)', padding: '4px 11px', borderRadius: '9999px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--red)' }} />Urgent
              </span>
            )}
            <span style={{ fontSize: '14px', color: '#8a929c' }}>
              {need.distanceKm != null ? `${Math.round(need.distanceKm * 10) / 10} km · ` : ''}Posted by{' '}
              {need.elderId ? (
                <button onClick={() => onOpenProfile(need.elderId)}
                  style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--blue)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                  {need.elderName}
                </button>
              ) : need.elderName}
              {need.createdAt ? ` · ${postedAgo(need.createdAt)}` : ''}
            </span>
          </div>
        </div>
        <div className="card-actions" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          {isCompleted ? (
            <span style={greenPill}>{check}Completed</span>
          ) : mine === 'ACCEPTED' ? (
            <span style={greenPill}>{check}You're helping</span>
          ) : mine === 'PENDING' ? (
            <>
              <span style={{ height: '40px', display: 'inline-flex', alignItems: 'center', padding: '0 18px', background: '#f3f4f6', color: 'var(--ink-slate)', borderRadius: '9999px', fontSize: 'var(--text-sm)', fontWeight: 700 }}>Waiting to hear back — the elder reviews all helpers and picks one</span>
              <button onClick={() => onWithdraw(need.id)}
                style={{ fontSize: '14px', color: 'var(--ink-slate)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>
                Withdraw
              </button>
            </>
          ) : (
            <button onClick={() => onApply(need.id)} disabled={applying === need.id}
              style={{ height: '40px', padding: '0 24px', background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: '9999px', fontSize: 'var(--text-sm)', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
              {applying === need.id ? '...' : 'Offer to Help'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

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
  if (id === 'browse') return (
    <svg {...svgProps}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  );
  if (id === 'requests') return (
    <svg {...svgProps}>
      <path d="M22 12h-6l-2 3h-4l-2-3H2"/>
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
    </svg>
  );
  return null;
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
  const [myApplications, setMyApplications] = useState([]);
  const [elders, setElders] = useState([]);
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState(false);
  // Which tab/section is open lives in the URL (?tab=…&eseg=…) so a full page
  // refresh restores the view the user was on instead of snapping back to the
  // default. replace:true keeps tab switches out of the back-button history.
  const [searchParams, setSearchParams] = useSearchParams();
  const setParam = (key, value) => setSearchParams(prev => {
    const next = new URLSearchParams(prev);
    if (value == null) next.delete(key); else next.set(key, value);
    return next;
  }, { replace: true });
  const tab = searchParams.get('tab') || 'connections';
  const setTab = (next) => setSearchParams(prev => {
    const p = new URLSearchParams(prev);
    p.set('tab', next);
    p.delete('eseg');
    p.delete('fseg');
    return p;
  }, { replace: true });
  // Sub-filter for My Elders. Param absent (null) = follow the smart default.
  const eldersSeg = searchParams.get('eseg');
  const setEldersSeg = (next) => setParam('eseg', next);
  // Sub-filter for Browse Needs: available | applied | completed.
  const browseSeg = searchParams.get('bseg') || 'available';
  const setBrowseSeg = (next) => setParam('bseg', next);
  // Sub-filter for Add Friends: invites | requested | find.
  const friendsSeg = searchParams.get('fseg') || 'find';
  const setFriendsSeg = (next) => setParam('fseg', next);
  const [applying, setApplying] = useState(null);
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
  async function loadMyApplications() {
    try { const r = await api.get('/needs/applications'); setMyApplications(r.data); } catch {}
  }
  async function loadConnections(silent = false) {
    if (!silent) setLoading(true);
    try { const r = await api.get('/connections'); setConnections(r.data); } catch {}
    finally { if (!silent) setLoading(false); }
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

  // Bumble-style: don't fire the OS popup cold. If permission was already
  // granted, get location silently. If not yet decided, show our primer first.
  // If blocked, fall back to the type-your-town box.
  function initLocation() {
    if (!navigator.geolocation) { setLocationStatus('denied'); loadNeeds(); return; }
    if (!navigator.permissions?.query) { setLocationStatus('primer'); return; }
    navigator.permissions.query({ name: 'geolocation' }).then(p => {
      if (p.state === 'granted') requestLocation();
      else if (p.state === 'denied') { setLocationStatus('denied'); loadNeeds(); }
      else setLocationStatus('primer');
    }).catch(() => setLocationStatus('primer'));
  }

  function requestLocation() {
    if (!navigator.geolocation) { setLocationStatus('denied'); loadNeeds(); return; }
    setLocationStatus('asking');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(loc); setLocationStatus('granted');
        api.put('/profile/location', { locationLat: loc.lat, locationLng: loc.lng }).catch(() => {});
        loadNeeds(loc);
      },
      () => { setLocationStatus('denied'); loadNeeds(); },
      // Don't hang on an unanswered permission prompt — fall back to showing everything
      { timeout: 8000, maximumAge: 300000 }
    );
  }

  useEffect(() => {
    api.get('/profile/me').then(r => setProfile(r.data)).catch(() => {});
    loadConnections();
    initLocation();
  }, []);

  useEffect(() => {
    if (tab === 'browse') { loadNeeds(); loadMyApplications(); }
    if (tab === 'connections') loadConnections();
    if (tab === 'requests') { loadConnections(); loadElders(); }
  }, [tab, radiusKm]);

  // Refetch when the window regains focus, so actions taken in another tab
  // (e.g. an elder posting a request) show up without a manual refresh.
  // Silent: swapping the lists for a spinner on every focus would be jarring.
  // Re-registered on location/radius change so loadNeeds sees fresh coords.
  useEffect(() => {
    const onFocus = () => { loadNeeds(); loadMyApplications(); loadConnections(true); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [location, radiusKm]);

  async function withdrawApplication(needId) {
    try {
      await api.delete(`/needs/${needId}/apply`);
      await Promise.all([loadNeeds(), loadMyApplications()]);
      toast.info('Application withdrawn.');
    } catch { toast.error('Could not withdraw. Try again.'); }
  }

  async function apply(needId) {
    setApplying(needId);
    try {
      await api.post(`/needs/${needId}/apply`);
      toast.success('Application sent!');
      await Promise.all([loadNeeds(), loadMyApplications()]);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not apply.');
    } finally { setApplying(null); }
  }

  async function connectToElder(elderId) {
    setConnectingTo(elderId);
    try {
      await api.post('/connections/request', { targetUserId: elderId });
      setConnectMsg(prev => ({...prev, [elderId]: 'Requested'}));
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

  // Pending connection requests, split for the dedicated Requests tab:
  //   incoming = invites this helper needs to answer (Accept / Decline)
  //   sent     = requests this helper made, waiting on the elder
  const incomingRequests = connections.filter(c => c.status === 'PENDING' && !c.initiatedByMe);
  const sentRequests = connections.filter(c => c.status === 'PENDING' && c.initiatedByMe);
  const requestsBadge = incomingRequests.length;
  // Elders this helper has already sent a friend request to — show "Requested"
  // (grey) on their Find New Elders card even after a page reload.
  const requestedElderIds = new Set(sentRequests.map(c => c.otherUserId));
  const friendsSegments = [
    { id: 'find',      label: 'Find New Elders' },
    { id: 'invites',   label: 'New Invites',      count: incomingRequests.length, notify: true },
    { id: 'requested', label: 'Requested',        count: sentRequests.length },
  ];

  // My Elders badge now tracks only established (ACTIVE) connections — pending
  // requests carry their own badge on the Requests tab.
  const connTokens = connections.filter(c => c.status === 'ACTIVE').map(c => `${c.id}:${c.status}`);
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
    ['browse', 'Offer Help', browseBadge],
    ['requests', 'Add Friends', requestsBadge],
  ];

  const activeConnections = connections.filter(c => c.status === 'ACTIVE');

  const RadiusBar = ({ noun = 'people' }) => (
    <div style={{ background: '#ffffff', borderRadius: '14px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', border: '1px solid #e0e0e0' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-sm)', color: 'var(--ink-slate-dark)' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4FA3CE" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        {locationStatus === 'asking' && 'Getting your location...'}
        {locationStatus === 'granted' && `Showing ${noun} within ${radiusKm} km of you`}
        {locationStatus === 'denied' && `Location unavailable, showing all ${noun}`}
        {locationStatus === 'idle' && 'Detecting location...'}
      </span>
      {locationStatus === 'granted' && (
        <select value={radiusKm} onChange={e => setRadiusKm(Number(e.target.value))}
          style={{ fontSize: '14px', fontWeight: 600, color: 'var(--blue)', background: 'var(--blue-wash)', border: '1px solid #BFD9EA', borderRadius: '9999px', padding: '6px 12px', outline: 'none', cursor: 'pointer' }}>
          {[5,10,25,50,100].map(v => <option key={v} value={v}>{v} km</option>)}
        </select>
      )}
    </div>
  );

  // When GPS is denied, a typed address resolves a location; reload both lists so
  // whichever tab the helper is on fills in immediately.
  function onLocationResolved(loc) {
    const coords = { lat: loc.lat, lng: loc.lng };
    setLocation(coords);
    setLocationStatus('granted');
    loadNeeds(coords);
    loadElders(coords);
  }

  // ── My Elders — classify connections by trust state (mirrors the elder view) ──
  const elderCounts = {
    active:   connections.filter(c => c.status === 'ACTIVE' && c.currentTrustLevel === 'TRUSTED').length,
    building: connections.filter(c => c.status === 'ACTIVE' && c.currentTrustLevel !== 'TRUSTED').length,
  };
  // Always open on Active — a helper's home base is their established elders.
  // Pending connection requests now live in their own top-level Requests tab.
  const eldersDefault = 'active';
  const activeEldersSeg = eldersSeg ?? eldersDefault;
  const elderSegments = [
    { id: 'active',   label: 'Active',         count: elderCounts.active },
    { id: 'building', label: 'Building Trust', count: elderCounts.building },
  ];
  const visibleConnections = [...connections].filter(c => {
    if (activeEldersSeg === 'building') return c.status === 'ACTIVE' && c.currentTrustLevel !== 'TRUSTED';
    return c.status === 'ACTIVE' && c.currentTrustLevel === 'TRUSTED';
  }).sort(sortConnections);
  const eldersEmptyText = {
    active:   <>No fully trusted elders yet. As your trust grows with an elder, they'll appear here.</>,
    building: <>No connections in progress. Reach out to an elder to start building trust together.</>,
  }[activeEldersSeg];

  // ── Browse Needs — split into Available / Applied / Completed ──
  // Available = open requests nearby I haven't applied to yet.
  // Applied    = requests I've offered to help with that are still live.
  // Completed  = requests I helped with that the elder has marked done.
  const availableNeeds = [...needs].filter(n => !n.myApplicationStatus).sort(sortNeeds);
  const appliedNeeds = myApplications.filter(n =>
    (n.status === 'OPEN' || n.status === 'ASSIGNED') &&
    (n.myApplicationStatus === 'PENDING' || n.myApplicationStatus === 'ACCEPTED'));
  const completedNeeds = myApplications.filter(n =>
    n.status === 'COMPLETED' && n.myApplicationStatus === 'ACCEPTED');
  const browseSegments = [
    { id: 'available', label: 'Available', count: availableNeeds.length },
    { id: 'applied',   label: 'Applied',   count: appliedNeeds.length },
    { id: 'completed', label: 'Completed', count: completedNeeds.length },
  ];
  const browseList = { available: availableNeeds, applied: appliedNeeds, completed: completedNeeds }[browseSeg];

  // One pending-request card, shared by the Requests tab. Incoming invites get
  // Accept / Decline; requests this helper sent show a quiet "Requested" pill.
  function renderPendingCard(conn, i) {
    const isIncoming = !conn.initiatedByMe;
    const name = conn.otherUserName || 'Elder';

    if (isIncoming) {
      return (
        <div key={conn.id} style={{
          background: '#ffffff', borderRadius: '18px', padding: '20px',
          border: '1px solid #BFD9EA',
          animation: `fadeSlideUp 0.4s ease ${i * 0.05}s both`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
              <div style={{
                width: '46px', height: '46px', borderRadius: '50%', flexShrink: 0,
                background: 'var(--slate-tint)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '16px', fontWeight: 700, color: 'var(--ink-slate)',
              }}>
                {initials(name)}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: '16px', color: 'var(--ink)', margin: 0 }}>{name}{conn.otherUserAge != null ? <span style={{ fontSize: '13px', color: 'var(--ink-slate)', fontWeight: 500, marginLeft: '6px' }}>Age {conn.otherUserAge}</span> : null}</p>
                <p style={{ fontSize: '13px', color: 'var(--ink-slate)', margin: '3px 0 0' }}>sent you a friend request</p>
                {conn.requestMessage && (
                  <p style={{ fontSize: '13px', color: 'var(--ink-slate)', fontStyle: 'italic', margin: '4px 0 0' }}>"{conn.requestMessage}"</p>
                )}
              </div>
            </div>
            <span style={{
              fontSize: '11px', fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase',
              color: '#2E7DA6', background: '#E6F2FA', border: '1px solid #BFD9EA',
              padding: '3px 10px', borderRadius: '9999px', flexShrink: 0,
            }}>New</span>
          </div>
          <div className="card-actions" style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
            <button onClick={() => respondToConnection(conn.id, true)} disabled={respondingConn === conn.id}
              style={{ flex: 1, height: '36px', background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
              {respondingConn === conn.id ? '…' : 'Accept'}
            </button>
            <button onClick={() => respondToConnection(conn.id, false)} disabled={respondingConn === conn.id}
              style={{ flex: 1, height: '36px', background: '#fff', color: 'var(--ink-slate)', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
              Decline
            </button>
          </div>
        </div>
      );
    }

    // Outgoing / Requested
    return (
      <div key={conn.id} style={{
        background: '#ffffff', borderRadius: '18px', padding: '18px 20px',
        border: '1px solid #e8e8ed',
        animation: `fadeSlideUp 0.4s ease ${i * 0.05}s both`,
        display: 'flex', alignItems: 'center', gap: '14px',
      }}>
        <div style={{
          width: '52px', height: '52px', borderRadius: '50%', flexShrink: 0,
          background: '#f4f4f6',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '18px', fontWeight: 700, color: '#9aa0a8',
          border: '2px dashed #d2d2d7',
        }}>
          {initials(name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, fontSize: '16px', color: 'var(--ink)', margin: 0 }}>{name}{conn.otherUserAge != null ? <span style={{ fontSize: '13px', color: 'var(--ink-slate)', fontWeight: 500, marginLeft: '6px' }}>Age {conn.otherUserAge}</span> : null}</p>
          <p style={{ fontSize: '13px', color: 'var(--ink-slate)', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Waiting for {name} to accept — they'll see your request in their Add Friends tab.
          </p>
        </div>
        <span style={{
          fontSize: '12px', fontWeight: 600, color: '#8a929c',
          background: '#f3f4f6', border: '1px solid #e8e8ed',
          padding: '6px 14px', borderRadius: '9999px', flexShrink: 0,
        }}>Requested</span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100svh', background: 'var(--surface-pearl)', fontFamily: "-apple-system, 'SF Pro Text', system-ui, sans-serif" }}>
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
                  fontSize: '16px', letterSpacing: '-0.1px',
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

          <PeekabooCard />

          {/* My Elders tab (landing) */}
          {tab === 'connections' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <style>{`@keyframes shimmer { 0%,100%{opacity:0.6} 50%{opacity:1} }`}</style>
              <h2 style={{ fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif", fontSize: 'var(--text-lg)', fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--ink)', margin: '8px 0 0' }}>
                My Elders
              </h2>
              {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[1,2].map(i => (
                    <div key={i} style={{ background: 'var(--surface)', borderRadius: '18px', height: '80px', animation: 'shimmer 1.5s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
                  ))}
                  <style>{`@keyframes shimmer { 0%,100%{opacity:0.6} 50%{opacity:1} }`}</style>
                </div>
              )}
              {!loading && connections.length === 0 && (
                <div style={{ background: '#ffffff', borderRadius: '18px', textAlign: 'center', padding: '48px 24px', border: '1px solid #e0e0e0' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--surface)', border: '1px solid #BFD9EA', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4FA3CE" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  </div>
                  <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>No connections yet</p>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)', marginBottom: '20px', maxWidth: '280px', margin: '0 auto 20px' }}>Find elders near you and send a friend request to get started.</p>
                  <button onClick={() => { setTab('requests'); setFriendsSeg('find'); }} className="btn-primary" style={{ padding: '10px 24px', fontSize: 'var(--text-sm)' }}>
                    Add Friends
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
                const avatar = <Avatar name={conn.otherUserName} photoUrl={conn.otherUserPhotoUrl} size={48} />;
                return (
                <div key={conn.id} style={{
                  background: '#ffffff', borderRadius: '18px', padding: '22px',
                  border: '1px solid #e0e0e0',
                  animation: `fadeSlideUp 0.4s ease ${i * 0.05}s both`,
                }}>
                  {/* Identity row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        {avatar}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <p style={{ fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--ink)', margin: 0 }}>{conn.otherUserName || 'Elder'}</p>
                            {conn.otherUserAge != null && (
                              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-slate)', fontWeight: 500 }}>Age {conn.otherUserAge}</span>
                            )}
                            {conn.currentTrustLevel !== 'TRUSTED' && (
                              // In-progress stages show a blue pill; "Fully Trusted" is omitted
                              // here since it's already shown in the trust-ladder card below.
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#E6F2FA', padding: '3px 10px', borderRadius: '9999px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2E7DA6' }} />
                                <span style={{ fontSize: '14px', fontWeight: 700, color: '#2E7DA6' }}>{trustLabel(conn.currentTrustLevel)}</span>
                              </div>
                            )}
                          </div>
                          {conn.otherUserPhone && (
                            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-slate-dark)', margin: '6px 0 0', display: 'flex', alignItems: 'center', gap: '7px' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5a6470" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                              {conn.otherUserPhone}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action bar */}
                      {endingConn === conn.id ? (
                          <div className="card-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-slate)', flex: 1, minWidth: '160px' }}>End your connection with {conn.otherUserName || 'this elder'}?</span>
                            <button onClick={() => { setEndingConn(null); endConnection(conn.id); }} style={{ height: '36px', padding: '0 16px', background: 'var(--red-deep)', color: '#fff', border: 'none', borderRadius: '9999px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Yes, end</button>
                            <button onClick={() => setEndingConn(null)} style={{ height: '36px', padding: '0 16px', background: '#fff', color: 'var(--ink-slate)', border: '1px solid #e0e0e0', borderRadius: '9999px', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}>Keep</button>
                          </div>
                        ) : (
                          <div className="card-actions" style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
                            <button onClick={() => navigate(`/messages/${conn.id}`)} style={{ height: '36px', padding: '0 18px', background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: '9999px', fontSize: 'var(--text-sm)', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                              Message
                            </button>
                            <button onClick={() => navigate(`/user/${conn.otherUserId}`)} style={{ height: '36px', padding: '0 14px', background: '#fff', color: 'var(--ink-slate)', border: '1px solid #e0e0e0', borderRadius: '9999px', fontSize: '14px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>View Profile</button>
                            {conn.currentTrustLevel === 'TRUSTED' && !reviewedConns.has(conn.id) && (
                              <button onClick={() => setReviewingConn(reviewingConn === conn.id ? null : conn.id)} style={{ height: '36px', padding: '0 14px', background: '#fff', color: 'var(--ink-slate)', border: '1px solid #e0e0e0', borderRadius: '9999px', fontSize: '14px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
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
                        )}

                  {reviewingConn === conn.id && (
                    <div style={{ borderTop: '1px solid #f0f0f0', marginTop: '14px', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink)' }}>Rate {conn.otherUserName || 'this elder'}</p>
                      <StarPicker value={reviewForm.rating} onChange={r => setReviewForm(f => ({...f, rating: r}))} />
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {REVIEW_TAGS.map(t => (
                          <button key={t} onClick={() => setReviewForm(f => ({
                            ...f, tags: f.tags.includes(t) ? f.tags.filter(x => x !== t) : [...f.tags, t]
                          }))} style={{
                            fontSize: '14px', padding: '5px 14px', borderRadius: '9999px', border: '1px solid', cursor: 'pointer', transition: 'all 0.15s',
                            borderColor: reviewForm.tags.includes(t) ? '#4FA3CE' : '#e0e0e0',
                            background: reviewForm.tags.includes(t) ? '#4FA3CE' : '#fff',
                            color: reviewForm.tags.includes(t) ? '#fff' : '#7a7a7a',
                          }}>{t}</button>
                        ))}
                      </div>
                      <textarea value={reviewForm.comment} onChange={e => setReviewForm(f => ({...f, comment: e.target.value}))}
                        placeholder="Any comments? (optional)" rows={2}
                        style={{ width: '100%', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '10px 14px', fontSize: 'var(--text-sm)', outline: 'none', fontFamily: 'inherit' }} />
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--ink-3)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={reviewForm.safetyConcern} onChange={e => setReviewForm(f => ({...f, safetyConcern: e.target.checked}))} />
                        Report a safety concern
                      </label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => submitElderReview(conn)} disabled={submittingReview} className="btn-confirm" style={{ flex: 1, padding: '10px' }}>
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

          {/* Add Friends tab — invites you got, requests you sent, and finding new elders */}
          {tab === 'requests' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <style>{`@keyframes shimmer { 0%,100%{opacity:0.6} 50%{opacity:1} }`}</style>
              <h2 style={{ fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif", fontSize: 'var(--text-lg)', fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--ink)', margin: '8px 0 0' }}>
                Add Friends
              </h2>
              <SegmentedTabs segments={friendsSegments} value={friendsSeg} onChange={setFriendsSeg} />

              {/* New Invites — friend requests waiting for you to answer */}
              {friendsSeg === 'invites' && (loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[1,2].map(i => (
                    <div key={i} style={{ background: 'var(--surface)', borderRadius: '18px', height: '80px', animation: 'shimmer 1.5s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
              ) : incomingRequests.length === 0 ? (
                <SegmentEmpty icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4FA3CE" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}>
                  No new invites right now. When someone wants to be friends, you'll see it here.
                </SegmentEmpty>
              ) : (
                [...incomingRequests].sort(sortConnections).map((conn, i) => renderPendingCard(conn, i))
              ))}

              {/* Requested — friend requests you've sent, waiting on them */}
              {friendsSeg === 'requested' && (loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[1,2].map(i => (
                    <div key={i} style={{ background: 'var(--surface)', borderRadius: '18px', height: '80px', animation: 'shimmer 1.5s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
              ) : sentRequests.length === 0 ? (
                <SegmentEmpty icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4FA3CE" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>}>
                  You haven't sent any friend requests yet. Add someone from "Find New Elders".
                </SegmentEmpty>
              ) : (
                [...sentRequests].sort(sortConnections).map((conn, i) => renderPendingCard(conn, i))
              ))}
            </div>
          )}

          {/* Browse Needs tab */}
          {tab === 'browse' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <h2 style={{ fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif", fontSize: 'var(--text-lg)', fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--ink)', margin: '0 0 6px' }}>
                  Offer Help
                </h2>
                <p style={{ fontSize: '16px', color: 'var(--ink-slate)', margin: 0 }}>
                  Elders nearby who could use a hand. Offer to help with one tap.
                </p>
              </div>

              <SegmentedTabs segments={browseSegments} value={browseSeg} onChange={setBrowseSeg} />

              {/* Distance + location controls only matter for the Available list */}
              {browseSeg === 'available' && <RadiusBar noun="help" />}
              {browseSeg === 'available' && locationStatus === 'primer' && (
                <LocationPrimer onEnable={requestLocation} onManual={() => { setLocationStatus('denied'); loadNeeds(); loadElders(); }} />
              )}
              {browseSeg === 'available' && locationStatus === 'denied' && <LocationPrompt onResolved={onLocationResolved} />}

              {/* Available — location-aware empty state */}
              {browseSeg === 'available' && availableNeeds.length === 0 && locationStatus !== 'asking' && (
                <div style={{ background: '#ffffff', borderRadius: '18px', textAlign: 'center', padding: '64px 24px', border: '1px solid #e0e0e0' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--surface)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4FA3CE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                  </div>
                  <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>No help nearby</p>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)' }}>
                    {locationStatus === 'granted'
                      ? `Nothing within ${radiusKm} km right now. Use the radius selector above to expand your search area.`
                      : 'No open help right now. Check back soon or enable location to filter by distance.'}
                  </p>
                </div>
              )}

              {/* Applied / Completed — friendly segment empty states */}
              {browseSeg === 'applied' && appliedNeeds.length === 0 && (
                <SegmentEmpty icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4FA3CE" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>}>
                  You haven't offered to help with anything yet. Find one under Available and tap "Offer to Help."
                </SegmentEmpty>
              )}
              {browseSeg === 'completed' && completedNeeds.length === 0 && (
                <SegmentEmpty icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4FA3CE" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>}>
                  No completed help yet. Help you gave shows up here once the elder marks it done.
                </SegmentEmpty>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {browseList.map((need, i) => (
                  <NeedCard key={need.id} need={need} index={i} applying={applying}
                    onApply={apply} onWithdraw={withdrawApplication}
                    onOpenProfile={(id) => navigate(`/user/${id}`)} />
                ))}
              </div>
            </div>
          )}

          {/* Add Friends → Find New Elders segment */}
          {tab === 'requests' && friendsSeg === 'find' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <p style={{ fontSize: '16px', color: 'var(--ink-slate)', margin: 0 }}>
                Find elders near you and send a friend request.
              </p>
              <RadiusBar noun="elders" />
              {locationStatus === 'primer' && (
                <LocationPrimer onEnable={requestLocation} onManual={() => { setLocationStatus('denied'); loadNeeds(); loadElders(); }} />
              )}
              {locationStatus === 'denied' && <LocationPrompt onResolved={onLocationResolved} />}
              {/* Searching state — never flash a blank "nobody here" while loading (H1) */}
              {discovering && elders.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[1,2].map(i => (
                    <div key={i} style={{ background: 'var(--surface)', borderRadius: '18px', height: '110px', animation: 'shimmer 1.5s ease-in-out infinite' }} />
                  ))}
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)', textAlign: 'center', margin: 0 }}>Looking for elders near you…</p>
                </div>
              )}

              {/* Fetch failed — be honest and give a retry (H9) */}
              {!discovering && discoverError && (
                <div style={{ background: '#ffffff', borderRadius: '18px', textAlign: 'center', padding: '40px 24px', border: '1px solid #fecaca' }}>
                  <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>Couldn't load elders</p>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)', marginBottom: '18px' }}>Something went wrong on our side. Please try again.</p>
                  <button onClick={() => loadElders()} className="btn-primary" style={{ padding: '10px 24px', fontSize: 'var(--text-sm)' }}>
                    Try Again
                  </button>
                </div>
              )}

              {!discovering && !discoverError && elders.length === 0 && (
                <div style={{ background: '#ffffff', borderRadius: '18px', textAlign: 'center', padding: '64px 24px', border: '1px solid #e0e0e0' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--surface)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4FA3CE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                    </svg>
                  </div>
                  <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
                    {locationStatus === 'granted' ? 'No elders found nearby' : 'No elders available right now'}
                  </p>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)' }}>
                    {locationStatus === 'granted'
                      ? 'Try a larger radius above, or check back later.'
                      : 'New members join often. Please check back soon.'}
                  </p>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[...elders].sort((a, b) => {
                const rank = u => connectedElderIds.has(u.userId) ? 2 : (requestedElderIds.has(u.userId) || connectMsg[u.userId] === 'Requested') ? 1 : 0;
                return rank(a) - rank(b);
              }).map((elder, i) => {
                const alreadyConnected = connectedElderIds.has(elder.userId);
                const sent = connectMsg[elder.userId];
                const requested = requestedElderIds.has(elder.userId) || sent === 'Requested';
                const errorMsg = sent && sent !== 'Requested' ? sent : null;
                return (
                  <div key={elder.userId} style={{
                    background: '#ffffff', borderRadius: '18px', padding: '20px',
                    border: '1px solid #e0e0e0',
                    animation: `fadeSlideUp 0.4s ease ${i * 0.05}s both`,
                  }}>
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                      <Avatar name={elder.name} photoUrl={elder.photoUrl} size={50} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <p style={{ fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--ink)', margin: 0 }}>{elder.name || 'Elder'}</p>
                          {elder.age != null && (
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-slate)', fontWeight: 500 }}>Age {elder.age}</span>
                          )}
                          {(elder.trustScore != null || elder.trustTier) && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'var(--slate-tint)', padding: '3px 10px', borderRadius: '9999px', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--ink-slate)' }}>
                              {elder.trustTier || 'New'}{elder.trustScore != null ? ` · ${elder.trustScore}` : ''}
                            </span>
                          )}
                        </div>
                        {(elder.city || elder.distanceKm != null) && (
                          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-slate)', margin: '4px 0 0' }}>
                            {elder.city}{elder.city && elder.distanceKm != null ? ' · ' : ''}{elder.distanceKm != null ? `${Math.round(elder.distanceKm * 10) / 10} km away` : ''}
                          </p>
                        )}
                        {elder.bio && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-slate-dark)', margin: '8px 0 0', lineHeight: 1.5 }}>{elder.bio}</p>}
                        {elder.interests?.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                            {elder.interests.map(interest => (
                              <span key={interest} style={{ fontSize: 'var(--text-xs)', fontWeight: 600, background: '#F2F4F7', color: 'var(--ink-slate)', padding: '4px 11px', borderRadius: '9999px' }}>{interest}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="card-actions" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'stretch', flexShrink: 0 }}>
                        {alreadyConnected ? (
                          <span style={{ fontSize: 'var(--text-xs)', background: 'var(--blue-tint)', color: 'var(--blue-deep)', padding: '9px 18px', borderRadius: '9999px', fontWeight: 700, textAlign: 'center' }}>Friends</span>
                        ) : requested ? (
                          <span style={{ fontSize: 'var(--text-xs)', padding: '9px 18px', borderRadius: '9999px', fontWeight: 600, textAlign: 'center', background: '#f3f4f6', color: '#8a929c' }}>Requested</span>
                        ) : errorMsg ? (
                          <span style={{ fontSize: 'var(--text-xs)', padding: '9px 18px', borderRadius: '9999px', fontWeight: 600, textAlign: 'center', background: '#f3f4f6', color: '#5a6470' }}>{errorMsg}</span>
                        ) : (
                          <button onClick={() => connectToElder(elder.userId)} disabled={connectingTo === elder.userId}
                            style={{ height: '40px', padding: '0 22px', background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: '9999px', fontSize: 'var(--text-sm)', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                            {connectingTo === elder.userId ? '...' : 'Add Friend'}
                          </button>
                        )}
                        <button onClick={() => navigate(`/user/${elder.userId}`)}
                          style={{ height: '36px', padding: '0 14px', background: '#fff', color: 'var(--ink-slate)', border: '1px solid #e0e0e0', borderRadius: '9999px', fontSize: '14px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
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
