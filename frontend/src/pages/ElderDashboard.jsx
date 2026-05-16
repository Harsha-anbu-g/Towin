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
  { id: 'photo-1576765974256-9b879d60a571', label: 'Elder with helper' },
  { id: 'photo-1529156069898-49953e39b3ac', label: 'Community' },
  { id: 'photo-1559839734-2b71ea197ec2', label: 'Elder woman' },
  { id: 'photo-1507679799987-c73779587ccf', label: 'Elder man' },
];

const statusStyle = (status) => {
  const map = {
    OPEN:      { bg: '#dbeafe', color: '#1d4ed8' },
    ASSIGNED:  { bg: '#fef3c7', color: '#92400e' },
    COMPLETED: { bg: '#dcfce7', color: '#166534' },
    CANCELLED: { bg: '#f3f4f6', color: '#6b7280' },
    ACTIVE:    { bg: '#dcfce7', color: '#166534' },
    PENDING:   { bg: '#fef3c7', color: '#92400e' },
    DECLINED:  { bg: '#fee2e2', color: '#991b1b' },
  };
  const s = map[status] ?? { bg: '#f3f4f6', color: '#6b7280' };
  return { background: s.bg, color: s.color, fontSize: '11px', fontWeight: 600,
    padding: '3px 10px', borderRadius: '9999px', letterSpacing: '0.3px', textTransform: 'uppercase' };
};

const initials = (name) => name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';

export default function ElderDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [connections, setConnections] = useState([]);
  const [myNeeds, setMyNeeds] = useState([]);
  const [tab, setTab] = useState('connections');
  const [needForm, setNeedForm] = useState({ title: '', description: '', category: 'COMPANIONSHIP', urgency: 'NORMAL' });
  const [posting, setPosting] = useState(false);
  const [postMsg, setPostMsg] = useState('');
  const [accepting, setAccepting] = useState(null);
  const [respondingConn, setRespondingConn] = useState(null);
  const [confirmingTrust, setConfirmingTrust] = useState(null);
  const [reviewingNeed, setReviewingNeed] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, tags: [], comment: '', safetyConcern: false });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewedNeeds, setReviewedNeeds] = useState(new Set());
  const [location, setLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('idle');
  const [loading, setLoading] = useState(true);
  const [cancelConfirm, setCancelConfirm] = useState(null);

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
  }, []);

  useEffect(() => {
    if (tab === 'needs') loadNeeds();
    if (tab === 'connections') loadConnections();
    if (tab === 'post' && locationStatus === 'idle') requestLocation();
  }, [tab]);

  function requestLocation() {
    if (!navigator.geolocation) { setLocationStatus('denied'); return; }
    setLocationStatus('asking');
    navigator.geolocation.getCurrentPosition(
      pos => { setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocationStatus('granted'); },
      () => setLocationStatus('denied')
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
      setPostMsg('Request posted!'); await loadNeeds(); setTab('needs');
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
      await loadNeeds();
      toast.success('Helper accepted!');
    }
    catch { toast.error('Could not accept helper. Try again.'); }
    finally { setAccepting(null); }
  }

  const REVIEW_TAGS = ['Friendly', 'Punctual', 'Respectful', 'Helpful', 'Patient'];

  function toggleTag(tag) {
    setReviewForm(f => ({ ...f, tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag] }));
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
  const pendingIncoming = connections.filter(c => c.status === 'PENDING' && !c.initiatedByMe);
  const tabs = [
    ['connections', `Connections${pendingIncoming.length > 0 ? ` (${pendingIncoming.length})` : ''}`],
    ['needs', 'My Requests'],
    ['post', 'Post Request'],
  ];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning.' : hour < 17 ? 'Good afternoon.' : 'Good evening.';

  return (
    <div style={{ minHeight: '100svh', background: '#f5f5f7', fontFamily: "-apple-system, 'SF Pro Text', system-ui, sans-serif" }}>
      <NavBar />

      {/* Hero section */}
      <div style={{ background: '#1d1d1f', padding: '60px 80px 48px', position: 'relative' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '32px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{
              fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif",
              fontSize: '48px', fontWeight: 600, color: '#ffffff',
              letterSpacing: '-0.5px', margin: 0, lineHeight: 1.1,
            }}>
              {greeting}
            </h1>
            <p style={{ fontSize: '20px', fontWeight: 300, color: '#cccccc', marginTop: '12px', lineHeight: 1.4 }}>
              {profile
                ? `${connections.filter(c => c.status === 'ACTIVE').length} active helper${connections.filter(c => c.status === 'ACTIVE').length !== 1 ? 's' : ''} · ${pendingIncoming.length} new request${pendingIncoming.length !== 1 ? 's' : ''}`
                : 'Welcome to ToWin'}
            </p>
            {profile?.trustScore != null && (
              <div style={{ marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(0,102,204,0.25)', border: '1px solid rgba(0,102,204,0.5)', borderRadius: '9999px', padding: '6px 16px' }}>
                <span style={{ fontSize: '13px', color: '#60a5fa', fontWeight: 500 }}>Trust Score</span>
                <span style={{ fontSize: '15px', color: '#ffffff', fontWeight: 700 }}>{profile.trustScore}</span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0 }}>
            <button onClick={() => setTab('connections')} className="btn-primary" style={{ padding: '11px 24px', fontSize: '15px' }}>
              Find a Helper
            </button>
            <button onClick={() => setTab('connections')} style={{
              padding: '11px 24px', fontSize: '15px', borderRadius: '9999px',
              border: '1px solid rgba(255,255,255,0.4)', background: 'transparent',
              color: '#ffffff', cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              Messages
            </button>
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
            }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ paddingTop: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

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
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>🤝</div>
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
                        background: 'linear-gradient(135deg, #34c759, #30d158)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '16px', fontWeight: 700, color: '#fff', flexShrink: 0,
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
                      otherUserName={conn.otherUserName || 'them'}
                      onConfirm={() => confirmTrust(conn.id)}
                      confirming={confirmingTrust === conn.id}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* My Requests tab */}
          {tab === 'needs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h2 style={{ fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif", fontSize: '28px', fontWeight: 600, color: '#1d1d1f', margin: 0 }}>
                My Help Requests
              </h2>
              {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[1,2].map(i => (
                    <div key={i} style={{ background: '#f5f5f7', borderRadius: '18px', height: '80px', animation: 'shimmer 1.5s ease-in-out infinite' }} />
                  ))}
                </div>
              )}
              {!loading && myNeeds.length === 0 && (
                <div style={{ background: '#ffffff', borderRadius: '18px', textAlign: 'center', padding: '48px 24px', border: '1px solid #e0e0e0' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div>
                  <p style={{ fontSize: '17px', fontWeight: 600, color: '#1d1d1f', marginBottom: '6px' }}>No requests yet</p>
                  <p style={{ fontSize: '14px', color: '#7a7a7a', marginBottom: '20px' }}>Post a request and helpers near you will offer to assist. It only takes a minute.</p>
                  <button onClick={() => setTab('post')} className="btn-primary" style={{ padding: '10px 24px', fontSize: '14px' }}>
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
                          <span style={{ fontSize: '12px', background: '#fee2e2', color: '#991b1b', padding: '3px 10px', borderRadius: '9999px', fontWeight: 600 }}>Urgent</span>
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
                          <span style={{ fontSize: '13px', color: '#991b1b', flex: 1 }}>Cancel this request?</span>
                          <button onClick={() => { cancelNeed(need.id); setCancelConfirm(null); }} style={{ fontSize: '12px', fontWeight: 600, color: '#fff', background: '#cc0000', border: 'none', borderRadius: '9999px', padding: '5px 14px', cursor: 'pointer' }}>Yes, cancel</button>
                          <button onClick={() => setCancelConfirm(null)} style={{ fontSize: '12px', color: '#7a7a7a', background: 'none', border: '1px solid #e0e0e0', borderRadius: '9999px', padding: '5px 12px', cursor: 'pointer' }}>Keep</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <p style={{ fontSize: '13px', color: '#a0a0a5', margin: 0 }}>No applicants yet</p>
                          <button onClick={() => setCancelConfirm(need.id)} style={{ fontSize: '12px', color: '#cc0000', background: 'none', border: '1px solid #fecaca', borderRadius: '9999px', padding: '4px 14px', cursor: 'pointer' }}>
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {need.status === 'ASSIGNED' && (
                    <div style={{ borderTop: '1px solid #f0f0f0', marginTop: '14px', paddingTop: '14px' }}>
                      <button onClick={() => completeNeed(need.id)} className="btn-primary"
                        style={{ width: '100%', background: '#34c759', padding: '11px', fontSize: '15px' }}>
                        Mark as Complete
                      </button>
                    </div>
                  )}
                  {need.status === 'COMPLETED' && !reviewedNeeds.has(need.id) && need.applications?.some(a => a.status === 'ACCEPTED') && (
                    <div style={{ borderTop: '1px solid #f0f0f0', marginTop: '14px', paddingTop: '14px' }}>
                      {reviewingNeed === need.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <p style={{ fontSize: '14px', fontWeight: 600, color: '#1d1d1f' }}>Rate your helper</p>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {[1,2,3,4,5].map(s => (
                              <button key={s} type="button" onClick={() => setReviewForm(f => ({...f, rating: s}))}
                                style={{ fontSize: '28px', background: 'none', border: 'none', cursor: 'pointer', color: s <= reviewForm.rating ? '#ff9500' : '#d1d5db', transition: 'transform 0.1s' }}
                                onMouseEnter={e => e.target.style.transform = 'scale(1.2)'}
                                onMouseLeave={e => e.target.style.transform = 'scale(1)'}>★</button>
                            ))}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {REVIEW_TAGS.map(tag => (
                              <button key={tag} type="button" onClick={() => toggleTag(tag)} style={{
                                fontSize: '13px', padding: '5px 14px', borderRadius: '9999px',
                                border: '1px solid', transition: 'all 0.15s',
                                borderColor: reviewForm.tags.includes(tag) ? '#0066cc' : '#d2d2d7',
                                background: reviewForm.tags.includes(tag) ? '#0066cc' : '#fff',
                                color: reviewForm.tags.includes(tag) ? '#fff' : '#7a7a7a', cursor: 'pointer',
                              }}>{tag}</button>
                            ))}
                          </div>
                          <textarea value={reviewForm.comment} onChange={e => setReviewForm(f => ({...f, comment: e.target.value}))}
                            placeholder="Add a comment (optional)" rows={2}
                            style={{ width: '100%', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '10px 14px', fontSize: '14px', outline: 'none', fontFamily: 'inherit', resize: 'vertical' }} />
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#ff3b30', cursor: 'pointer' }}>
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
                    <p style={{ fontSize: '13px', color: '#166534', fontWeight: 500, borderTop: '1px solid #f0f0f0', marginTop: '12px', paddingTop: '12px' }}>Review submitted</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Post Request tab */}
          {tab === 'post' && (
            <div style={{ background: '#ffffff', borderRadius: '18px', padding: '32px', border: '1px solid #e0e0e0' }}>
              <h2 style={{
                fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif",
                fontSize: '28px', fontWeight: 600, color: '#1d1d1f',
                letterSpacing: '-0.4px', marginBottom: '28px', marginTop: 0,
              }}>
                Post a Help Request
              </h2>
              <form onSubmit={postNeed} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div className="field">
                  <label className="field-label">What do you need?</label>
                  <input value={needForm.title} onChange={e => setNeedForm(f => ({...f, title: e.target.value}))}
                    placeholder="e.g. Help with grocery shopping" className="input-field" required />
                </div>
                <div className="field">
                  <label className="field-label">Description</label>
                  <textarea value={needForm.description} onChange={e => setNeedForm(f => ({...f, description: e.target.value}))}
                    placeholder="Add more details..." rows={3}
                    style={{ width: '100%', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '12px 16px', fontSize: '15px', outline: 'none', fontFamily: 'inherit', resize: 'vertical', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                    onFocus={e => { e.target.style.borderColor = '#0066cc'; e.target.style.boxShadow = '0 0 0 3px rgba(0,102,204,0.12)'; }}
                    onBlur={e => { e.target.style.borderColor = '#e0e0e0'; e.target.style.boxShadow = 'none'; }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="field">
                    <label className="field-label">Category</label>
                    <select value={needForm.category} onChange={e => setNeedForm(f => ({...f, category: e.target.value}))}
                      style={{ width: '100%', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '12px 16px', fontSize: '15px', outline: 'none', background: '#fff', fontFamily: 'inherit', transition: 'border-color 0.15s' }}>
                      <option value="COMPANIONSHIP">Companionship</option>
                      <option value="TRANSPORTATION">Transportation</option>
                      <option value="ERRANDS">Errands</option>
                      <option value="CLEANING">Cleaning</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">Urgency</label>
                    <select value={needForm.urgency} onChange={e => setNeedForm(f => ({...f, urgency: e.target.value}))}
                      style={{ width: '100%', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '12px 16px', fontSize: '15px', outline: 'none', background: '#fff', fontFamily: 'inherit' }}>
                      <option value="NORMAL">Normal</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>
                </div>
                <div style={{ background: '#f0f6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '12px 16px', fontSize: '13px', color: '#1d4ed8' }}>
                  {locationStatus === 'asking' && 'Getting your location...'}
                  {locationStatus === 'granted' && 'Location captured — helpers nearby will see your request first.'}
                  {locationStatus === 'denied' && 'Location not available — request will still be visible to all helpers.'}
                  {locationStatus === 'idle' && (
                    <button type="button" onClick={requestLocation} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#1d4ed8', padding: 0, textDecoration: 'underline' }}>
                      Allow location so nearby helpers find you faster
                    </button>
                  )}
                </div>
                {postMsg && <p style={{ fontSize: '14px', color: postMsg.includes('!') ? '#166534' : '#991b1b', fontWeight: 500 }}>{postMsg}</p>}
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
