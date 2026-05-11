import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import api from '../api/axios';

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
  const [reviewingNeed, setReviewingNeed] = useState(null); // needId being reviewed
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
    } finally {
      setPosting(false);
    }
  }

  async function completeNeed(needId) {
    try {
      await api.post(`/needs/${needId}/complete`);
      await loadNeeds();
    } catch { alert('Could not mark complete.'); }
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
    } finally {
      setSubmittingReview(false);
    }
  }

  async function acceptHelper(needId, helperId) {
    setAccepting(`${needId}-${helperId}`);
    try {
      await api.post(`/needs/${needId}/accept/${helperId}`);
      await loadNeeds();
    } catch { alert('Could not accept helper.'); }
    finally { setAccepting(null); }
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
    ['connections', `🤝 Connections${pendingIncoming.length > 0 ? ` (${pendingIncoming.length})` : ''}`],
    ['needs', '📋 My Requests'],
    ['post', '➕ Post Request']
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {profile && (
          <div className="bg-white rounded-xl shadow-sm p-5 flex gap-4 items-center">
            <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center text-2xl">👴</div>
            <div>
              <p className="font-semibold text-gray-800">{profile.name || 'Set up your profile'}</p>
              <p className="text-sm text-gray-500">{profile.city || 'No city set'} · Trust score: {profile.trustScore ?? 0}</p>
            </div>
          </div>
        )}

        <div className="flex gap-2 border-b overflow-x-auto">
          {tabs.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'connections' && (
          <div className="space-y-3">
            {connections.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">
                <p className="text-4xl mb-2">🔍</p>
                <p>No connections yet. Helpers will send you requests.</p>
              </div>
            )}
            {connections.map(conn => (
              <div key={conn.id} className="bg-white rounded-xl shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-lg">🙋</div>
                    <div>
                      <p className="font-medium text-gray-800">{conn.otherUserName || 'User'}</p>
                      <p className="text-xs text-gray-500">{trustLabel(conn.currentTrustLevel)}</p>
                      {conn.requestMessage && (
                        <p className="text-xs text-gray-400 italic mt-0.5">"{conn.requestMessage}"</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {conn.status === 'ACTIVE' && (
                      <>
                        {!conn.confirmedByMe && (
                          <button
                            onClick={() => confirmTrust(conn.id)}
                            disabled={confirmingTrust === conn.id}
                            className="text-xs bg-purple-600 text-white px-3 py-1 rounded-lg hover:bg-purple-700 disabled:opacity-50">
                            {confirmingTrust === conn.id ? '...' : 'Confirm Trust →'}
                          </button>
                        )}
                        {conn.confirmedByMe && (
                          <span className="text-xs text-purple-500">✓ Confirmed</span>
                        )}
                        <button
                          onClick={() => navigate(`/messages/${conn.id}`)}
                          className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700">
                          Message
                        </button>
                      </>
                    )}
                    {conn.status === 'PENDING' && !conn.initiatedByMe && (
                      <>
                        <button
                          onClick={() => respondToConnection(conn.id, true)}
                          disabled={respondingConn === conn.id}
                          className="text-xs bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 disabled:opacity-50">
                          Accept
                        </button>
                        <button
                          onClick={() => respondToConnection(conn.id, false)}
                          disabled={respondingConn === conn.id}
                          className="text-xs bg-red-100 text-red-600 px-3 py-1 rounded-lg hover:bg-red-200 disabled:opacity-50">
                          Decline
                        </button>
                      </>
                    )}
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      conn.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                      conn.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-500'}`}>
                      {conn.status === 'PENDING' && conn.initiatedByMe ? 'Waiting' : conn.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'needs' && (
          <div className="space-y-4">
            {myNeeds.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">
                <p className="text-4xl mb-2">📋</p>
                <p>No requests yet. Post one to get help from nearby helpers.</p>
              </div>
            )}
            {myNeeds.map(need => (
              <div key={need.id} className="bg-white rounded-xl shadow-sm p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-800">{need.title}</p>
                    {need.description && <p className="text-sm text-gray-500">{need.description}</p>}
                    <p className="text-xs text-gray-400 mt-1">{need.category} · {need.urgency}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    need.status === 'OPEN' ? 'bg-blue-100 text-blue-700' :
                    need.status === 'ASSIGNED' ? 'bg-yellow-100 text-yellow-700' :
                    need.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-500'}`}>
                    {need.status}
                  </span>
                </div>
                {need.status === 'OPEN' && need.applications?.length > 0 && (
                  <div className="border-t pt-3 space-y-2">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {need.applications.length} Applicant{need.applications.length !== 1 ? 's' : ''}
                    </p>
                    {need.applications.map(app => (
                      <div key={app.helperId} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{app.helperName}</p>
                          {app.message && <p className="text-xs text-gray-500 mt-0.5">{app.message}</p>}
                        </div>
                        <button
                          onClick={() => acceptHelper(need.id, app.helperId)}
                          disabled={accepting === `${need.id}-${app.helperId}`}
                          className="text-xs bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 disabled:opacity-50 ml-3 shrink-0">
                          {accepting === `${need.id}-${app.helperId}` ? 'Accepting...' : 'Accept'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {need.status === 'OPEN' && (!need.applications || need.applications.length === 0) && (
                  <p className="text-xs text-gray-400 border-t pt-3">No applicants yet</p>
                )}
                {need.status === 'ASSIGNED' && (
                  <div className="border-t pt-3">
                    <button onClick={() => completeNeed(need.id)}
                      className="w-full bg-green-600 text-white text-sm py-2 rounded-lg hover:bg-green-700">
                      Mark as Complete
                    </button>
                  </div>
                )}
                {need.status === 'COMPLETED' && !reviewedNeeds.has(need.id) && need.applications?.some(a => a.status === 'ACCEPTED') && (
                  <div className="border-t pt-3">
                    {reviewingNeed === need.id ? (
                      <div className="space-y-3">
                        <p className="text-xs font-medium text-gray-700">Rate your helper</p>
                        {/* Star rating */}
                        <div className="flex gap-1">
                          {[1,2,3,4,5].map(s => (
                            <button key={s} type="button" onClick={() => setReviewForm(f => ({...f, rating: s}))}
                              className={`text-2xl ${s <= reviewForm.rating ? 'text-yellow-400' : 'text-gray-300'}`}>
                              ★
                            </button>
                          ))}
                        </div>
                        {/* Tag chips */}
                        <div className="flex flex-wrap gap-2">
                          {REVIEW_TAGS.map(tag => (
                            <button key={tag} type="button" onClick={() => toggleTag(tag)}
                              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                                reviewForm.tags.includes(tag)
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                              }`}>
                              {tag}
                            </button>
                          ))}
                        </div>
                        <textarea
                          value={reviewForm.comment}
                          onChange={e => setReviewForm(f => ({...f, comment: e.target.value}))}
                          placeholder="Add a comment (optional)"
                          rows={2}
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                        <label className="flex items-center gap-2 text-sm text-red-600 cursor-pointer">
                          <input type="checkbox" checked={reviewForm.safetyConcern}
                            onChange={e => setReviewForm(f => ({...f, safetyConcern: e.target.checked}))} />
                          Flag a safety concern
                        </label>
                        <div className="flex gap-2">
                          <button onClick={() => submitReview(need)} disabled={submittingReview}
                            className="flex-1 bg-indigo-600 text-white text-sm py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                            {submittingReview ? 'Submitting...' : 'Submit Review'}
                          </button>
                          <button onClick={() => setReviewingNeed(null)}
                            className="px-4 text-sm text-gray-500 border rounded-lg hover:bg-gray-50">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setReviewingNeed(need.id)}
                        className="w-full bg-yellow-500 text-white text-sm py-2 rounded-lg hover:bg-yellow-600">
                        ⭐ Leave a Review
                      </button>
                    )}
                  </div>
                )}
                {need.status === 'COMPLETED' && reviewedNeeds.has(need.id) && (
                  <p className="text-xs text-green-600 border-t pt-3">✓ Review submitted</p>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'post' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Post a Help Request</h2>
            <form onSubmit={postNeed} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">What do you need?</label>
                <input value={needForm.title} onChange={e => setNeedForm(f => ({...f, title: e.target.value}))}
                  placeholder="e.g. Help with grocery shopping"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={needForm.description} onChange={e => setNeedForm(f => ({...f, description: e.target.value}))}
                  placeholder="Add more details..."
                  rows={3}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select value={needForm.category} onChange={e => setNeedForm(f => ({...f, category: e.target.value}))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    <option value="COMPANIONSHIP">Companionship</option>
                    <option value="TRANSPORTATION">Transportation</option>
                    <option value="ERRANDS">Errands</option>
                    <option value="CLEANING">Cleaning</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Urgency</label>
                  <select value={needForm.urgency} onChange={e => setNeedForm(f => ({...f, urgency: e.target.value}))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    <option value="NORMAL">Normal</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>
              <div className="text-xs text-gray-400">
                {locationStatus === 'asking' && '📍 Getting your location...'}
                {locationStatus === 'granted' && '📍 Location captured — helpers nearby will see this first'}
                {locationStatus === 'denied' && '📍 Location not available — request will still be posted'}
                {locationStatus === 'idle' && (
                  <button type="button" onClick={requestLocation} className="text-indigo-500 underline">
                    Allow location so nearby helpers find you faster
                  </button>
                )}
              </div>
              {postMsg && <p className={`text-sm ${postMsg.includes('!') ? 'text-green-600' : 'text-red-500'}`}>{postMsg}</p>}
              <button type="submit" disabled={posting}
                className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {posting ? 'Posting...' : 'Post Request'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
