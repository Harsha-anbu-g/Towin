import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import NavBar from '../components/NavBar';
import TrustBadge from '../components/TrustBadge';
import api from '../api/axios';

function Stars({ rating }) {
  return (
    <span className="text-yellow-400">
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  );
}

const INPUT = 'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300';
const LABEL = 'block text-sm font-medium text-gray-700 mb-1';

export default function ProfileEdit() {
  const { user } = useAuth();
  const isElder = user?.role === 'ELDER' || user?.role === 'BOTH';

  const [form, setForm] = useState({
    name: '', age: '', bio: '',
    interests: '', languages: '', lookingFor: 'BOTH',
    skillsOffered: '', availabilityDays: '', availabilityTimes: '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [reviews, setReviews] = useState([]);
  const [profileData, setProfileData] = useState(null);

  useEffect(() => {
    api.get('/reviews/mine').then(r => setReviews(r.data)).catch(() => {});
    api.get('/profile/me').then(r => {
      const p = r.data;
      setProfileData(p);
      setForm({
        name: p.name || '',
        age: p.age || '',
        bio: p.bio || '',
        interests: (p.interests || []).join(', '),
        languages: (p.languages || []).join(', '),
        lookingFor: p.lookingFor || 'BOTH',
        skillsOffered: (p.skillsOffered || []).join(', '),
        availabilityDays: (p.availabilityDays || []).join(', '),
        availabilityTimes: (p.availabilityTimes || []).join(', '),
      });
    }).catch(() => {});
  }, []);

  const f = (key) => ({ value: form[key], onChange: e => setForm(p => ({...p, [key]: e.target.value})) });
  const toArr = (val) => val ? val.split(',').map(s => s.trim()).filter(Boolean) : [];

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      if (isElder) {
        await api.put('/profile/elder', {
          name: form.name, age: Number(form.age), bio: form.bio,
          interests: toArr(form.interests),
          languages: toArr(form.languages),
          lookingFor: form.lookingFor,
        });
      } else {
        await api.put('/profile/helper', {
          name: form.name, age: Number(form.age), bio: form.bio,
          skillsOffered: toArr(form.skillsOffered),
          languages: toArr(form.languages),
          availabilityDays: toArr(form.availabilityDays),
          availabilityTimes: toArr(form.availabilityTimes),
        });
      }
      setMsg('Profile saved!');
    } catch (err) {
      setMsg(err?.response?.data?.message || 'Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-lg font-semibold text-gray-800">
              {isElder ? '👴 Elder Profile' : '🙋 Helper Profile'}
            </h1>
            {profileData && (
              <TrustBadge tier={profileData.trustTier} score={profileData.trustScore} />
            )}
          </div>
          <form onSubmit={save} className="space-y-4">

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Full Name</label>
                <input {...f('name')} className={INPUT} placeholder="Your name" required />
              </div>
              <div>
                <label className={LABEL}>Age</label>
                <input {...f('age')} type="number" className={INPUT}
                  placeholder={isElder ? '50–120' : '18–80'}
                  min={isElder ? 50 : 18} max={isElder ? 120 : 80} required />
              </div>
            </div>

            <div>
              <label className={LABEL}>Bio</label>
              <textarea {...f('bio')} rows={3} className={INPUT} placeholder="Tell us a bit about yourself..." />
            </div>

            <div>
              <label className={LABEL}>Languages (comma-separated)</label>
              <input {...f('languages')} className={INPUT} placeholder="e.g. English, French" />
            </div>

            {isElder && (
              <>
                <div>
                  <label className={LABEL}>Interests (comma-separated)</label>
                  <input {...f('interests')} className={INPUT} placeholder="e.g. Gardening, Reading, Chess" />
                </div>
                <div>
                  <label className={LABEL}>Looking For</label>
                  <select {...f('lookingFor')} className={INPUT}>
                    <option value="FRIENDSHIP">Friendship</option>
                    <option value="HELP">Help</option>
                    <option value="BOTH">Both</option>
                  </select>
                </div>
              </>
            )}

            {!isElder && (
              <>
                <div>
                  <label className={LABEL}>Skills Offered (comma-separated)</label>
                  <input {...f('skillsOffered')} className={INPUT}
                    placeholder="e.g. Driving, Cooking, Tech help" />
                </div>
                <div>
                  <label className={LABEL}>Availability Days (comma-separated)</label>
                  <input {...f('availabilityDays')} className={INPUT}
                    placeholder="e.g. Monday, Wednesday, Friday" />
                </div>
                <div>
                  <label className={LABEL}>Availability Times (comma-separated)</label>
                  <input {...f('availabilityTimes')} className={INPUT}
                    placeholder="e.g. Morning, Afternoon" />
                </div>
              </>
            )}

            {msg && (
              <p className={`text-sm ${msg.includes('!') ? 'text-green-600' : 'text-red-500'}`}>{msg}</p>
            )}

            <button type="submit" disabled={saving}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        </div>
      </div>

      {/* Reviews received */}
      <div className="bg-white rounded-xl shadow-sm p-6 mt-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">
          ⭐ Reviews Received ({reviews.length})
        </h2>
        {reviews.length === 0 && (
          <p className="text-sm text-gray-400">No reviews yet. Complete a service to receive your first review.</p>
        )}
        <div className="space-y-4">
          {reviews.map(r => (
            <div key={r.id} className="border rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-800">{r.reviewerName}</p>
                <Stars rating={r.rating} />
              </div>
              {r.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {r.tags.map(t => (
                    <span key={t} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              )}
              {r.comment && <p className="text-sm text-gray-600 mt-1">{r.comment}</p>}
              {r.safetyConcern && (
                <p className="text-xs text-red-500 mt-1">⚠ Safety concern reported</p>
              )}
              <p className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
