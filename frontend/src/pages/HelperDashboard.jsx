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

const unsplash = (id, w, h) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

const COMMUNITY_PHOTOS = [
  { id: 'photo-1529156069898-49953e39b3ac', label: 'Community' },
  { id: 'photo-1544005313-94ddf0286df2', label: 'Elder woman' },
  { id: 'photo-1573497491208-6b1acb260507', label: 'Helping hands' },
  { id: 'photo-1438761681033-6461ffad8d80', label: 'Community member' },
];

const statusStyle = (status) => {
  const map = {
    ACTIVE:  { bg: '#dcfce7', color: '#166534' },
    PENDING: { bg: '#fef3c7', color: '#92400e' },
    DECLINED: { bg: '#fee2e2', color: '#991b1b' },
  };
  const s = map[status] ?? { bg: '#f3f4f6', color: '#6b7280' };
  return { background: s.bg, color: s.color, fontSize: '11px', fontWeight: 600,
    padding: '3px 10px', borderRadius: '9999px', letterSpacing: '0.3px', textTransform: 'uppercase' };
};

const initials = (name) => name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';

export default function HelperDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [connections, setConnections] = useState([]);
  const [needs, setNeeds] = useState([]);
  const [elders, setElders] = useState([]);
  const [tab, setTab] = useState('connections');
  const [applying, setApplying] = useState(null);
  const [applyMsg, setApplyMsg] = useState({});
  const [connectingTo, setConnectingTo] = useState(null);
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
    try {
      const coords = loc ?? location;
      let url = '/discover/elders';
      if (coords) url += `?lat=${coords.lat}&lng=${coords.lng}&radiusKm=${radiusKm}`;
      const r = await api.get(url);
      setElders(r.data);
    } catch {}
  }

  function requestLocation() {
    if (!navigator.geolocation) { setLocationStatus('denied'); loadNeeds(); return; }
    setLocationStatus('asking');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(loc); setLocationStatus('granted'); loadNeeds(loc);
      },
      () => { setLocationStatus('denied'); loadNeeds(); }
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
  const connectedElderIds = new Set(connections.map(c => c.otherUserId));
  const pendingIncoming = connections.filter(c => c.status === 'PENDING' && !c.initiatedByMe);
  const tabs = [
    ['connections', `Connections${pendingIncoming.length > 0 ? ` (${pendingIncoming.length})` : ''}`],
    ['browse', 'Browse Needs'],
    ['discover', 'Discover Elders'],
  ];

  const activeConnections = connections.filter(c => c.status === 'ACTIVE');
  const pendingApplications = needs.filter(n => applyMsg[n.id]);

  const RadiusBar = () => (
    <div style={{ background: '#ffffff', borderRadius: '14px', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', border: '1px solid #e0e0e0' }}>
      <p style={{ fontSize: '13px', color: '#7a7a7a', margin: 0 }}>
        {locationStatus === 'asking' && 'Getting your location...'}
        {locationStatus === 'granted' && `Showing within ${radiusKm} km of you`}
        {locationStatus === 'denied' && 'Location denied — showing all'}
        {locationStatus === 'idle' && 'Detecting location...'}
      </p>
      {locationStatus === 'granted' && (
        <select value={radiusKm} onChange={e => setRadiusKm(Number(e.target.value))}
          style={{ border: '1px solid #e0e0e0', borderRadius: '9999px', padding: '5px 12px', fontSize: '13px', outline: 'none', background: '#fff', cursor: 'pointer' }}>
          {[5,10,25,50,100].map(v => <option key={v} value={v}>{v} km</option>)}
        </select>
      )}
    </div>
  );

  return (
    <div style={{ minHeight: '100svh', background: '#f5f5f7', fontFamily: "-apple-system, 'SF Pro Text', system-ui, sans-serif" }}>
      <NavBar />

      {/* Hero section */}
      <div style={{ background: '#fafafc', borderBottom: '1px solid #e0e0e0', padding: '48px 80px 40px' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <h1 style={{
            fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif",
            fontSize: '40px', fontWeight: 600, color: '#1d1d1f',
            letterSpacing: '-0.5px', margin: '0 0 8px',
          }}>
            Hello{profile?.name ? `, ${profile.name.split(' ')[0]}.` : '.'}
          </h1>
          <p style={{ fontSize: '17px', color: '#7a7a7a', margin: '0 0 24px', fontWeight: 300 }}>
            Ready to make a difference today?
          </p>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {profile?.trustScore != null && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', border: '1.5px solid #0066cc', borderRadius: '9999px', padding: '8px 18px', background: '#f0f6ff' }}>
                <span style={{ fontSize: '13px', color: '#0066cc', fontWeight: 500 }}>Trust Score</span>
                <span style={{ fontSize: '15px', color: '#0066cc', fontWeight: 700 }}>{profile.trustScore}</span>
              </div>
            )}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', borderRadius: '9999px', padding: '8px 18px', background: '#dcfce7' }}>
              <span style={{ fontSize: '13px', color: '#166534', fontWeight: 500 }}>Help sessions</span>
              <span style={{ fontSize: '15px', color: '#166534', fontWeight: 700 }}>{activeConnections.length}</span>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', borderRadius: '9999px', padding: '8px 18px', background: '#fef3c7' }}>
              <span style={{ fontSize: '13px', color: '#92400e', fontWeight: 500 }}>Pending requests</span>
              <span style={{ fontSize: '15px', color: '#92400e', fontWeight: 700 }}>{pendingIncoming.length}</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 80px 64px' }}>

        {/* Tab bar */}
        <div style={{ background: '#fafafc', borderBottom: '1px solid #e0e0e0', margin: '0 -80px', padding: '0 80px', display: 'flex', gap: 0 }}>
          {tabs.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              height: '48px', padding: '0 20px', fontSize: '14px',
              fontWeight: tab === id ? 600 : 400,
              color: tab === id ? '#0066cc' : '#7a7a7a',
              background: 'none', border: 'none',
              borderBottom: tab === id ? '2px solid #0066cc' : '2px solid transparent',
              cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
              marginBottom: '-1px', fontFamily: 'inherit',
            }}>{label}</button>
          ))}
        </div>

        <div style={{ paddingTop: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Connections tab */}
          {tab === 'connections' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>👥</div>
                  <p style={{ fontSize: '17px', fontWeight: 600, color: '#1d1d1f', marginBottom: '6px' }}>No connections yet</p>
                  <p style={{ fontSize: '14px', color: '#7a7a7a', marginBottom: '20px', maxWidth: '280px', margin: '0 auto 20px' }}>Discover elders near you and send a connection request to get started.</p>
                  <button onClick={() => setTab('discover')} className="btn-primary" style={{ padding: '10px 24px', fontSize: '14px' }}>
                    Discover Elders
                  </button>
                </div>
              )}
              {connections.map((conn, i) => (
                <div key={conn.id} style={{
                  background: '#ffffff', borderRadius: '18px', padding: '24px',
                  border: '1px solid #e0e0e0',
                  animation: `fadeSlideUp 0.4s ease ${i * 0.05}s both`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
                      <div style={{
                        width: '48px', height: '48px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, #0066cc, #5856d6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '16px', fontWeight: 700, color: '#fff', flexShrink: 0,
                      }}>
                        {initials(conn.otherUserName)}
                      </div>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: '18px', color: '#1d1d1f', margin: 0 }}>{conn.otherUserName || 'Elder'}</p>
                        <p style={{ fontSize: '13px', color: '#7a7a7a', margin: '3px 0 0' }}>{trustLabel(conn.currentTrustLevel)}</p>
                        {conn.requestMessage && (
                          <p style={{ fontSize: '13px', color: '#a0a0a5', fontStyle: 'italic', margin: '4px 0 0' }}>"{conn.requestMessage}"</p>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
                      {conn.status === 'ACTIVE' && (
                        <>
                          <button onClick={() => navigate(`/messages/${conn.id}`)} className="btn-primary" style={{ padding: '8px 18px', fontSize: '14px' }}>
                            Message
                          </button>
                          {conn.currentTrustLevel === 'TRUSTED' && !reviewedConns.has(conn.id) && (
                            <button onClick={() => setReviewingConn(reviewingConn === conn.id ? null : conn.id)} className="btn-secondary" style={{ padding: '8px 18px', fontSize: '14px' }}>
                              Review Elder
                            </button>
                          )}
                          {reviewedConns.has(conn.id) && (
                            <span style={{ fontSize: '12px', color: '#166534', fontWeight: 500 }}>Reviewed</span>
                          )}
                        </>
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
                        {{ ACTIVE: 'Connected', PENDING: 'Request Sent' }[conn.status] || conn.status}
                      </span>
                    </div>
                  </div>

                  {reviewingConn === conn.id && (
                    <div style={{ borderTop: '1px solid #f0f0f0', marginTop: '14px', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: '#1d1d1f' }}>Rate {conn.otherUserName || 'this elder'}</p>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {[1,2,3,4,5].map(s => (
                          <button key={s} onClick={() => setReviewForm(f => ({...f, rating: s}))}
                            style={{ fontSize: '28px', background: 'none', border: 'none', cursor: 'pointer', color: s <= reviewForm.rating ? '#ff9500' : '#d1d5db', transition: 'transform 0.1s' }}
                            onMouseEnter={e => e.target.style.transform = 'scale(1.2)'}
                            onMouseLeave={e => e.target.style.transform = 'scale(1)'}>★</button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {REVIEW_TAGS.map(t => (
                          <button key={t} onClick={() => setReviewForm(f => ({
                            ...f, tags: f.tags.includes(t) ? f.tags.filter(x => x !== t) : [...f.tags, t]
                          }))} style={{
                            fontSize: '13px', padding: '5px 14px', borderRadius: '9999px', border: '1px solid', cursor: 'pointer', transition: 'all 0.15s',
                            borderColor: reviewForm.tags.includes(t) ? '#0066cc' : '#e0e0e0',
                            background: reviewForm.tags.includes(t) ? '#0066cc' : '#fff',
                            color: reviewForm.tags.includes(t) ? '#fff' : '#7a7a7a',
                          }}>{t}</button>
                        ))}
                      </div>
                      <textarea value={reviewForm.comment} onChange={e => setReviewForm(f => ({...f, comment: e.target.value}))}
                        placeholder="Any comments? (optional)" rows={2}
                        style={{ width: '100%', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '10px 14px', fontSize: '14px', outline: 'none', fontFamily: 'inherit' }} />
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#ff3b30', cursor: 'pointer' }}>
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
                      otherUserName={conn.otherUserName || 'them'}
                      onConfirm={() => confirmTrust(conn.id)}
                      confirming={confirmingTrust === conn.id}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Browse Needs tab */}
          {tab === 'browse' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <RadiusBar />
              {needs.length === 0 && locationStatus !== 'asking' && (
                <div style={{ background: '#ffffff', borderRadius: '18px', textAlign: 'center', padding: '64px 24px', border: '1px solid #e0e0e0' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#dbeafe', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0066cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
              {needs.map((need, i) => (
                <div key={need.id} style={{
                  background: '#ffffff', borderRadius: '18px', padding: '20px',
                  border: '1px solid #e0e0e0',
                  animation: `fadeSlideUp 0.4s ease ${i * 0.05}s both`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, fontSize: '16px', color: '#1d1d1f', margin: 0 }}>{need.title}</p>
                      {need.description && <p style={{ fontSize: '14px', color: '#7a7a7a', marginTop: '4px', lineHeight: 1.5 }}>{need.description}</p>}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                        <span style={{ fontSize: '12px', background: '#f5f5f7', color: '#7a7a7a', padding: '3px 10px', borderRadius: '9999px' }}>{need.category}</span>
                        {need.urgency === 'URGENT' && (
                          <span style={{ fontSize: '12px', background: '#fee2e2', color: '#991b1b', padding: '3px 10px', borderRadius: '9999px', fontWeight: 600 }}>Urgent</span>
                        )}
                        {need.distanceKm != null && (
                          <span style={{ fontSize: '12px', color: '#a0a0a5', padding: '3px 0' }}>{need.distanceKm} km away</span>
                        )}
                      </div>
                      <p style={{ fontSize: '12px', color: '#a0a0a5', marginTop: '6px' }}>Posted by {need.elderName}</p>
                    </div>
                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                      <button onClick={() => apply(need.id)} disabled={applying === need.id || !!applyMsg[need.id]}
                        className={applyMsg[need.id]?.includes('!') ? '' : 'btn-primary'}
                        style={applyMsg[need.id]?.includes('!') ? {
                          fontSize: '13px', padding: '8px 18px', borderRadius: '9999px', border: 'none',
                          background: '#dcfce7', color: '#166534', cursor: 'default', fontWeight: 600
                        } : { padding: '8px 18px', fontSize: '13px' }}>
                        {applying === need.id ? '...' : applyMsg[need.id] || 'Apply'}
                      </button>
                      {applyMsg[need.id]?.includes('!') && (
                        <button onClick={() => withdrawApplication(need.id)}
                          style={{ fontSize: '11px', color: '#cc0000', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>
                          Withdraw
                        </button>
                      )}
                    </div>
                  </div>
                  {applyMsg[need.id] && !applyMsg[need.id].includes('!') && (
                    <p style={{ fontSize: '12px', color: '#991b1b', marginTop: '8px' }}>{applyMsg[need.id]}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Discover Elders tab */}
          {tab === 'discover' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <RadiusBar />
              {elders.length === 0 && (
                <div style={{ background: '#ffffff', borderRadius: '18px', textAlign: 'center', padding: '64px 24px', border: '1px solid #e0e0e0' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#dbeafe', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0066cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                    </svg>
                  </div>
                  <p style={{ fontSize: '16px', fontWeight: 600, color: '#1d1d1f', marginBottom: '6px' }}>No elders found nearby</p>
                  <p style={{ fontSize: '14px', color: '#7a7a7a' }}>Try a larger radius or check back later.</p>
                </div>
              )}
              {elders.map((elder, i) => {
                const alreadyConnected = connectedElderIds.has(elder.userId);
                const sent = connectMsg[elder.userId];
                return (
                  <div key={elder.userId} style={{
                    background: '#ffffff', borderRadius: '18px', padding: '20px',
                    border: '1px solid #e0e0e0',
                    animation: `fadeSlideUp 0.4s ease ${i * 0.05}s both`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                      <div style={{ display: 'flex', gap: '16px', flex: 1 }}>
                        <div style={{
                          width: '52px', height: '52px', borderRadius: '50%',
                          background: 'linear-gradient(135deg, #0066cc, #5856d6)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '17px', fontWeight: 700, color: '#fff', flexShrink: 0,
                        }}>
                          {elder.name ? elder.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <p style={{ fontWeight: 600, fontSize: '18px', color: '#1d1d1f', margin: 0 }}>{elder.name || 'Elder'}</p>
                            <TrustBadge tier={elder.trustTier} score={elder.trustScore} />
                          </div>
                          {elder.city && <p style={{ fontSize: '13px', color: '#7a7a7a', margin: '3px 0 0' }}>{elder.city}</p>}
                          {elder.distanceKm != null && (
                            <p style={{ fontSize: '12px', color: '#a0a0a5', margin: '2px 0 0' }}>{Math.round(elder.distanceKm * 10) / 10} km away</p>
                          )}
                          {elder.bio && <p style={{ fontSize: '14px', color: '#7a7a7a', margin: '6px 0 0', lineHeight: 1.5 }}>{elder.bio}</p>}
                          {elder.interests?.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                              {elder.interests.map(interest => (
                                <span key={interest} style={{ fontSize: '12px', background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '9999px' }}>{interest}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        {alreadyConnected ? (
                          <span style={{ fontSize: '12px', background: '#dcfce7', color: '#166534', padding: '6px 14px', borderRadius: '9999px', fontWeight: 600 }}>Connected</span>
                        ) : sent ? (
                          <span style={{
                            fontSize: '12px', padding: '6px 14px', borderRadius: '9999px', fontWeight: 600,
                            background: sent.includes('!') ? '#dcfce7' : '#fee2e2',
                            color: sent.includes('!') ? '#166534' : '#991b1b',
                          }}>{sent}</span>
                        ) : (
                          <button onClick={() => connectToElder(elder.userId)} disabled={connectingTo === elder.userId}
                            className="btn-primary" style={{ padding: '8px 18px', fontSize: '13px' }}>
                            {connectingTo === elder.userId ? '...' : 'Connect'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
