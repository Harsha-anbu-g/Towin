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

  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpMsg, setOtpMsg] = useState('');
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [idFile, setIdFile] = useState(null);
  const [uploadingId, setUploadingId] = useState(false);
  const [idMsg, setIdMsg] = useState('');

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

  async function requestOtp() {
    setVerifyingPhone(true);
    try {
      await api.post('/auth/verify-phone/request');
      setPhoneOtpSent(true);
      setOtpMsg('Code sent to your phone.');
    } catch (err) {
      setOtpMsg(err?.response?.data?.message || 'Could not send code.');
    } finally { setVerifyingPhone(false); }
  }

  async function confirmOtp() {
    setVerifyingPhone(true);
    try {
      await api.post('/auth/verify-phone/confirm', { otp });
      setOtpMsg('Phone verified! Trust score updated.');
      setPhoneOtpSent(false);
      setOtp('');
      const r = await api.get('/profile/me');
      setProfileData(r.data);
    } catch (err) {
      setOtpMsg(err?.response?.data?.message || 'Invalid code.');
    } finally { setVerifyingPhone(false); }
  }

  async function uploadId() {
    if (!idFile) return;
    setUploadingId(true);
    const form = new FormData();
    form.append('file', idFile);
    try {
      await api.post('/auth/verify-id', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setIdMsg('ID uploaded. Verification pending review.');
    } catch (err) {
      setIdMsg(err?.response?.data?.message || 'Upload failed.');
    } finally { setUploadingId(false); }
  }

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

      {/* Verification */}
      <div className="bg-white rounded-xl shadow-sm p-6 mt-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-800">🔐 Verification</h2>

        {/* Phone */}
        <div className="border rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Phone Number</p>
            {profileData?.phoneVerified
              ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ Verified (+10 pts)</span>
              : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Not verified</span>
            }
          </div>
          {!profileData?.phoneVerified && (
            !phoneOtpSent ? (
              <button onClick={requestOtp} disabled={verifyingPhone}
                className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {verifyingPhone ? 'Sending...' : 'Send Verification Code'}
              </button>
            ) : (
              <div className="flex gap-2">
                <input value={otp} onChange={e => setOtp(e.target.value)}
                  placeholder="Enter 6-digit code"
                  className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                <button onClick={confirmOtp} disabled={verifyingPhone || otp.length < 6}
                  className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50">
                  Confirm
                </button>
              </div>
            )
          )}
          {otpMsg && <p className={`text-xs ${otpMsg.includes('verified') ? 'text-green-600' : 'text-red-500'}`}>{otpMsg}</p>}
        </div>

        {/* ID */}
        <div className="border rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">ID Document</p>
            {profileData?.verificationStatus === 'VERIFIED'
              ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ Verified (+20 pts)</span>
              : profileData?.verificationStatus === 'PENDING'
              ? <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Under review</span>
              : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Not submitted</span>
            }
          </div>
          {(profileData?.verificationStatus === 'NONE' || !profileData?.verificationStatus) && (
            <div className="flex gap-2 items-center">
              <input type="file" accept="image/*,.pdf"
                onChange={e => setIdFile(e.target.files[0])}
                className="text-xs text-gray-600" />
              {idFile && (
                <button onClick={uploadId} disabled={uploadingId}
                  className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {uploadingId ? 'Uploading...' : 'Upload'}
                </button>
              )}
            </div>
          )}
          {idMsg && <p className={`text-xs ${idMsg.includes('pending') ? 'text-yellow-600' : 'text-red-500'}`}>{idMsg}</p>}
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
