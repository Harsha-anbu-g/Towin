import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import api from '../api/axios';

export default function HelperDashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [connections, setConnections] = useState([]);
  const [needs, setNeeds] = useState([]);
  const [tab, setTab] = useState('connections');
  const [applying, setApplying] = useState(null);
  const [applyMsg, setApplyMsg] = useState({});
  const [location, setLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('idle'); // idle | asking | granted | denied
  const [radiusKm, setRadiusKm] = useState(25);

  async function loadNeeds(loc) {
    try {
      const coords = loc ?? location;
      let res;
      if (coords) {
        res = await api.get(`/needs/nearby?lat=${coords.lat}&lng=${coords.lng}&radiusKm=${radiusKm}`);
        setNeeds(res.data);
      } else {
        res = await api.get('/needs/open');
        setNeeds(res.data);
      }
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
    api.get('/connections').then(r => setConnections(r.data)).catch(() => {});
    requestLocation();
  }, []);

  useEffect(() => {
    if (tab === 'browse') loadNeeds();
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

  const trustLabel = (level) => {
    const map = {
      DISCOVERED: 'Discovered', MESSAGING: 'Messaging', PHONE_CALL: 'Phone Call',
      VIDEO_CALL: 'Video Call', VERIFIED: 'Verified', FIRST_MEET: 'First Meet', TRUSTED: 'Trusted'
    };
    return map[level] || level;
  };

  const tabs = [['connections', '🤝 Connections'], ['browse', '🔎 Browse Needs']];

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {profile && (
          <div className="bg-white rounded-xl shadow-sm p-5 flex gap-4 items-center">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center text-2xl">🙋</div>
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
                <p className="text-4xl mb-2">🤝</p>
                <p>No connections yet. Browse needs and help elders to get started.</p>
              </div>
            )}
            {connections.map(conn => (
              <div key={conn.id} className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-lg">👴</div>
                  <div>
                    <p className="font-medium text-gray-800">{conn.otherUserName || 'Elder'}</p>
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

        {tab === 'browse' && (
          <div className="space-y-4">
            {/* Location + radius bar */}
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
      </div>
    </div>
  );
}
