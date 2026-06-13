import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';
import NavBar from '../components/NavBar';
import TrustBadge from '../components/TrustBadge';
import TrustJourney from '../components/TrustJourney';
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
  { id: 'photo-1576765974256-9b879d60a571', label: 'Elder with helper' },
  { id: 'photo-1529156069898-49953e39b3ac', label: 'Community' },
  { id: 'photo-1559839734-2b71ea197ec2', label: 'Elder woman' },
  { id: 'photo-1507679799987-c73779587ccf', label: 'Elder man' },
];

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

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #e0e0e0',
  borderRadius: '12px',
  padding: '12px 16px',
  fontSize: '15px',
  fontFamily: 'inherit',
  color: '#1d1d1f',
  background: '#ffffff',
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};
const focusIn = (e) => { e.target.style.borderColor = '#4FA3CE'; e.target.style.boxShadow = '0 0 0 3px rgba(79,163,206,0.15)'; };
const focusOut = (e) => { e.target.style.borderColor = '#e0e0e0'; e.target.style.boxShadow = 'none'; };

function FormField({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label style={{
        fontSize: '13px',
        fontWeight: 600,
        color: '#7a7a7a',
        textTransform: 'uppercase',
        letterSpacing: '0.4px',
      }}>{label}</label>
      {children}
    </div>
  );
}

export default function ElderDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const seenConn = useSeenIds(user?.userId, 'connections');
  const seenApplicants = useSeenIds(user?.userId, 'applicants');
  const [profile, setProfile] = useState(null);
  const [connections, setConnections] = useState([]);
  const [myNeeds, setMyNeeds] = useState([]);
  const [tab, setTab] = useState('overview');
  const [needForm, setNeedForm] = useState({ title: '', description: '', category: 'COMPANIONSHIP', urgency: 'NORMAL' });
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
    requestLocation();
  }, []);

  useEffect(() => {
    if (tab === 'needs') loadNeeds();
    if (tab === 'connections') loadConnections();
    if (tab === 'discover') loadHelpers();
  }, [tab, radiusKm]);

  async function loadHelpers(loc) {
    const coords = loc ?? location;
    try {
      const res = coords
        ? await api.get(`/discover/helpers?lat=${coords.lat}&lng=${coords.lng}&radiusKm=${radiusKm}`)
        : await api.get('/discover/helpers');
      setHelpers(res.data || []);
    } catch {}
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
      const body = { ...needForm };
      if (location) { body.locationLat = location.lat; body.locationLng = location.lng; }
      await api.post('/needs', body);
      setNeedForm({ title: '', description: '', category: 'COMPANIONSHIP', urgency: 'NORMAL' });
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
    ['overview', 'Home', 0],
    ['connections', 'My Helpers', connBadge],
    ['discover', 'Find Helpers', 0],
    ['needs', 'My Requests', requestsBadge],
  ];

  return (
    <div style={{ minHeight: '100svh', background: '#fafafc', fontFamily: "-apple-system, 'SF Pro Text', system-ui, sans-serif" }}>
      <NavBar />

      {/* ── Sticky tab bar — always visible when scrolling ── */}
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
                  height: '44px', padding: '0 18px',
                  fontSize: '15px', letterSpacing: '-0.1px',
                  fontWeight: active ? 700 : 500,
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

          {/* Overview tab */}
          {tab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {profile?.name && (() => {
                const now = new Date();
                const h = now.getHours();
                const greet = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
                const firstName = profile.name.split(' ')[0];
                const dateStr = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
                return (
                  <div style={{
                    background: 'linear-gradient(135deg, #EAF5FB 0%, #F6FBFE 60%, #EBF6EE 100%)',
                    border: '1px solid #D8EAF4', borderRadius: '18px',
                    padding: '26px 30px',
                  }}>
                    <p style={{
                      fontSize: '13px', fontWeight: 600, color: '#3D8AB0',
                      letterSpacing: '1px', textTransform: 'uppercase', margin: '0 0 6px',
                    }}>
                      {dateStr}
                    </p>
                    <p style={{
                      fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif",
                      fontSize: '32px', fontWeight: 600, color: '#1d1d1f',
                      letterSpacing: '-0.5px', margin: 0, lineHeight: 1.2,
                    }}>
                      {greet}, {firstName}
                    </p>
                    <p style={{ fontSize: '15px', color: '#5a6470', margin: '6px 0 0' }}>
                      Welcome back. Here's how your community is doing today.
                    </p>
                  </div>
                );
              })()}
              {/* Quick actions — every main feature reachable in one click */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
                {[
                  { label: 'Post a help request', sub: 'Helpers nearby will offer', onClick: () => { setTab('needs'); setShowPostForm(true); } },
                  { label: 'Find helpers', sub: 'Browse people near you', onClick: () => setTab('discover') },
                  { label: 'My Trust Score', sub: 'See how it grows', onClick: () => navigate('/trust') },
                ].map(a => (
                  <button key={a.label} onClick={a.onClick} style={{
                    background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: '18px',
                    padding: '16px 18px', textAlign: 'left', cursor: 'pointer',
                    fontFamily: 'inherit', transition: 'box-shadow 0.15s, transform 0.15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(16,42,67,0.08)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
                  >
                    <span style={{ display: 'block', fontSize: '15px', fontWeight: 600, color: '#3D8AB0' }}>{a.label} →</span>
                    <span style={{ display: 'block', fontSize: '13px', color: '#7a7a7a', marginTop: '3px' }}>{a.sub}</span>
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                <h2 style={{ fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif", fontSize: '28px', fontWeight: 600, color: '#1d1d1f', margin: 0 }}>
                  Your Trust Journey
                </h2>
                {profile?.trustScore != null && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    background: '#f5f5f7', border: '1px solid #BFD9EA',
                    borderRadius: '9999px', padding: '6px 16px',
                  }}>
                    <span style={{ fontSize: '13px', color: '#4FA3CE', fontWeight: 500 }}>Trust Score</span>
                    <span style={{ fontSize: '15px', color: '#4FA3CE', fontWeight: 600 }}>{profile.trustScore}</span>
                  </div>
                )}
              </div>
              <p style={{ fontSize: '15px', color: '#7a7a7a', margin: '-16px 0 0' }}>
                See how your relationships are growing with each helper.
              </p>

              {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[1,2].map(i => (
                    <div key={i} style={{ background: '#f5f5f7', borderRadius: '18px', height: '120px', animation: 'shimmer 1.5s ease-in-out infinite' }} />
                  ))}
                </div>
              )}

              {!loading && connections.filter(c => c.status === 'ACTIVE').length === 0 && (
                <div style={{ background: '#ffffff', borderRadius: '18px', textAlign: 'center', padding: '56px 24px', border: '1px solid #e0e0e0' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#f5f5f7', border: '1px solid #BFD9EA', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4FA3CE" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                  </div>
                  <p style={{ fontSize: '18px', fontWeight: 600, color: '#1d1d1f', marginBottom: '8px' }}>No active connections yet</p>
                  <p style={{ fontSize: '14px', color: '#7a7a7a', marginBottom: '24px', maxWidth: '280px', margin: '0 auto 24px' }}>
                    Once a helper connects with you, you'll see your trust progress here.
                  </p>
                  <button onClick={() => setTab('connections')} className="btn-primary" style={{ padding: '11px 28px', fontSize: '15px' }}>
                    View Connections
                  </button>
                </div>
              )}

              {!loading && connections.filter(c => c.status === 'ACTIVE').map((conn, i) => (
                <div key={conn.id} style={{
                  background: '#ffffff', borderRadius: '18px', padding: '24px',
                  border: '1px solid #e0e0e0',
                  animation: `fadeSlideUp 0.4s ease ${i * 0.06}s both`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '4px' }}>
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '50%',
                      background: '#e8e8ed',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '15px', fontWeight: 600, color: '#4FA3CE', flexShrink: 0,
                    }}>
                      {initials(conn.otherUserName)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: '17px', color: '#1d1d1f', margin: 0 }}>{conn.otherUserName || 'Helper'}</p>
                      <p style={{ fontSize: '13px', color: '#7a7a7a', margin: '2px 0 0' }}>{trustLabel(conn.currentTrustLevel)}</p>
                      {conn.otherUserPhone && (
                        <p style={{ fontSize: '13px', color: '#4FA3CE', margin: '4px 0 0', fontWeight: 500 }}>
                          {conn.otherUserPhone}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end', flexShrink: 0 }}>
                      <button onClick={() => navigate(`/messages/${conn.id}`)} className="btn-primary" style={{ padding: '8px 18px', fontSize: '14px' }}>
                        Message
                      </button>
                      <button
                        onClick={() => navigate(`/user/${conn.otherUserId}`)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontFamily: `-apple-system, 'SF Pro Text', system-ui, sans-serif`,
                          fontSize: '12px', color: '#4FA3CE', fontWeight: 600, padding: '2px 0',
                        }}
                      >
                        View Profile
                      </button>
                      {endingConn === conn.id ? (
                        <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: '#5a6470' }}>End this connection?</span>
                          <button onClick={() => { setEndingConn(null); endConnection(conn.id); }}
                            style={{ background: '#9b3535', color: '#fff', border: 'none', borderRadius: '9999px', padding: '4px 12px', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                            Yes, end
                          </button>
                          <button onClick={() => setEndingConn(null)}
                            style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: '9999px', padding: '4px 12px', fontSize: '12px', color: '#5a6470', cursor: 'pointer', fontFamily: 'inherit' }}>
                            Keep
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setEndingConn(conn.id)}
                          style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: '9999px', padding: '4px 12px', fontSize: '12px', color: '#7a7a7a', cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          End
                        </button>
                      )}
                    </div>
                  </div>
                  <TrustJourney
                    currentTrustLevel={conn.currentTrustLevel}
                    confirmedByMe={conn.confirmedByMe}
                    confirmedByOther={conn.confirmedByOther}
                    otherUserName={conn.otherUserName || 'them'}
                    isElder={true}
                    onConfirm={() => confirmTrust(conn.id)}
                    confirming={confirmingTrust === conn.id}
                  />
                </div>
              ))}

              {!loading && connections.filter(c => c.status === 'PENDING').length > 0 && (
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#1d1d1f', margin: '0 0 12px' }}>
                    Pending Requests ({connections.filter(c => c.status === 'PENDING').length})
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {connections.filter(c => c.status === 'PENDING').map(conn => (
                      <div key={conn.id} style={{
                        background: '#ffffff', borderRadius: '14px', padding: '16px 20px',
                        border: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '38px', height: '38px', borderRadius: '50%',
                            background: '#e8e8ed',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '13px', fontWeight: 600, color: '#4FA3CE',
                          }}>
                            {initials(conn.otherUserName)}
                          </div>
                          <div>
                            <p style={{ fontWeight: 600, fontSize: '15px', color: '#1d1d1f', margin: 0 }}>{conn.otherUserName || 'Helper'}</p>
                            <p style={{ fontSize: '12px', color: '#7a7a7a', margin: '2px 0 0' }}>
                              {conn.initiatedByMe ? 'Request Sent' : 'Wants to connect'}
                            </p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {conn.otherUserId && (
                            <button onClick={() => navigate(`/user/${conn.otherUserId}`)}
                              style={{ padding: '7px 14px', fontSize: '13px', background: 'none', border: '1px solid #e0e0e0', borderRadius: '9999px', cursor: 'pointer', color: '#5a6470', fontFamily: 'inherit', fontWeight: 500 }}>
                              View Profile
                            </button>
                          )}
                          {!conn.initiatedByMe && (
                            <>
                              <button onClick={() => respondToConnection(conn.id, true)} disabled={respondingConn === conn.id}
                                className="btn-primary" style={{ padding: '7px 16px', fontSize: '13px' }}>Accept</button>
                              <button onClick={() => respondToConnection(conn.id, false)} disabled={respondingConn === conn.id}
                                className="btn-ghost" style={{ padding: '7px 14px', fontSize: '13px' }}>Decline</button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Connections tab */}
          {tab === 'connections' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <style>{`@keyframes shimmer { 0%,100% { opacity:0.6 } 50% { opacity:1 } }`}</style>
              <h2 style={{ fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif", fontSize: '28px', fontWeight: 600, color: '#1d1d1f', margin: 0 }}>
                My Helpers
              </h2>
              {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[1,2].map(i => (
                    <div key={i} style={{ background: '#f5f5f7', borderRadius: '18px', height: '80px', animation: 'shimmer 1.5s ease-in-out infinite' }} />
                  ))}
                </div>
              )}
              {!loading && connections.length === 0 && (
                <div style={{ background: '#ffffff', borderRadius: '18px', textAlign: 'center', padding: '48px 24px', border: '1px solid #e0e0e0' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#f5f5f7', border: '1px solid #BFD9EA', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4FA3CE" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  </div>
                  <p style={{ fontSize: '17px', fontWeight: 600, color: '#1d1d1f', marginBottom: '6px' }}>No helpers yet</p>
                  <p style={{ fontSize: '14px', color: '#7a7a7a', marginBottom: '20px' }}>Helpers in your area will send you connection requests. You'll see them here.</p>
                </div>
              )}
              {!loading && connections.map((conn, i) => (
                <div key={conn.id} style={{
                  background: '#ffffff', borderRadius: '18px', padding: '24px',
                  border: '1px solid #e0e0e0',
                  animation: `fadeSlideUp 0.4s ease ${i * 0.05}s both`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
                      <div style={{
                        width: '48px', height: '48px', borderRadius: '50%',
                        background: '#e8e8ed',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '16px', fontWeight: 600, color: '#4FA3CE', flexShrink: 0,
                      }}>
                        {initials(conn.otherUserName)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontWeight: 600, fontSize: '18px', color: '#1d1d1f', margin: 0 }}>{conn.otherUserName || 'User'}</p>
                        <p style={{ fontSize: '13px', color: '#7a7a7a', margin: '3px 0 0' }}>{trustLabel(conn.currentTrustLevel)}</p>
                        {conn.requestMessage && (
                          <p style={{ fontSize: '13px', color: '#a0a0a5', fontStyle: 'italic', margin: '4px 0 0' }}>"{conn.requestMessage}"</p>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
                      {conn.status === 'ACTIVE' && (
                        <button onClick={() => navigate(`/messages/${conn.id}`)} className="btn-primary" style={{ padding: '8px 18px', fontSize: '14px' }}>
                          Message
                        </button>
                      )}
                      {conn.status === 'ACTIVE' && conn.currentTrustLevel === 'TRUSTED' && !reviewedConns.has(conn.id) && (
                        <button onClick={() => setReviewingConn(reviewingConn === conn.id ? null : conn.id)} className="btn-secondary" style={{ padding: '8px 18px', fontSize: '14px' }}>
                          Review Helper
                        </button>
                      )}
                      {reviewedConns.has(conn.id) && (
                        <span style={{ fontSize: '12px', color: '#4FA3CE', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4.5L3.8 7.5L10 1" stroke="#4FA3CE" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          Reviewed
                        </span>
                      )}
                      {conn.status === 'PENDING' && !conn.initiatedByMe && (
                        <>
                          <button onClick={() => respondToConnection(conn.id, true)} disabled={respondingConn === conn.id}
                            className="btn-primary" style={{ padding: '8px 18px', fontSize: '14px' }}>Accept</button>
                          <button onClick={() => respondToConnection(conn.id, false)} disabled={respondingConn === conn.id}
                            className="btn-ghost">Decline</button>
                        </>
                      )}
                      <span style={statusStyle(conn.status === 'PENDING' && conn.initiatedByMe ? 'PENDING' : conn.status)}>
                        {conn.status === 'PENDING' && conn.initiatedByMe ? 'Request Sent' : ({ ACTIVE: 'Connected', PENDING: 'Request Sent' }[conn.status] || conn.status)}
                      </span>
                    </div>
                  </div>

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
                    <div style={{ marginTop: '14px', padding: '16px', background: '#fafafc', borderRadius: '12px', border: '1px solid #e8e8ed' }}>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: '#1d1d1f', marginBottom: '12px' }}>Rate {conn.otherUserName}</p>
                      <div style={{ marginBottom: '12px' }}>
                        <StarPicker value={reviewForm.rating} onChange={r => setReviewForm(f => ({...f, rating: r}))} />
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                        {['Punctual','Kind','Trustworthy','Patient','Helpful'].map(tag => (
                          <button key={tag} type="button" onClick={() => toggleTag(tag)} style={{
                            fontSize: '12px', padding: '4px 12px', borderRadius: '9999px', cursor: 'pointer',
                            border: '1px solid', transition: 'all 0.15s',
                            borderColor: reviewForm.tags.includes(tag) ? '#4FA3CE' : '#d2d2d7',
                            background: reviewForm.tags.includes(tag) ? '#4FA3CE' : '#fff',
                            color: reviewForm.tags.includes(tag) ? '#fff' : '#7a7a7a',
                          }}>{tag}</button>
                        ))}
                      </div>
                      <textarea value={reviewForm.comment} onChange={e => setReviewForm(f => ({...f, comment: e.target.value}))}
                        placeholder="Share your experience (optional)" rows={2}
                        style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #e0e0e0', fontSize: '14px', resize: 'none', boxSizing: 'border-box', marginBottom: '10px' }} />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => submitHelperReview(conn)} disabled={submittingReview} className="btn-primary" style={{ flex: 1, padding: '10px' }}>
                          {submittingReview ? 'Submitting…' : 'Submit Review'}
                        </button>
                        <button onClick={() => setReviewingConn(null)} className="btn-ghost" style={{ padding: '10px 16px' }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Find Helpers tab */}
          {tab === 'discover' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h2 style={{ fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif", fontSize: '28px', fontWeight: 600, color: '#1d1d1f', margin: '0 0 6px' }}>
                  Find Helpers
                </h2>
                <p style={{ fontSize: '15px', color: '#7a7a7a', margin: 0 }}>
                  Browse helpers in your area and reach out to connect.
                </p>
              </div>

              {/* Radius bar */}
              <div style={{ background: '#ffffff', borderRadius: '14px', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', border: '1px solid #e0e0e0' }}>
                <p style={{ fontSize: '13px', color: '#7a7a7a', margin: 0 }}>
                  {locationStatus === 'asking' && 'Getting your location…'}
                  {locationStatus === 'granted' && `Showing within ${radiusKm} km of you`}
                  {locationStatus === 'denied' && 'Location unavailable, showing all helpers'}
                  {locationStatus === 'idle' && 'Detecting location…'}
                </p>
                {locationStatus === 'granted' && (
                  <select value={radiusKm} onChange={e => setRadiusKm(Number(e.target.value))}
                    style={{ border: '1px solid #e0e0e0', borderRadius: '9999px', padding: '5px 12px', fontSize: '13px', outline: 'none', background: '#fff', cursor: 'pointer' }}>
                    {[5, 10, 25, 50, 100].map(v => <option key={v} value={v}>{v} km</option>)}
                  </select>
                )}
              </div>

              {helpers.length === 0 && (
                <div style={{ background: '#fff', borderRadius: '18px', border: '1px solid #e0e0e0', padding: '48px 24px', textAlign: 'center' }}>
                  <p style={{ fontSize: '16px', fontWeight: 600, color: '#1d1d1f', marginBottom: '6px' }}>
                    {locationStatus === 'granted' ? 'No helpers found nearby' : 'No helpers available right now'}
                  </p>
                  <p style={{ fontSize: '14px', color: '#7a7a7a' }}>
                    {locationStatus === 'granted'
                      ? 'Try a larger radius above, or check back later.'
                      : 'New helpers join often. Please check back soon.'}
                  </p>
                </div>
              )}

              <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
              {helpers.map((helper, i) => {
                const alreadyConnected = connectedHelperIds.has(helper.userId);
                const sent = connectMsg[helper.userId];
                return (
                  <div key={helper.userId} style={{
                    background: '#ffffff', borderRadius: '18px', padding: '20px',
                    border: '1px solid #e0e0e0',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                      <div style={{ display: 'flex', gap: '16px', flex: 1 }}>
                        <div style={{
                          width: '52px', height: '52px', borderRadius: '50%',
                          background: '#e8e8ed',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '17px', fontWeight: 600, color: '#4FA3CE', flexShrink: 0,
                        }}>
                          {helper.name ? helper.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <p style={{ fontWeight: 600, fontSize: '18px', color: '#1d1d1f', margin: 0 }}>{helper.name || 'Helper'}</p>
                            <TrustBadge tier={helper.trustTier} score={helper.trustScore} />
                          </div>
                          {helper.city && <p style={{ fontSize: '13px', color: '#7a7a7a', margin: '3px 0 0' }}>{helper.city}</p>}
                          {helper.distanceKm > 0 && (
                            <p style={{ fontSize: '12px', color: '#a0a0a5', margin: '2px 0 0' }}>{Math.round(helper.distanceKm * 10) / 10} km away</p>
                          )}
                          {helper.bio && <p style={{ fontSize: '14px', color: '#7a7a7a', margin: '6px 0 0', lineHeight: 1.5 }}>{helper.bio}</p>}
                          {helper.skillsOffered?.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                              {helper.skillsOffered.map(s => (
                                <span key={s} style={{ fontSize: '12px', background: '#f5f5f7', color: '#4FA3CE', padding: '2px 8px', borderRadius: '9999px' }}>{s}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                        {alreadyConnected ? (
                          <span style={{ fontSize: '12px', background: '#f5f5f7', color: '#4FA3CE', padding: '6px 14px', borderRadius: '9999px', fontWeight: 600 }}>Connected</span>
                        ) : sent ? (
                          <span style={{
                            fontSize: '12px', padding: '6px 14px', borderRadius: '9999px', fontWeight: 600,
                            background: sent.includes('!') ? '#f5f5f7' : '#f3f4f6',
                            color: sent.includes('!') ? '#4FA3CE' : '#5a6470',
                          }}>{sent}</span>
                        ) : (
                          <button onClick={() => connectToHelper(helper.userId)} disabled={connectingTo === helper.userId}
                            className="btn-primary" style={{ padding: '8px 18px', fontSize: '13px' }}>
                            {connectingTo === helper.userId ? '…' : 'Connect'}
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/user/${helper.userId}`)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontFamily: `-apple-system, 'SF Pro Text', system-ui, sans-serif`,
                            fontSize: '12px', color: '#4FA3CE', fontWeight: 600, padding: '2px 0',
                          }}
                        >
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
          {tab === 'needs' && !showPostForm && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <h2 style={{ fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif", fontSize: '28px', fontWeight: 600, color: '#1d1d1f', margin: 0 }}>
                  My Help Requests
                </h2>
                <button onClick={() => setShowPostForm(true)} className="btn-primary" style={{ padding: '10px 24px', fontSize: '14px' }}>
                  + New Request
                </button>
              </div>
              {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[1,2].map(i => (
                    <div key={i} style={{ background: '#f5f5f7', borderRadius: '18px', height: '80px', animation: 'shimmer 1.5s ease-in-out infinite' }} />
                  ))}
                </div>
              )}
              {!loading && myNeeds.length === 0 && (
                <div style={{ background: '#ffffff', borderRadius: '18px', textAlign: 'center', padding: '48px 24px', border: '1px solid #e0e0e0' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#f5f5f7', border: '1px solid #BFD9EA', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4FA3CE" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
                  </div>
                  <p style={{ fontSize: '17px', fontWeight: 600, color: '#1d1d1f', marginBottom: '6px' }}>No requests yet</p>
                  <p style={{ fontSize: '14px', color: '#7a7a7a', marginBottom: '20px' }}>Post a request and helpers near you will offer to assist. It only takes a minute.</p>
                  <button onClick={() => setShowPostForm(true)} className="btn-primary" style={{ padding: '10px 24px', fontSize: '14px' }}>
                    Post a Request
                  </button>
                </div>
              )}
              {!loading && myNeeds.map((need, i) => (
                <div key={need.id} style={{
                  background: '#ffffff', borderRadius: '18px', padding: '20px',
                  border: '1px solid #e0e0e0',
                  animation: `fadeSlideUp 0.4s ease ${i * 0.06}s both`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '4px' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, fontSize: '16px', color: '#1d1d1f', margin: 0 }}>{need.title}</p>
                      {need.description && <p style={{ fontSize: '14px', color: '#7a7a7a', marginTop: '4px', lineHeight: 1.5 }}>{need.description}</p>}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', background: '#f5f5f7', color: '#7a7a7a', padding: '3px 10px', borderRadius: '9999px' }}>{need.category}</span>
                        {need.urgency === 'URGENT' && (
                          <span style={{ fontSize: '12px', background: '#f3f4f6', color: '#5a6470', padding: '3px 10px', borderRadius: '9999px', fontWeight: 600 }}>Urgent</span>
                        )}
                      </div>
                    </div>
                    <span style={statusStyle(need.status)}>{{ OPEN: 'Looking for Help', ASSIGNED: 'Helper Found', COMPLETED: 'Completed', CANCELLED: 'Cancelled' }[need.status] || need.status}</span>
                  </div>

                  {need.status === 'OPEN' && need.applications?.length > 0 && (
                    <div style={{ borderTop: '1px solid #f0f0f0', marginTop: '14px', paddingTop: '14px' }}>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: '#a0a0a5', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                        {need.applications.length} Applicant{need.applications.length !== 1 ? 's' : ''}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {need.applications.map(app => (
                          <div key={app.helperId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafafc', borderRadius: '12px', padding: '10px 14px', border: '1px solid #e0e0e0' }}>
                            <div>
                              <p style={{ fontSize: '14px', fontWeight: 500, color: '#1d1d1f', margin: 0 }}>{app.helperName}</p>
                              {app.message && <p style={{ fontSize: '12px', color: '#7a7a7a', marginTop: '2px' }}>{app.message}</p>}
                            </div>
                            <button onClick={() => acceptHelper(need.id, app.helperId)} disabled={accepting === `${need.id}-${app.helperId}`}
                              className="btn-primary" style={{ padding: '6px 16px', fontSize: '12px', flexShrink: 0 }}>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #fee2e2', paddingTop: '10px', marginTop: '0', background: '#fef2f2', borderRadius: '10px', padding: '10px 12px' }}>
                          <span style={{ fontSize: '13px', color: '#5a6470', flex: 1 }}>Cancel this request?</span>
                          <button onClick={() => { cancelNeed(need.id); setCancelConfirm(null); }} style={{ fontSize: '12px', fontWeight: 600, color: '#fff', background: '#5a6470', border: 'none', borderRadius: '9999px', padding: '5px 14px', cursor: 'pointer' }}>Yes, cancel</button>
                          <button onClick={() => setCancelConfirm(null)} style={{ fontSize: '12px', color: '#7a7a7a', background: 'none', border: '1px solid #e0e0e0', borderRadius: '9999px', padding: '5px 12px', cursor: 'pointer' }}>Keep</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <p style={{ fontSize: '13px', color: '#a0a0a5', margin: 0 }}>No applicants yet</p>
                          <button onClick={() => setCancelConfirm(need.id)} style={{ fontSize: '12px', color: '#5a6470', background: 'none', border: '1px solid #fecaca', borderRadius: '9999px', padding: '4px 14px', cursor: 'pointer' }}>
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {need.status === 'ASSIGNED' && (
                    <div style={{ borderTop: '1px solid #f0f0f0', marginTop: '14px', paddingTop: '14px' }}>
                      <button onClick={() => completeNeed(need.id)} className="btn-primary"
                        style={{ width: '100%', background: '#4FA3CE', padding: '11px', fontSize: '15px' }}>
                        Mark as Complete
                      </button>
                    </div>
                  )}
                  {need.status === 'COMPLETED' && !reviewedNeeds.has(need.id) && need.applications?.some(a => a.status === 'ACCEPTED') && (
                    <div style={{ borderTop: '1px solid #f0f0f0', marginTop: '14px', paddingTop: '14px' }}>
                      {reviewingNeed === need.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <p style={{ fontSize: '14px', fontWeight: 600, color: '#1d1d1f' }}>Rate your helper</p>
                          <StarPicker value={reviewForm.rating} onChange={r => setReviewForm(f => ({...f, rating: r}))} />
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {REVIEW_TAGS.map(tag => (
                              <button key={tag} type="button" onClick={() => toggleTag(tag)} style={{
                                fontSize: '13px', padding: '5px 14px', borderRadius: '9999px',
                                border: '1px solid', transition: 'all 0.15s',
                                borderColor: reviewForm.tags.includes(tag) ? '#4FA3CE' : '#d2d2d7',
                                background: reviewForm.tags.includes(tag) ? '#4FA3CE' : '#fff',
                                color: reviewForm.tags.includes(tag) ? '#fff' : '#7a7a7a', cursor: 'pointer',
                              }}>{tag}</button>
                            ))}
                          </div>
                          <textarea value={reviewForm.comment} onChange={e => setReviewForm(f => ({...f, comment: e.target.value}))}
                            placeholder="Add a comment (optional)" rows={2}
                            style={{ width: '100%', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '10px 14px', fontSize: '14px', outline: 'none', fontFamily: 'inherit', resize: 'vertical' }} />
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#7a7a7a', cursor: 'pointer' }}>
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
                        <button onClick={() => setReviewingNeed(need.id)} className="btn-secondary" style={{ width: '100%', padding: '10px' }}>
                          Leave a Review
                        </button>
                      )}
                    </div>
                  )}
                  {need.status === 'COMPLETED' && reviewedNeeds.has(need.id) && (
                    <p style={{ fontSize: '13px', color: '#4FA3CE', fontWeight: 500, borderTop: '1px solid #f0f0f0', marginTop: '12px', paddingTop: '12px' }}>Review submitted</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Post Request form — lives inside My Requests */}
          {tab === 'needs' && showPostForm && (
            <div style={{ background: '#ffffff', borderRadius: '18px', padding: '32px', border: '1px solid #e0e0e0' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <h2 style={{
                  fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif",
                  fontSize: '28px', fontWeight: 600, color: '#1d1d1f',
                  letterSpacing: '-0.4px', marginBottom: '28px', marginTop: 0,
                }}>
                  Post a Help Request
                </h2>
                <button onClick={() => setShowPostForm(false)} style={{
                  background: 'none', border: '1px solid #e0e0e0', borderRadius: '9999px',
                  padding: '8px 18px', fontSize: '13px', color: '#5a6470',
                  cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, flexShrink: 0,
                }}>
                  ← Back to my requests
                </button>
              </div>
              <form onSubmit={postNeed} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                <FormField label="What do you need?">
                  <input value={needForm.title} onChange={e => setNeedForm(f => ({...f, title: e.target.value}))}
                    placeholder="e.g. Help with grocery shopping" style={inputStyle} required
                    onFocus={focusIn} onBlur={focusOut} />
                </FormField>
                <FormField label="Description">
                  <textarea value={needForm.description} onChange={e => setNeedForm(f => ({...f, description: e.target.value}))}
                    placeholder="Add more details..." rows={3}
                    style={{ ...inputStyle, resize: 'vertical' }}
                    onFocus={focusIn} onBlur={focusOut} />
                </FormField>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <FormField label="Category">
                    <select value={needForm.category} onChange={e => setNeedForm(f => ({...f, category: e.target.value}))}
                      style={inputStyle} onFocus={focusIn} onBlur={focusOut}>
                      <option value="COMPANIONSHIP">Companionship</option>
                      <option value="TRANSPORTATION">Transportation</option>
                      <option value="ERRANDS">Errands</option>
                      <option value="CLEANING">Cleaning</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </FormField>
                  <FormField label="Urgency">
                    <select value={needForm.urgency} onChange={e => setNeedForm(f => ({...f, urgency: e.target.value}))}
                      style={inputStyle} onFocus={focusIn} onBlur={focusOut}>
                      <option value="NORMAL">Normal</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </FormField>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', fontSize: '13px', color: '#7a7a7a' }}>
                  <span style={{
                    width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                    background: locationStatus === 'granted' ? '#4FA3CE' : locationStatus === 'denied' ? '#d0d0d5' : '#e0e0e0',
                  }} />
                  {locationStatus === 'asking' && 'Getting your location…'}
                  {locationStatus === 'granted' && 'Location on. Nearby helpers will be matched first.'}
                  {locationStatus === 'denied' && 'Location off. Your request will still reach all helpers.'}
                  {locationStatus === 'idle' && (
                    <button type="button" onClick={requestLocation} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#4FA3CE', padding: 0, fontWeight: 600 }}>
                      Share location to reach nearby helpers first
                    </button>
                  )}
                </div>
                {postMsg && <p style={{ fontSize: '14px', color: postMsg.includes('!') ? '#4FA3CE' : '#5a6470', fontWeight: 500 }}>{postMsg}</p>}
                <button type="submit" disabled={posting} className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '17px' }}>
                  {posting ? 'Posting...' : 'Post Request'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
