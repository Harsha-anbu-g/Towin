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

const pill = (active) => ({
  padding: '6px 16px',
  borderRadius: '9999px',
  border: 'none',
  fontSize: '14px',
  fontWeight: active ? 600 : 400,
  cursor: 'pointer',
  background: active ? '#0066cc' : 'transparent',
  color: active ? '#fff' : '#6e6e73',
  transition: 'all 0.15s',
});

const statusBadge = (status) => {
  const map = {
    OPEN:      { bg: '#d6e8ff', color: '#004499' },
    ASSIGNED:  { bg: '#fff3cd', color: '#b45309' },
    COMPLETED: { bg: '#d4edda', color: '#155724' },
    CANCELLED: { bg: '#f2f2f7', color: '#6e6e73' },
    ACTIVE:    { bg: '#d4edda', color: '#155724' },
    PENDING:   { bg: '#fff3cd', color: '#b45309' },
    DECLINED:  { bg: '#ffe0e0', color: '#c62828' },
  };
  const s = map[status] ?? { bg: '#f2f2f7', color: '#6e6e73' };
  return {
    background: s.bg,
    color: s.color,
    fontSize: '12px',
    fontWeight: 500,
    padding: '3px 10px',
    borderRadius: '9999px',
    display: 'inline-block',
  };
};

const inputCls = 'w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 bg-white';
const selectCls = 'w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 bg-white';

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
    try {
      const res = await api.get('/needs/mine');
      setMyNeeds(res.data.content ?? []);
    } catch {}
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
      pos => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationStatus('granted');
      },
      () => setLocationStatus('denied')
    );
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

  async function postNeed(e) {
    e.preventDefault();
    setPosting(true);
    setPostMsg('');
    try {
      const body = { ...needForm };
      if (location) { body.locationLat = location.lat; body.locationLng = location.lng; }
      await api.post('/needs', body);
      setNeedForm({ title: '', description: '', category: 'COMPANIONSHIP', urgency: 'NORMAL' });
      setPostMsg('Request posted!');
      await loadNeeds();
      setTab('needs');
    } catch (err) {
      setPostMsg(err?.response?.data?.message || 'Failed to post. Try again.');
    } finally { setPosting(false); }
  }

  async function completeNeed(needId) {
    try {
      await api.post(`/needs/${needId}/complete`);
      await loadNeeds();
    } catch { alert('Could not mark complete.'); }
  }

  async function acceptHelper(needId, helperId) {
    setAccepting(`${needId}-${helperId}`);
    try {
      await api.post(`/needs/${needId}/accept/${helperId}`);
      await loadNeeds();
    } catch { alert('Could not accept helper.'); }
    finally { setAccepting(null); }
  }

  const REVIEW_TAGS = ['Friendly', 'Punctual', 'Respectful', 'Helpful', 'Patient'];

  function toggleTag(tag) {
    setReviewForm(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag]
    }));
  }

  async function submitReview(need) {
    const accepted = need.applications?.find(a => a.status === 'ACCEPTED');
    if (!accepted) return;
    setSubmittingReview(true);
    try {
      await api.post('/reviews', {
        revieweeId: accepted.helperId,
        needId: need.id,
        rating: reviewForm.rating,
        tags: reviewForm.tags,
        comment: reviewForm.comment,
        safetyConcern: reviewForm.safetyConcern,
      });
      setReviewedNeeds(prev => new Set([...prev, need.id]));
      setReviewingNeed(null);
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

  const pendingIncoming = connections.filter(c => c.status === 'PENDING' && !c.initiatedByMe);
  const tabs = [
    ['connections', `Connections${pendingIncoming.length > 0 ? ` (${pendingIncoming.length})` : ''}`],
    ['needs', 'My Requests'],
    ['post', 'Post Request'],
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
                background: '#d6e8ff', color: '#0066cc',
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

        <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #d2d2d7', paddingBottom: '0' }}>
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
                <p style={{ fontSize: '14px', color: '#86868b' }}>No connections yet. Helpers will send you requests.</p>
              </div>
            )}
            {connections.map(conn => (
              <div key={conn.id} style={card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '50%',
                      background: '#d4edda', color: '#155724',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '14px', fontWeight: 600, flexShrink: 0,
                    }}>
                      {initials(conn.otherUserName)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontWeight: 500, fontSize: '15px', color: '#1d1d1f' }}>{conn.otherUserName || 'User'}</p>
                      <p style={{ fontSize: '12px', color: '#86868b', marginTop: '2px' }}>{trustLabel(conn.currentTrustLevel)}</p>
                      {conn.requestMessage && (
                        <p style={{ fontSize: '12px', color: '#86868b', fontStyle: 'italic', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          "{conn.requestMessage}"
                        </p>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
                    {conn.status === 'ACTIVE' && (
                      <>
                        {!conn.confirmedByMe ? (
                          <button
                            onClick={() => confirmTrust(conn.id)}
                            disabled={confirmingTrust === conn.id}
                            style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '9999px', border: '1px solid #d2d2d7', background: '#fff', color: '#1d1d1f', cursor: 'pointer' }}>
                            {confirmingTrust === conn.id ? '...' : 'Confirm Trust'}
                          </button>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#155724' }}>Confirmed</span>
                        )}
                        <button
                          onClick={() => navigate(`/messages/${conn.id}`)}
                          style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '9999px', border: 'none', background: '#0066cc', color: '#fff', cursor: 'pointer' }}>
                          Message
                        </button>
                      </>
                    )}
                    {conn.status === 'PENDING' && !conn.initiatedByMe && (
                      <>
                        <button
                          onClick={() => respondToConnection(conn.id, true)}
                          disabled={respondingConn === conn.id}
                          style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '9999px', border: 'none', background: '#0066cc', color: '#fff', cursor: 'pointer' }}>
                          Accept
                        </button>
                        <button
                          onClick={() => respondToConnection(conn.id, false)}
                          disabled={respondingConn === conn.id}
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
              </div>
            ))}
          </div>
        )}

        {tab === 'needs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {myNeeds.length === 0 && (
              <div style={{ ...card, textAlign: 'center', padding: '48px 24px' }}>
                <p style={{ fontSize: '14px', color: '#86868b' }}>No requests yet. Post one to get help from nearby helpers.</p>
              </div>
            )}
            {myNeeds.map(need => (
              <div key={need.id} style={card}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: '15px', color: '#1d1d1f' }}>{need.title}</p>
                    {need.description && <p style={{ fontSize: '14px', color: '#6e6e73', marginTop: '4px' }}>{need.description}</p>}
                    <p style={{ fontSize: '12px', color: '#86868b', marginTop: '6px' }}>{need.category} · {need.urgency}</p>
                  </div>
                  <span style={statusBadge(need.status)}>{need.status}</span>
                </div>

                {need.status === 'OPEN' && need.applications?.length > 0 && (
                  <div style={{ borderTop: '1px solid #f0f0f0', marginTop: '16px', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p style={{ fontSize: '12px', color: '#86868b', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {need.applications.length} Applicant{need.applications.length !== 1 ? 's' : ''}
                    </p>
                    {need.applications.map(app => (
                      <div key={app.helperId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f5f5f7', borderRadius: '10px', padding: '10px 14px' }}>
                        <div>
                          <p style={{ fontSize: '14px', fontWeight: 500, color: '#1d1d1f' }}>{app.helperName}</p>
                          {app.message && <p style={{ fontSize: '12px', color: '#6e6e73', marginTop: '2px' }}>{app.message}</p>}
                        </div>
                        <button
                          onClick={() => acceptHelper(need.id, app.helperId)}
                          disabled={accepting === `${need.id}-${app.helperId}`}
                          style={{ fontSize: '12px', padding: '5px 14px', borderRadius: '9999px', border: 'none', background: '#0066cc', color: '#fff', cursor: 'pointer', flexShrink: 0, marginLeft: '12px' }}>
                          {accepting === `${need.id}-${app.helperId}` ? '...' : 'Accept'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {need.status === 'OPEN' && (!need.applications || need.applications.length === 0) && (
                  <p style={{ fontSize: '13px', color: '#86868b', borderTop: '1px solid #f0f0f0', marginTop: '12px', paddingTop: '12px' }}>No applicants yet</p>
                )}
                {need.status === 'ASSIGNED' && (
                  <div style={{ borderTop: '1px solid #f0f0f0', marginTop: '16px', paddingTop: '16px' }}>
                    <button onClick={() => completeNeed(need.id)}
                      style={{ width: '100%', background: '#34c759', color: '#fff', border: 'none', borderRadius: '9999px', padding: '10px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
                      Mark as Complete
                    </button>
                  </div>
                )}
                {need.status === 'COMPLETED' && !reviewedNeeds.has(need.id) && need.applications?.some(a => a.status === 'ACCEPTED') && (
                  <div style={{ borderTop: '1px solid #f0f0f0', marginTop: '16px', paddingTop: '16px' }}>
                    {reviewingNeed === need.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <p style={{ fontSize: '13px', fontWeight: 500, color: '#1d1d1f' }}>Rate your helper</p>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {[1,2,3,4,5].map(s => (
                            <button key={s} type="button" onClick={() => setReviewForm(f => ({...f, rating: s}))}
                              style={{ fontSize: '24px', background: 'none', border: 'none', cursor: 'pointer', color: s <= reviewForm.rating ? '#ff9500' : '#d2d2d7' }}>★</button>
                          ))}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {REVIEW_TAGS.map(tag => (
                            <button key={tag} type="button" onClick={() => toggleTag(tag)}
                              style={{
                                fontSize: '12px', padding: '4px 12px', borderRadius: '9999px',
                                border: '1px solid',
                                borderColor: reviewForm.tags.includes(tag) ? '#0066cc' : '#d2d2d7',
                                background: reviewForm.tags.includes(tag) ? '#0066cc' : '#fff',
                                color: reviewForm.tags.includes(tag) ? '#fff' : '#6e6e73',
                                cursor: 'pointer',
                              }}>
                              {tag}
                            </button>
                          ))}
                        </div>
                        <textarea
                          value={reviewForm.comment}
                          onChange={e => setReviewForm(f => ({...f, comment: e.target.value}))}
                          placeholder="Add a comment (optional)"
                          rows={2}
                          style={{ width: '100%', border: '1px solid #d2d2d7', borderRadius: '10px', padding: '8px 12px', fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#ff3b30', cursor: 'pointer' }}>
                          <input type="checkbox" checked={reviewForm.safetyConcern}
                            onChange={e => setReviewForm(f => ({...f, safetyConcern: e.target.checked}))} />
                          Flag a safety concern
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => submitReview(need)} disabled={submittingReview}
                            style={{ flex: 1, background: '#0066cc', color: '#fff', border: 'none', borderRadius: '9999px', padding: '9px', fontSize: '14px', cursor: 'pointer' }}>
                            {submittingReview ? 'Submitting...' : 'Submit Review'}
                          </button>
                          <button onClick={() => setReviewingNeed(null)}
                            style={{ padding: '9px 16px', fontSize: '14px', border: '1px solid #d2d2d7', borderRadius: '9999px', background: '#fff', color: '#6e6e73', cursor: 'pointer' }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setReviewingNeed(need.id)}
                        style={{ width: '100%', background: '#fff', border: '1px solid #0066cc', color: '#0066cc', borderRadius: '9999px', padding: '9px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
                        Leave a Review
                      </button>
                    )}
                  </div>
                )}
                {need.status === 'COMPLETED' && reviewedNeeds.has(need.id) && (
                  <p style={{ fontSize: '13px', color: '#155724', borderTop: '1px solid #f0f0f0', marginTop: '12px', paddingTop: '12px' }}>Review submitted</p>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'post' && (
          <div style={card}>
            <p style={{ fontSize: '20px', fontWeight: 600, color: '#1d1d1f', marginBottom: '20px', letterSpacing: '-0.3px' }}>Post a Help Request</p>
            <form onSubmit={postNeed} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6e6e73', marginBottom: '6px' }}>What do you need?</label>
                <input value={needForm.title} onChange={e => setNeedForm(f => ({...f, title: e.target.value}))}
                  placeholder="e.g. Help with grocery shopping"
                  className={inputCls} required
                  style={{ border: '1px solid #d2d2d7', borderRadius: '10px', padding: '10px 14px', fontSize: '15px', width: '100%', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6e6e73', marginBottom: '6px' }}>Description</label>
                <textarea value={needForm.description} onChange={e => setNeedForm(f => ({...f, description: e.target.value}))}
                  placeholder="Add more details..."
                  rows={3}
                  style={{ width: '100%', border: '1px solid #d2d2d7', borderRadius: '10px', padding: '10px 14px', fontSize: '15px', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6e6e73', marginBottom: '6px' }}>Category</label>
                  <select value={needForm.category} onChange={e => setNeedForm(f => ({...f, category: e.target.value}))}
                    style={{ width: '100%', border: '1px solid #d2d2d7', borderRadius: '10px', padding: '10px 14px', fontSize: '15px', outline: 'none', background: '#fff' }}>
                    <option value="COMPANIONSHIP">Companionship</option>
                    <option value="TRANSPORTATION">Transportation</option>
                    <option value="ERRANDS">Errands</option>
                    <option value="CLEANING">Cleaning</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6e6e73', marginBottom: '6px' }}>Urgency</label>
                  <select value={needForm.urgency} onChange={e => setNeedForm(f => ({...f, urgency: e.target.value}))}
                    style={{ width: '100%', border: '1px solid #d2d2d7', borderRadius: '10px', padding: '10px 14px', fontSize: '15px', outline: 'none', background: '#fff' }}>
                    <option value="NORMAL">Normal</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>
              <p style={{ fontSize: '13px', color: '#86868b' }}>
                {locationStatus === 'asking' && 'Getting your location...'}
                {locationStatus === 'granted' && 'Location captured — helpers nearby will see this first'}
                {locationStatus === 'denied' && 'Location not available — request will still be posted'}
                {locationStatus === 'idle' && (
                  <button type="button" onClick={requestLocation} style={{ color: '#0066cc', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', padding: 0 }}>
                    Allow location so nearby helpers find you faster
                  </button>
                )}
              </p>
              {postMsg && <p style={{ fontSize: '14px', color: postMsg.includes('!') ? '#155724' : '#c62828' }}>{postMsg}</p>}
              <button type="submit" disabled={posting}
                style={{ width: '100%', background: posting ? '#86868b' : '#0066cc', color: '#fff', border: 'none', borderRadius: '9999px', padding: '12px', fontSize: '17px', fontWeight: 500, cursor: posting ? 'not-allowed' : 'pointer' }}>
                {posting ? 'Posting...' : 'Post Request'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
