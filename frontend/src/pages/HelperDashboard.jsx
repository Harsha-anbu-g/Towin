import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import TrustBadge from '../components/TrustBadge';
import api from '../api/axios';

const card = {
  background: '#fff',
  border: '1px solid #d2d2d7',
  borderRadius: '18px',
  padding: '20px',
};

const statusBadge = (status) => {
  const map = {
    ACTIVE:  { bg: '#d4edda', color: '#155724' },
    PENDING: { bg: '#fff3cd', color: '#b45309' },
    DECLINED: { bg: '#ffe0e0', color: '#c62828' },
  };
  const s = map[status] ?? { bg: '#f2f2f7', color: '#6e6e73' };
  return {
    background: s.bg, color: s.color,
    fontSize: '12px', fontWeight: 500,
    padding: '3px 10px', borderRadius: '9999px', display: 'inline-block',
  };
};

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
      let res;
      if (coords) {
        res = await api.get(`/needs/nearby?lat=${coords.lat}&lng=${coords.lng}&radiusKm=${radiusKm}`);
      } else {
        res = await api.get('/needs/open');
      }
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
        setLocation(loc);
        setLocationStatus('granted');
        loadNeeds(loc);
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
    try {
      await api.post(`/connections/${connId}/respond`, { accept });
      await loadConnections();
    } catch (err) {
      alert(err?.response?.data?.message || 'Could not respond.');
    } finally { setRespondingConn(null); }
  }

  async function confirmTrust(connId) {
    setConfirmingTrust(connId);
    try {
      await api.post(`/trust/${connId}/confirm`);
      await loadConnections();
    } catch (err) {
      alert(err?.response?.data?.message || 'Could not confirm trust.');
    } finally { setConfirmingTrust(null); }
  }

  const REVIEW_TAGS = ['Friendly', 'Punctual', 'Respectful', 'Helpful', 'Patient'];

  async function submitElderReview(conn) {
    setSubmittingReview(true);
    try {
      await api.post('/reviews', {
        revieweeId: conn.otherUserId,
        rating: reviewForm.rating,
        tags: reviewForm.tags,
        comment: reviewForm.comment || null,
        safetyConcern: reviewForm.safetyConcern,
      });
      setReviewedConns(prev => new Set([...prev, conn.id]));
      setReviewingConn(null);
      setReviewForm({ rating: 5, tags: [], comment: '', safetyConcern: false });
    } catch (err) {
      alert(err?.response?.data?.message || 'Could not submit review.');
    } finally { setSubmittingReview(false); }
  }

  const trustLabel = (level) => {
    const map = {
      DISCOVERED: 'Discovered', MESSAGING: 'Messaging', PHONE_CALL: 'Phone Call',
      VIDEO_CALL: 'Video Call', VERIFIED: 'Verified', FIRST_MEET: 'First Meet', TRUSTED: 'Trusted'
    };
    return map[level] || level;
  };

  const connectedElderIds = new Set(connections.map(c => c.otherUserId));
  const pendingIncoming = connections.filter(c => c.status === 'PENDING' && !c.initiatedByMe);

  const tabs = [
    ['connections', `Connections${pendingIncoming.length > 0 ? ` (${pendingIncoming.length})` : ''}`],
    ['browse', 'Browse Needs'],
    ['discover', 'Discover Elders'],
  ];

  const initials = (name) => name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';

  return (
    <div style={{ minHeight: '100svh', background: '#f5f5f7' }}>
      <NavBar />
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {profile && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '52px', height: '52px', borderRadius: '50%',
                background: '#d4edda', color: '#155724',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '18px', fontWeight: 600, flexShrink: 0,
              }}>
                {initials(profile.name)}
              </div>
              <div>
                <p style={{ fontWeight: 600, fontSize: '17px', color: '#1d1d1f' }}>
                  {profile.name || 'Set up your profile'}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  {profile.city && <span style={{ fontSize: '13px', color: '#6e6e73' }}>{profile.city}</span>}
                  <TrustBadge tier={profile.trustTier} score={profile.trustScore} />
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #d2d2d7' }}>
          {tabs.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: tab === id ? 600 : 400,
              color: tab === id ? '#0066cc' : '#6e6e73',
              background: 'none',
              border: 'none',
              borderBottom: tab === id ? '2px solid #0066cc' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
              marginBottom: '-1px',
            }}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'connections' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {connections.length === 0 && (
              <div style={{ ...card, textAlign: 'center', padding: '48px 24px' }}>
                <p style={{ fontSize: '14px', color: '#86868b' }}>No connections yet. Discover elders and send a request.</p>
              </div>
            )}
            {connections.map(conn => (
              <div key={conn.id} style={card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '50%',
                      background: '#d6e8ff', color: '#0066cc',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '14px', fontWeight: 600, flexShrink: 0,
                    }}>
                      {initials(conn.otherUserName)}
                    </div>
                    <div>
                      <p style={{ fontWeight: 500, fontSize: '15px', color: '#1d1d1f' }}>{conn.otherUserName || 'Elder'}</p>
                      <p style={{ fontSize: '12px', color: '#86868b', marginTop: '2px' }}>{trustLabel(conn.currentTrustLevel)}</p>
                      {conn.requestMessage && (
                        <p style={{ fontSize: '12px', color: '#86868b', fontStyle: 'italic', marginTop: '2px' }}>"{conn.requestMessage}"</p>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
                    {conn.status === 'ACTIVE' && (
                      <>
                        {!conn.confirmedByMe ? (
                          <button onClick={() => confirmTrust(conn.id)} disabled={confirmingTrust === conn.id}
                            style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '9999px', border: '1px solid #d2d2d7', background: '#fff', color: '#1d1d1f', cursor: 'pointer' }}>
                            {confirmingTrust === conn.id ? '...' : 'Confirm Trust'}
                          </button>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#155724' }}>Confirmed</span>
                        )}
                        <button onClick={() => navigate(`/messages/${conn.id}`)}
                          style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '9999px', border: 'none', background: '#0066cc', color: '#fff', cursor: 'pointer' }}>
                          Message
                        </button>
                        {conn.currentTrustLevel === 'TRUSTED' && !reviewedConns.has(conn.id) && (
                          <button onClick={() => setReviewingConn(reviewingConn === conn.id ? null : conn.id)}
                            style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '9999px', border: '1px solid #0066cc', background: '#fff', color: '#0066cc', cursor: 'pointer' }}>
                            Review Elder
                          </button>
                        )}
                        {reviewedConns.has(conn.id) && (
                          <span style={{ fontSize: '12px', color: '#155724' }}>Reviewed</span>
                        )}
                      </>
                    )}
                    {conn.status === 'PENDING' && !conn.initiatedByMe && (
                      <>
                        <button onClick={() => respondToConnection(conn.id, true)} disabled={respondingConn === conn.id}
                          style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '9999px', border: 'none', background: '#0066cc', color: '#fff', cursor: 'pointer' }}>
                          Accept
                        </button>
                        <button onClick={() => respondToConnection(conn.id, false)} disabled={respondingConn === conn.id}
                          style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '9999px', border: '1px solid #d2d2d7', background: '#fff', color: '#6e6e73', cursor: 'pointer' }}>
                          Decline
                        </button>
                      </>
                    )}
                    <span style={statusBadge(conn.status === 'PENDING' && conn.initiatedByMe ? 'PENDING' : conn.status)}>
                      {conn.status === 'PENDING' && conn.initiatedByMe ? 'Waiting' : conn.status}
                    </span>
                  </div>
                </div>

                {reviewingConn === conn.id && (
                  <div style={{ borderTop: '1px solid #f0f0f0', marginTop: '16px', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: '#1d1d1f' }}>Rate {conn.otherUserName || 'this elder'}</p>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {[1,2,3,4,5].map(s => (
                        <button key={s} onClick={() => setReviewForm(f => ({...f, rating: s}))}
                          style={{ fontSize: '24px', background: 'none', border: 'none', cursor: 'pointer', color: s <= reviewForm.rating ? '#ff9500' : '#d2d2d7' }}>★</button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {REVIEW_TAGS.map(t => (
                        <button key={t} onClick={() => setReviewForm(f => ({
                          ...f, tags: f.tags.includes(t) ? f.tags.filter(x => x !== t) : [...f.tags, t]
                        }))}
                          style={{
                            fontSize: '12px', padding: '4px 12px', borderRadius: '9999px',
                            border: '1px solid',
                            borderColor: reviewForm.tags.includes(t) ? '#0066cc' : '#d2d2d7',
                            background: reviewForm.tags.includes(t) ? '#0066cc' : '#fff',
                            color: reviewForm.tags.includes(t) ? '#fff' : '#6e6e73',
                            cursor: 'pointer',
                          }}>
                          {t}
                        </button>
                      ))}
                    </div>
                    <textarea value={reviewForm.comment} onChange={e => setReviewForm(f => ({...f, comment: e.target.value}))}
                      placeholder="Any comments? (optional)" rows={2}
                      style={{ width: '100%', border: '1px solid #d2d2d7', borderRadius: '10px', padding: '8px 12px', fontSize: '14px', outline: 'none', fontFamily: 'inherit' }} />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#ff3b30', cursor: 'pointer' }}>
                      <input type="checkbox" checked={reviewForm.safetyConcern}
                        onChange={e => setReviewForm(f => ({...f, safetyConcern: e.target.checked}))} />
                      Report a safety concern
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => submitElderReview(conn)} disabled={submittingReview}
                        style={{ flex: 1, background: '#0066cc', color: '#fff', border: 'none', borderRadius: '9999px', padding: '9px', fontSize: '14px', cursor: 'pointer' }}>
                        {submittingReview ? 'Submitting...' : 'Submit Review'}
                      </button>
                      <button onClick={() => setReviewingConn(null)}
                        style={{ padding: '9px 16px', fontSize: '14px', border: '1px solid #d2d2d7', borderRadius: '9999px', background: '#fff', color: '#6e6e73', cursor: 'pointer' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'browse' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ ...card, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <p style={{ fontSize: '13px', color: '#6e6e73' }}>
                {locationStatus === 'asking' && 'Getting your location...'}
                {locationStatus === 'granted' && `Showing needs within ${radiusKm} km`}
                {locationStatus === 'denied' && 'Location denied — showing all needs'}
                {locationStatus === 'idle' && 'Detecting location...'}
              </p>
              {locationStatus === 'granted' && (
                <select value={radiusKm} onChange={e => setRadiusKm(Number(e.target.value))}
                  style={{ border: '1px solid #d2d2d7', borderRadius: '8px', padding: '4px 8px', fontSize: '13px', outline: 'none', background: '#fff' }}>
                  <option value={5}>5 km</option>
                  <option value={10}>10 km</option>
                  <option value={25}>25 km</option>
                  <option value={50}>50 km</option>
                  <option value={100}>100 km</option>
                </select>
              )}
            </div>

            {needs.length === 0 && locationStatus !== 'asking' && (
              <div style={{ ...card, textAlign: 'center', padding: '48px 24px' }}>
                <p style={{ fontSize: '14px', color: '#86868b' }}>
                  {locationStatus === 'granted' ? `No open requests within ${radiusKm} km. Try a larger radius.` : 'No open requests right now.'}
                </p>
              </div>
            )}
            {needs.map(need => (
              <div key={need.id} style={card}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: '15px', color: '#1d1d1f' }}>{need.title}</p>
                    {need.description && <p style={{ fontSize: '14px', color: '#6e6e73', marginTop: '4px' }}>{need.description}</p>}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                      <span style={{ fontSize: '12px', background: '#f2f2f7', color: '#6e6e73', padding: '2px 8px', borderRadius: '9999px' }}>{need.category}</span>
                      {need.urgency === 'URGENT' && (
                        <span style={{ fontSize: '12px', background: '#ffe0e0', color: '#c62828', padding: '2px 8px', borderRadius: '9999px' }}>Urgent</span>
                      )}
                      {need.distanceKm != null && (
                        <span style={{ fontSize: '12px', color: '#86868b' }}>{need.distanceKm} km away</span>
                      )}
                    </div>
                    <p style={{ fontSize: '12px', color: '#86868b', marginTop: '6px' }}>Posted by {need.elderName}</p>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    <button
                      onClick={() => apply(need.id)}
                      disabled={applying === need.id || !!applyMsg[need.id]}
                      style={{
                        fontSize: '13px', padding: '7px 16px', borderRadius: '9999px', border: 'none',
                        background: applyMsg[need.id]?.includes('!') ? '#d4edda' : '#0066cc',
                        color: applyMsg[need.id]?.includes('!') ? '#155724' : '#fff',
                        cursor: applying === need.id || !!applyMsg[need.id] ? 'default' : 'pointer',
                      }}>
                      {applying === need.id ? '...' : applyMsg[need.id] || 'Apply'}
                    </button>
                  </div>
                </div>
                {applyMsg[need.id] && !applyMsg[need.id].includes('!') && (
                  <p style={{ fontSize: '12px', color: '#c62828', marginTop: '8px' }}>{applyMsg[need.id]}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'discover' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ ...card, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <p style={{ fontSize: '13px', color: '#6e6e73' }}>
                {locationStatus === 'granted' ? `Showing elders within ${radiusKm} km` : 'Enable location to find elders near you'}
              </p>
              {locationStatus === 'granted' && (
                <select value={radiusKm} onChange={e => setRadiusKm(Number(e.target.value))}
                  style={{ border: '1px solid #d2d2d7', borderRadius: '8px', padding: '4px 8px', fontSize: '13px', outline: 'none', background: '#fff' }}>
                  <option value={5}>5 km</option>
                  <option value={10}>10 km</option>
                  <option value={25}>25 km</option>
                  <option value={50}>50 km</option>
                  <option value={100}>100 km</option>
                </select>
              )}
            </div>

            {elders.length === 0 && (
              <div style={{ ...card, textAlign: 'center', padding: '48px 24px' }}>
                <p style={{ fontSize: '14px', color: '#86868b' }}>No elders found nearby. Try a larger radius or check back later.</p>
              </div>
            )}
            {elders.map(elder => {
              const alreadyConnected = connectedElderIds.has(elder.userId);
              const sent = connectMsg[elder.userId];
              return (
                <div key={elder.userId} style={card}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '14px', flex: 1, minWidth: 0 }}>
                      <div style={{
                        width: '48px', height: '48px', borderRadius: '50%',
                        background: '#d6e8ff', color: '#0066cc',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '16px', fontWeight: 600, flexShrink: 0,
                      }}>
                        {elder.name ? elder.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <p style={{ fontWeight: 600, fontSize: '15px', color: '#1d1d1f' }}>{elder.name || 'Elder'}</p>
                          <TrustBadge tier={elder.trustTier} score={elder.trustScore} />
                        </div>
                        {elder.city && <p style={{ fontSize: '13px', color: '#6e6e73', marginTop: '2px' }}>{elder.city}</p>}
                        {elder.distanceKm != null && (
                          <p style={{ fontSize: '12px', color: '#86868b' }}>{Math.round(elder.distanceKm * 10) / 10} km away</p>
                        )}
                        {elder.bio && <p style={{ fontSize: '14px', color: '#6e6e73', marginTop: '6px' }}>{elder.bio}</p>}
                        {elder.interests?.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                            {elder.interests.map(i => (
                              <span key={i} style={{ fontSize: '12px', background: '#d6e8ff', color: '#004499', padding: '2px 8px', borderRadius: '9999px' }}>{i}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      {alreadyConnected ? (
                        <span style={{ fontSize: '12px', background: '#d4edda', color: '#155724', padding: '5px 12px', borderRadius: '9999px', display: 'inline-block' }}>Connected</span>
                      ) : sent ? (
                        <span style={{
                          fontSize: '12px', padding: '5px 12px', borderRadius: '9999px', display: 'inline-block',
                          background: sent.includes('!') ? '#d4edda' : '#ffe0e0',
                          color: sent.includes('!') ? '#155724' : '#c62828',
                        }}>{sent}</span>
                      ) : (
                        <button onClick={() => connectToElder(elder.userId)} disabled={connectingTo === elder.userId}
                          style={{ fontSize: '13px', padding: '7px 16px', borderRadius: '9999px', border: 'none', background: '#0066cc', color: '#fff', cursor: 'pointer' }}>
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
