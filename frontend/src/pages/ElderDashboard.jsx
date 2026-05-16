import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';
import NavBar from '../components/NavBar';
import TrustBadge from '../components/TrustBadge';
import BlurFade from '../components/magic/BlurFade';
import api from '../api/axios';

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

  async function loadConnections() {
    try { const r = await api.get('/connections'); setConnections(r.data); } catch {}
  }
  async function loadNeeds() {
    try { const res = await api.get('/needs/mine'); setMyNeeds(res.data.content ?? []); } catch {}
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
    try { await api.post(`/connections/${connId}/respond`, { accept }); await loadConnections(); }
    catch (err) { alert(err?.response?.data?.message || 'Could not respond.'); }
    finally { setRespondingConn(null); }
  }

  async function confirmTrust(connId) {
    setConfirmingTrust(connId);
    try { await api.post(`/trust/${connId}/confirm`); await loadConnections(); }
    catch (err) { alert(err?.response?.data?.message || 'Could not confirm trust.'); }
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
    try { await api.post(`/needs/${needId}/complete`); await loadNeeds(); }
    catch { alert('Could not mark complete.'); }
  }

  async function acceptHelper(needId, helperId) {
    setAccepting(`${needId}-${helperId}`);
    try { await api.post(`/needs/${needId}/accept/${helperId}`); await loadNeeds(); }
    catch { alert('Could not accept helper.'); }
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
    } catch (err) { alert(err?.response?.data?.message || 'Could not submit review.'); }
    finally { setSubmittingReview(false); }
  }

  const trustLabel = (level) => ({ DISCOVERED: 'Discovered', MESSAGING: 'Messaging', PHONE_CALL: 'Phone Call', VIDEO_CALL: 'Video Call', VERIFIED: 'Verified', FIRST_MEET: 'First Meet', TRUSTED: 'Trusted' }[level] || level);
  const pendingIncoming = connections.filter(c => c.status === 'PENDING' && !c.initiatedByMe);
  const tabs = [
    ['connections', `Connections${pendingIncoming.length > 0 ? ` (${pendingIncoming.length})` : ''}`],
    ['needs', 'My Requests'],
    ['post', 'Post Request'],
  ];

  return (
    <div style={{ minHeight: '100svh', background: 'var(--surface)' }}>
      <NavBar />
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 16px 48px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Profile hero card */}
        {profile && (
          <BlurFade delay={1}>
          <div className="card" style={{ overflow: 'hidden' }}>
            {/* Photo cover */}
            <div style={{ height: '120px', position: 'relative', overflow: 'hidden' }}>
              <LazyLoadImage
                src={unsplash('photo-1576765974256-9b879d60a571', 800, 240)}
                alt=""
                effect="blur"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                wrapperProps={{ style: { width: '100%', height: '100%', display: 'block' } }}
              />
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(135deg, rgba(29,78,216,0.7) 0%, rgba(124,58,237,0.5) 100%)',
              }} />
              <div style={{
                position: 'absolute', bottom: '-32px', left: '24px',
                width: '64px', height: '64px', borderRadius: '50%',
                background: profile.photoUrl ? 'transparent' : 'linear-gradient(135deg, #0066cc, #5856d6)',
                border: '3px solid #fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '20px', fontWeight: 700, color: '#fff',
                overflow: 'hidden',
                boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
              }}>
                {profile.photoUrl
                  ? <img src={profile.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : initials(profile.name)
                }
              </div>
            </div>
            <div style={{ padding: '44px 24px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <p className="font-display" style={{ fontSize: '22px', color: 'var(--ink)', letterSpacing: '-0.2px' }}>
                    {profile.name || 'Set up your profile'}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                    {profile.city && <span style={{ fontSize: '14px', color: 'var(--ink-2)' }}>{profile.city}</span>}
                    <TrustBadge tier={profile.trustTier} score={profile.trustScore} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          </BlurFade>
        )}

        {/* Community photo strip */}
        <BlurFade delay={2}>
          <div className="card" style={{ padding: '20px 24px' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '14px' }}>
              Your community
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {COMMUNITY_PHOTOS.map(({ id, label }) => (
                <div key={id} style={{ borderRadius: '12px', overflow: 'hidden', aspectRatio: '1' }} className="lift">
                  <LazyLoadImage
                    src={unsplash(id, 200, 200)}
                    alt={label}
                    effect="blur"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    wrapperProps={{ style: { width: '100%', height: '100%', display: 'block' } }}
                  />
                </div>
              ))}
            </div>
          </div>
        </BlurFade>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '0' }}>
          {tabs.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: '12px 20px', fontSize: '14px', fontWeight: tab === id ? 600 : 400,
              color: tab === id ? 'var(--blue)' : 'var(--ink-2)',
              background: 'none', border: 'none',
              borderBottom: tab === id ? '2px solid var(--blue)' : '2px solid transparent',
              cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap', marginBottom: '-1px',
              fontFamily: 'var(--font-body)',
            }}>
              {label}
            </button>
          ))}
        </div>

        {/* Connections */}
        {tab === 'connections' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {connections.length === 0 && (
              <div className="card" style={{ textAlign: 'center', padding: '64px 24px' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#dbeafe', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0066cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </div>
                <p style={{ fontSize: '16px', fontWeight: 600, color: '#1d1d1f', marginBottom: '6px' }}>No connections yet</p>
                <p style={{ fontSize: '14px', color: '#86868b' }}>Helpers will send you connection requests. Check back soon.</p>
              </div>
            )}
            {connections.map((conn, i) => (
              <div key={conn.id} className="card card-lift" style={{ padding: '18px 20px', animation: `fadeSlideUp 0.4s ease ${i * 0.05}s both` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '50%',
                      background: 'linear-gradient(135deg, #34c759, #30d158)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '15px', fontWeight: 700, color: '#fff', flexShrink: 0,
                    }}>
                      {initials(conn.otherUserName)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: '15px', color: '#1d1d1f' }}>{conn.otherUserName || 'User'}</p>
                      <p style={{ fontSize: '12px', color: '#86868b', marginTop: '2px' }}>{trustLabel(conn.currentTrustLevel)}</p>
                      {conn.requestMessage && (
                        <p style={{ fontSize: '12px', color: '#6e6e73', fontStyle: 'italic', marginTop: '3px' }}>"{conn.requestMessage}"</p>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
                    {conn.status === 'ACTIVE' && (
                      <>
                        {!conn.confirmedByMe ? (
                          <button onClick={() => confirmTrust(conn.id)} disabled={confirmingTrust === conn.id} className="btn-ghost">
                            {confirmingTrust === conn.id ? '...' : 'Confirm Trust'}
                          </button>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#166534', fontWeight: 500 }}>Confirmed</span>
                        )}
                        <button onClick={() => navigate(`/messages/${conn.id}`)} className="btn-primary" style={{ padding: '7px 16px', fontSize: '13px' }}>
                          Message
                        </button>
                      </>
                    )}
                    {conn.status === 'PENDING' && !conn.initiatedByMe && (
                      <>
                        <button onClick={() => respondToConnection(conn.id, true)} disabled={respondingConn === conn.id}
                          className="btn-primary" style={{ padding: '7px 16px', fontSize: '13px' }}>Accept</button>
                        <button onClick={() => respondToConnection(conn.id, false)} disabled={respondingConn === conn.id}
                          className="btn-ghost">Decline</button>
                      </>
                    )}
                    <span style={statusStyle(conn.status === 'PENDING' && conn.initiatedByMe ? 'PENDING' : conn.status)}>
                      {conn.status === 'PENDING' && conn.initiatedByMe ? 'Waiting' : conn.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* My Requests */}
        {tab === 'needs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {myNeeds.length === 0 && (
              <div className="card" style={{ textAlign: 'center', padding: '64px 24px' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#dbeafe', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0066cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  </svg>
                </div>
                <p style={{ fontSize: '16px', fontWeight: 600, color: '#1d1d1f', marginBottom: '6px' }}>No requests yet</p>
                <p style={{ fontSize: '14px', color: '#86868b' }}>Post a request to get help from helpers near you.</p>
                <button onClick={() => setTab('post')} className="btn-primary" style={{ marginTop: '16px', padding: '10px 24px', fontSize: '14px' }}>
                  Post a Request
                </button>
              </div>
            )}
            {myNeeds.map((need, i) => (
              <div key={need.id} className="card card-lift" style={{ padding: '20px', animation: `fadeSlideUp 0.4s ease ${i * 0.06}s both` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '4px' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: '16px', color: '#1d1d1f' }}>{need.title}</p>
                    {need.description && <p style={{ fontSize: '14px', color: '#6e6e73', marginTop: '4px', lineHeight: 1.5 }}>{need.description}</p>}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', background: '#f3f4f6', color: '#6b7280', padding: '3px 10px', borderRadius: '9999px' }}>{need.category}</span>
                      {need.urgency === 'URGENT' && (
                        <span style={{ fontSize: '12px', background: '#fee2e2', color: '#991b1b', padding: '3px 10px', borderRadius: '9999px', fontWeight: 600 }}>Urgent</span>
                      )}
                    </div>
                  </div>
                  <span style={statusStyle(need.status)}>{need.status}</span>
                </div>

                {need.status === 'OPEN' && need.applications?.length > 0 && (
                  <div style={{ borderTop: '1px solid #f0f0f0', marginTop: '14px', paddingTop: '14px' }}>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                      {need.applications.length} Applicant{need.applications.length !== 1 ? 's' : ''}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {need.applications.map(app => (
                        <div key={app.helperId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f9fafb', borderRadius: '12px', padding: '10px 14px', border: '1px solid #f0f0f0' }}>
                          <div>
                            <p style={{ fontSize: '14px', fontWeight: 500, color: '#1d1d1f' }}>{app.helperName}</p>
                            {app.message && <p style={{ fontSize: '12px', color: '#6e6e73', marginTop: '2px' }}>{app.message}</p>}
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
                  <p style={{ fontSize: '13px', color: '#86868b', borderTop: '1px solid #f0f0f0', marginTop: '12px', paddingTop: '12px' }}>No applicants yet</p>
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
                              color: reviewForm.tags.includes(tag) ? '#fff' : '#6e6e73', cursor: 'pointer',
                            }}>{tag}</button>
                          ))}
                        </div>
                        <textarea value={reviewForm.comment} onChange={e => setReviewForm(f => ({...f, comment: e.target.value}))}
                          placeholder="Add a comment (optional)" rows={2}
                          style={{ width: '100%', border: '1px solid #d2d2d7', borderRadius: '12px', padding: '10px 14px', fontSize: '14px', outline: 'none', fontFamily: 'inherit', resize: 'vertical' }} />
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

        {/* Post Request */}
        {tab === 'post' && (
          <div className="card animate-scale" style={{ padding: '28px' }}>
            <p style={{ fontSize: '22px', fontWeight: 700, color: '#1d1d1f', letterSpacing: '-0.4px', marginBottom: '24px',
              fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif" }}>
              Post a Help Request
            </p>
            <form onSubmit={postNeed} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label className="field-label">What do you need?</label>
                <input value={needForm.title} onChange={e => setNeedForm(f => ({...f, title: e.target.value}))}
                  placeholder="e.g. Help with grocery shopping" className="input-field" required />
              </div>
              <div>
                <label className="field-label">Description</label>
                <textarea value={needForm.description} onChange={e => setNeedForm(f => ({...f, description: e.target.value}))}
                  placeholder="Add more details..." rows={3}
                  style={{ width: '100%', border: '1px solid #d2d2d7', borderRadius: '12px', padding: '12px 16px', fontSize: '15px', outline: 'none', fontFamily: 'inherit', resize: 'vertical', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                  onFocus={e => { e.target.style.borderColor = '#0066cc'; e.target.style.boxShadow = '0 0 0 3px rgba(0,102,204,0.12)'; }}
                  onBlur={e => { e.target.style.borderColor = '#d2d2d7'; e.target.style.boxShadow = 'none'; }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label className="field-label">Category</label>
                  <select value={needForm.category} onChange={e => setNeedForm(f => ({...f, category: e.target.value}))}
                    style={{ width: '100%', border: '1px solid #d2d2d7', borderRadius: '12px', padding: '12px 16px', fontSize: '15px', outline: 'none', background: '#fff', fontFamily: 'inherit', transition: 'border-color 0.15s' }}>
                    <option value="COMPANIONSHIP">Companionship</option>
                    <option value="TRANSPORTATION">Transportation</option>
                    <option value="ERRANDS">Errands</option>
                    <option value="CLEANING">Cleaning</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Urgency</label>
                  <select value={needForm.urgency} onChange={e => setNeedForm(f => ({...f, urgency: e.target.value}))}
                    style={{ width: '100%', border: '1px solid #d2d2d7', borderRadius: '12px', padding: '12px 16px', fontSize: '15px', outline: 'none', background: '#fff', fontFamily: 'inherit' }}>
                    <option value="NORMAL">Normal</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>
              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '12px', padding: '12px 16px', fontSize: '13px', color: '#0369a1' }}>
                {locationStatus === 'asking' && 'Getting your location...'}
                {locationStatus === 'granted' && 'Location captured — helpers nearby will see your request first.'}
                {locationStatus === 'denied' && 'Location not available — request will still be visible to all helpers.'}
                {locationStatus === 'idle' && (
                  <button type="button" onClick={requestLocation} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#0369a1', padding: 0, textDecoration: 'underline' }}>
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
  );
}
