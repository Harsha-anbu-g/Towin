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
  const [location, setLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('idle'); // idle | asking | granted | denied

  async function loadNeeds() {
    try {
      const res = await api.get('/needs/mine');
      setMyNeeds(res.data.content ?? []);
    } catch {}
  }

  useEffect(() => {
    api.get('/profile/me').then(r => setProfile(r.data)).catch(() => {});
    api.get('/connections').then(r => setConnections(r.data)).catch(() => {});
    loadNeeds();
  }, []);

  useEffect(() => {
    if (tab === 'needs') loadNeeds();
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

  const trustLabel = (level) => {
    const map = {
      DISCOVERED: 'Discovered', MESSAGING: 'Messaging', PHONE_CALL: 'Phone Call',
      VIDEO_CALL: 'Video Call', VERIFIED: 'Verified', FIRST_MEET: 'First Meet', TRUSTED: 'Trusted'
    };
    return map[level] || level;
  };

  const tabs = [['connections', '🤝 Connections'], ['needs', '📋 My Requests'], ['post', '➕ Post Request']];

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

        <div className="flex gap-2 border-b">
          {tabs.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
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
              <div key={conn.id} className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-lg">🙋</div>
                  <div>
                    <p className="font-medium text-gray-800">{conn.otherUserName || 'User'}</p>
                    <p className="text-xs text-gray-500">{trustLabel(conn.currentTrustLevel)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {conn.status === 'ACTIVE' && conn.currentTrustLevel !== 'DISCOVERED' && (
                    <button
                      onClick={() => navigate(`/messages/${conn.id}`)}
                      className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700">
                      Message
                    </button>
                  )}
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    conn.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                    conn.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-500'}`}>
                    {conn.status}
                  </span>
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
                {need.status === 'ASSIGNED' && (
                  <div className="border-t pt-3">
                    <button onClick={() => completeNeed(need.id)}
                      className="w-full bg-green-600 text-white text-sm py-2 rounded-lg hover:bg-green-700">
                      Mark as Complete
                    </button>
                  </div>
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
