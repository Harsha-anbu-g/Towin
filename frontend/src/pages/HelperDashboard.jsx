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
    try { const r = await api.get('/connections'); setConnections(r.data); } catch {}
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

  async function apply(needId) {
    setApplying(needId);
    try {
      await api.post(`/needs/${needId}/apply`);
      setApplyMsg(prev => ({...prev, [needId]: 'Applied!'}));
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

  const REVIEW_TAGS = ['Friendly', 'Punctual', 'Respectful', 'Helpful', 'Patient'];

  async function submitElderReview(conn) {
    setSubmittingReview(true);
    try {
      await api.post('/reviews', { revieweeId: conn.otherUserId, ...reviewForm, comment: reviewForm.comment || null });
      setReviewedConns(prev => new Set([...prev, conn.id]));
      setReviewingConn(null);
      setReviewForm({ rating: 5, tags: [], comment: '', safetyConcern: false });
    } catch (err) { alert(err?.response?.data?.message || 'Could not submit review.'); }
    finally { setSubmittingReview(false); }
  }

  const trustLabel = (level) => ({ DISCOVERED: 'Discovered', MESSAGING: 'Messaging', PHONE_CALL: 'Phone Call', VIDEO_CALL: 'Video Call', VERIFIED: 'Verified', FIRST_MEET: 'First Meet', TRUSTED: 'Trusted' }[level] || level);
  const connectedElderIds = new Set(connections.map(c => c.otherUserId));
  const pendingIncoming = connections.filter(c => c.status === 'PENDING' && !c.initiatedByMe);
  const tabs = [
    ['connections', `Connections${pendingIncoming.length > 0 ? ` (${pendingIncoming.length})` : ''}`],
    ['browse', 'Browse Needs'],
    ['discover', 'Discover Elders'],
  ];

  const RadiusBar = () => (
    <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
      <p style={{ fontSize: '13px', color: '#6e6e73' }}>
        {locationStatus === 'asking' && 'Getting your location...'}
        {locationStatus === 'granted' && `Showing within ${radiusKm} km of you`}
        {locationStatus === 'denied' && 'Location denied — showing all'}
        {locationStatus === 'idle' && 'Detecting location...'}
      </p>
      {locationStatus === 'granted' && (
        <select value={radiusKm} onChange={e => setRadiusKm(Number(e.target.value))}
          style={{ border: '1px solid #d2d2d7', borderRadius: '9999px', padding: '5px 12px', fontSize: '13px', outline: 'none', background: '#fff', cursor: 'pointer' }}>
          {[5,10,25,50,100].map(v => <option key={v} value={v}>{v} km</option>)}
        </select>
      )}
    </div>
  );

  return (
    <div style={{ minHeight: '100svh', background: 'var(--surface)' }}>
      <NavBar />
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 16px 48px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Profile hero */}
        {profile && (
          <BlurFade delay={1}>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ height: '120px', position: 'relative', overflow: 'hidden' }}>
              <LazyLoadImage
                src={unsplash('photo-1529156069898-49953e39b3ac', 800, 240)}
                alt=""
                effect="blur"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                wrapperProps={{ style: { width: '100%', height: '100%', display: 'block' } }}
              />
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(135deg, rgba(6,95,70,0.75) 0%, rgba(37,99,235,0.5) 100%)',
              }} />
              <div style={{
                position: 'absolute', bottom: '-32px', left: '24px',
                width: '64px', height: '64px', borderRadius: '50%',
                background: profile.photoUrl ? 'transparent' : 'linear-gradient(135deg, #059669, #10b981)',
                border: '3px solid var(--canvas)',
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
              <p className="font-display" style={{ fontSize: '22px', color: 'var(--ink)', letterSpacing: '-0.2px' }}>
                {profile.name || 'Set up your profile'}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                {profile.city && <span style={{ fontSize: '14px', color: 'var(--ink-2)' }}>{profile.city}</span>}
                <TrustBadge tier={profile.trustTier} score={profile.trustScore} />
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

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {tabs.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: '12px 20px', fontSize: '14px', fontWeight: tab === id ? 600 : 400,
              color: tab === id ? 'var(--blue)' : 'var(--ink-2)',
              background: 'none', border: 'none',
              borderBottom: tab === id ? '2px solid var(--blue)' : '2px solid transparent',
              cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap', marginBottom: '-1px',
              fontFamily: 'var(--font-body)',
            }}>{label}</button>
          ))}
        </div>

        {/* Connections */}
        {tab === 'connections' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {connections.length === 0 && (
              <div className="card" style={{ textAlign: 'center', padding: '64px 24px' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#dcfce7', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </div>
                <p style={{ fontSize: '16px', fontWeight: 600, color: '#1d1d1f', marginBottom: '6px' }}>No connections yet</p>
                <p style={{ fontSize: '14px', color: '#86868b' }}>Discover elders near you and send a connection request.</p>
                <button onClick={() => setTab('discover')} className="btn-primary" style={{ marginTop: '16px', padding: '10px 24px', fontSize: '14px' }}>
                  Discover Elders
                </button>
              </div>
            )}
            {connections.map((conn, i) => (
              <div key={conn.id} className="card card-lift" style={{ padding: '18px 20px', animation: `fadeSlideUp 0.4s ease ${i * 0.05}s both` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '50%',
                      background: 'linear-gradient(135deg, #0066cc, #5856d6)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '15px', fontWeight: 700, color: '#fff', flexShrink: 0,
                    }}>
                      {initials(conn.otherUserName)}
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '15px', color: '#1d1d1f' }}>{conn.otherUserName || 'Elder'}</p>
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
                        {conn.currentTrustLevel === 'TRUSTED' && !reviewedConns.has(conn.id) && (
                          <button onClick={() => setReviewingConn(reviewingConn === conn.id ? null : conn.id)} className="btn-secondary" style={{ padding: '7px 16px', fontSize: '13px' }}>
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
                          borderColor: reviewForm.tags.includes(t) ? '#0066cc' : '#d2d2d7',
                          background: reviewForm.tags.includes(t) ? '#0066cc' : '#fff',
                          color: reviewForm.tags.includes(t) ? '#fff' : '#6e6e73',
                        }}>{t}</button>
                      ))}
                    </div>
                    <textarea value={reviewForm.comment} onChange={e => setReviewForm(f => ({...f, comment: e.target.value}))}
                      placeholder="Any comments? (optional)" rows={2}
                      style={{ width: '100%', border: '1px solid #d2d2d7', borderRadius: '12px', padding: '10px 14px', fontSize: '14px', outline: 'none', fontFamily: 'inherit' }} />
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
              </div>
            ))}
          </div>
        )}

        {/* Browse Needs */}
        {tab === 'browse' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <RadiusBar />
            {needs.length === 0 && locationStatus !== 'asking' && (
              <div className="card" style={{ textAlign: 'center', padding: '64px 24px' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#dbeafe', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0066cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                </div>
                <p style={{ fontSize: '16px', fontWeight: 600, color: '#1d1d1f', marginBottom: '6px' }}>No requests found</p>
                <p style={{ fontSize: '14px', color: '#86868b' }}>
                  {locationStatus === 'granted' ? `No open requests within ${radiusKm} km. Try a larger radius.` : 'No open requests right now.'}
                </p>
              </div>
            )}
            {needs.map((need, i) => (
              <div key={need.id} className="card card-lift" style={{ padding: '20px', animation: `fadeSlideUp 0.4s ease ${i * 0.05}s both` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: '16px', color: '#1d1d1f' }}>{need.title}</p>
                    {need.description && <p style={{ fontSize: '14px', color: '#6e6e73', marginTop: '4px', lineHeight: 1.5 }}>{need.description}</p>}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                      <span style={{ fontSize: '12px', background: '#f3f4f6', color: '#6b7280', padding: '3px 10px', borderRadius: '9999px' }}>{need.category}</span>
                      {need.urgency === 'URGENT' && (
                        <span style={{ fontSize: '12px', background: '#fee2e2', color: '#991b1b', padding: '3px 10px', borderRadius: '9999px', fontWeight: 600 }}>Urgent</span>
                      )}
                      {need.distanceKm != null && (
                        <span style={{ fontSize: '12px', color: '#86868b', padding: '3px 0' }}>{need.distanceKm} km away</span>
                      )}
                    </div>
                    <p style={{ fontSize: '12px', color: '#86868b', marginTop: '6px' }}>Posted by {need.elderName}</p>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    <button onClick={() => apply(need.id)} disabled={applying === need.id || !!applyMsg[need.id]}
                      className={applyMsg[need.id]?.includes('!') ? '' : 'btn-primary'}
                      style={applyMsg[need.id]?.includes('!') ? {
                        fontSize: '13px', padding: '7px 16px', borderRadius: '9999px', border: 'none',
                        background: '#dcfce7', color: '#166534', cursor: 'default', fontWeight: 600
                      } : { padding: '8px 18px', fontSize: '13px' }}>
                      {applying === need.id ? '...' : applyMsg[need.id] || 'Apply'}
                    </button>
                  </div>
                </div>
                {applyMsg[need.id] && !applyMsg[need.id].includes('!') && (
                  <p style={{ fontSize: '12px', color: '#991b1b', marginTop: '8px' }}>{applyMsg[need.id]}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Discover Elders */}
        {tab === 'discover' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <RadiusBar />
            {elders.length === 0 && (
              <div className="card" style={{ textAlign: 'center', padding: '64px 24px' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#dbeafe', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0066cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                  </svg>
                </div>
                <p style={{ fontSize: '16px', fontWeight: 600, color: '#1d1d1f', marginBottom: '6px' }}>No elders found nearby</p>
                <p style={{ fontSize: '14px', color: '#86868b' }}>Try a larger radius or check back later.</p>
              </div>
            )}
            {elders.map((elder, i) => {
              const alreadyConnected = connectedElderIds.has(elder.userId);
              const sent = connectMsg[elder.userId];
              return (
                <div key={elder.userId} className="card card-lift" style={{ padding: '20px', animation: `fadeSlideUp 0.4s ease ${i * 0.05}s both` }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '14px', flex: 1 }}>
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
                          <p style={{ fontWeight: 600, fontSize: '16px', color: '#1d1d1f' }}>{elder.name || 'Elder'}</p>
                          <TrustBadge tier={elder.trustTier} score={elder.trustScore} />
                        </div>
                        {elder.city && <p style={{ fontSize: '13px', color: '#6e6e73', marginTop: '2px' }}>{elder.city}</p>}
                        {elder.distanceKm != null && (
                          <p style={{ fontSize: '12px', color: '#86868b' }}>{Math.round(elder.distanceKm * 10) / 10} km away</p>
                        )}
                        {elder.bio && <p style={{ fontSize: '14px', color: '#6e6e73', marginTop: '6px', lineHeight: 1.5 }}>{elder.bio}</p>}
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
  );
}
