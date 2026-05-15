import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import TrustBadge from '../components/TrustBadge';
import api from '../api/axios';

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
      const msg = err?.response?.data?.message || 'Could not apply.';
      setApplyMsg(prev => ({...prev, [needId]: msg}));
    } finally {
      setApplying(null);
    }
  }

  async function connectToElder(elderId) {
    setConnectingTo(elderId);
    try {
      await api.post('/connections/request', { targetUserId: elderId });
      setConnectMsg(prev => ({...prev, [elderId]: 'Request sent!'}));
      await loadConnections();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Could not connect.';
      setConnectMsg(prev => ({...prev, [elderId]: msg}));
    } finally {
      setConnectingTo(null);
    }
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
    } finally {
      setSubmittingReview(false);
    }
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
    ['connections', `🤝 Connections${pendingIncoming.length > 0 ? ` (${pendingIncoming.length})` : ''}`],
    ['browse', '🔎 Browse Needs'],
    ['discover', '🧭 Discover Elders'],
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {profile && (
          <div className="bg-white rounded-xl shadow-sm p-5 flex gap-4 items-center">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center text-2xl">🙋</div>
            <div>
              <p className="font-semibold text-gray-800">{profile.name || 'Set up your profile'}</p>
              <div className="flex items-center gap-2">
              <p className="text-sm text-gray-500">{profile.city || 'No city set'}</p>
              <TrustBadge tier={profile.trustTier} score={profile.trustScore} />
            </div>
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
                <p className="text-4xl mb-2">🤝</p>
                <p>No connections yet. Discover elders and send a request.</p>
              </div>
            )}
            {connections.map(conn => (
              <div key={conn.id} className="bg-white rounded-xl shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-lg">👴</div>
                    <div>
                      <p className="font-medium text-gray-800">{conn.otherUserName || 'Elder'}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-gray-500">{trustLabel(conn.currentTrustLevel)}</p>
                      </div>
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
                        {conn.currentTrustLevel === 'TRUSTED' && !reviewedConns.has(conn.id) && (
                          <button
                            onClick={() => setReviewingConn(reviewingConn === conn.id ? null : conn.id)}
                            className="text-xs bg-yellow-500 text-white px-3 py-1 rounded-lg hover:bg-yellow-600">
                            ⭐ Review Elder
                          </button>
                        )}
                        {reviewedConns.has(conn.id) && (
                          <span className="text-xs text-green-600 font-medium">✓ Reviewed</span>
                        )}
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
                {reviewingConn === conn.id && (
                  <div className="border-t pt-3 space-y-3">
                    <p className="text-sm font-medium text-gray-700">Rate {conn.otherUserName || 'this elder'}</p>
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(s => (
                        <button key={s} onClick={() => setReviewForm(f => ({...f, rating: s}))}
                          className={`text-2xl transition-transform hover:scale-110 ${s <= reviewForm.rating ? 'text-yellow-400' : 'text-gray-300'}`}>★</button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {REVIEW_TAGS.map(t => (
                        <button key={t} onClick={() => setReviewForm(f => ({
                          ...f, tags: f.tags.includes(t) ? f.tags.filter(x => x !== t) : [...f.tags, t]
                        }))}
                          className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                            reviewForm.tags.includes(t)
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                          }`}>{t}</button>
                      ))}
                    </div>
                    <textarea
                      value={reviewForm.comment}
                      onChange={e => setReviewForm(f => ({...f, comment: e.target.value}))}
                      placeholder="Any comments? (optional)"
                      rows={2}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                      <input type="checkbox" checked={reviewForm.safetyConcern}
                        onChange={e => setReviewForm(f => ({...f, safetyConcern: e.target.checked}))} />
                      Report a safety concern
                    </label>
                    <div className="flex gap-2">
                      <button onClick={() => submitElderReview(conn)} disabled={submittingReview}
                        className="text-xs bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                        {submittingReview ? 'Submitting...' : 'Submit Review'}
                      </button>
                      <button onClick={() => setReviewingConn(null)}
                        className="text-xs text-gray-500 px-3 py-1.5 border rounded-lg hover:bg-gray-50">
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
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm px-4 py-3 flex items-center justify-between gap-4">
              <div className="text-sm text-gray-600">
                {locationStatus === 'asking' && '📍 Getting your location...'}
                {locationStatus === 'granted' && `📍 Showing needs within ${radiusKm} km`}
                {locationStatus === 'denied' && (
                  <span>📍 Location denied — showing all needs &nbsp;
                    <button onClick={requestLocation} className="text-indigo-500 underline text-xs">Try again</button>
                  </span>
                )}
                {locationStatus === 'idle' && '📍 Detecting location...'}
              </div>
              {locationStatus === 'granted' && (
                <select value={radiusKm} onChange={e => setRadiusKm(Number(e.target.value))}
                  className="border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  <option value={5}>5 km</option>
                  <option value={10}>10 km</option>
                  <option value={25}>25 km</option>
                  <option value={50}>50 km</option>
                  <option value={100}>100 km</option>
                </select>
              )}
            </div>

            {needs.length === 0 && locationStatus !== 'asking' && (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">
                <p className="text-4xl mb-2">📋</p>
                <p>{locationStatus === 'granted' ? `No open requests within ${radiusKm} km. Try a larger radius.` : 'No open requests right now.'}</p>
              </div>
            )}
            {needs.map(need => (
              <div key={need.id} className="bg-white rounded-xl shadow-sm p-5 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">{need.title}</p>
                    {need.description && <p className="text-sm text-gray-500 mt-0.5">{need.description}</p>}
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{need.category}</span>
                      {need.urgency === 'URGENT' && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Urgent</span>
                      )}
                      {need.distanceKm != null && (
                        <span className="text-xs text-gray-400">{need.distanceKm} km away</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Posted by {need.elderName}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <button
                      onClick={() => apply(need.id)}
                      disabled={applying === need.id || !!applyMsg[need.id]}
                      className={`text-sm px-4 py-1.5 rounded-lg font-medium transition-colors ${
                        applyMsg[need.id]?.includes('!')
                          ? 'bg-green-100 text-green-700 cursor-default'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50'
                      }`}>
                      {applying === need.id ? 'Applying...' : applyMsg[need.id] || 'Apply'}
                    </button>
                  </div>
                </div>
                {applyMsg[need.id] && !applyMsg[need.id].includes('!') && (
                  <p className="text-xs text-red-500">{applyMsg[need.id]}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'discover' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm px-4 py-3 flex items-center justify-between gap-4">
              <div className="text-sm text-gray-600">
                {locationStatus === 'granted' && `📍 Showing elders within ${radiusKm} km`}
                {locationStatus !== 'granted' && '📍 Enable location to find elders near you'}
              </div>
              {locationStatus === 'granted' && (
                <select value={radiusKm} onChange={e => setRadiusKm(Number(e.target.value))}
                  className="border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  <option value={5}>5 km</option>
                  <option value={10}>10 km</option>
                  <option value={25}>25 km</option>
                  <option value={50}>50 km</option>
                  <option value={100}>100 km</option>
                </select>
              )}
            </div>

            {elders.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">
                <p className="text-4xl mb-2">👴</p>
                <p>No elders found nearby. Try a larger radius or check back later.</p>
              </div>
            )}
            {elders.map(elder => {
              const alreadyConnected = connectedElderIds.has(elder.userId);
              const sent = connectMsg[elder.userId];
              return (
                <div key={elder.userId} className="bg-white rounded-xl shadow-sm p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-2xl shrink-0">👴</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-800">{elder.name || 'Elder'}</p>
                          <TrustBadge tier={elder.trustTier} score={elder.trustScore} />
                        </div>
                        {elder.city && <p className="text-xs text-gray-500">{elder.city}</p>}
                        {elder.distanceKm != null && (
                          <p className="text-xs text-gray-400">{Math.round(elder.distanceKm * 10) / 10} km away</p>
                        )}
                        {elder.bio && <p className="text-sm text-gray-600 mt-1">{elder.bio}</p>}
                        {elder.interests?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {elder.interests.map(i => (
                              <span key={i} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{i}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {alreadyConnected ? (
                        <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">Connected</span>
                      ) : sent ? (
                        <span className={`text-xs px-3 py-1 rounded-full font-medium ${sent.includes('!') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          {sent}
                        </span>
                      ) : (
                        <button
                          onClick={() => connectToElder(elder.userId)}
                          disabled={connectingTo === elder.userId}
                          className="text-sm bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                          {connectingTo === elder.userId ? 'Sending...' : 'Connect'}
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
