import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import NavBar from '../components/NavBar';
import TrustBadge from '../components/TrustBadge';
import api from '../api/axios';

const inp = {
  width: '100%',
  border: '1px solid #d2d2d7',
  borderRadius: '10px',
  padding: '10px 14px',
  fontSize: '15px',
  color: '#1d1d1f',
  outline: 'none',
  background: '#fff',
  fontFamily: 'inherit',
};

const lbl = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 500,
  color: '#6e6e73',
  marginBottom: '6px',
};

const section = {
  background: '#fff',
  border: '1px solid #d2d2d7',
  borderRadius: '18px',
  padding: '24px',
};

function Stars({ rating }) {
  return (
    <span style={{ color: '#ff9500', letterSpacing: '-2px' }}>
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  );
}

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
  const [editingPhone, setEditingPhone] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [idFile, setIdFile] = useState(null);
  const [uploadingId, setUploadingId] = useState(false);
  const [idMsg, setIdMsg] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoMsg, setPhotoMsg] = useState('');

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

  const f = (key) => ({
    value: form[key],
    onChange: e => setForm(p => ({...p, [key]: e.target.value})),
    style: inp,
    onFocus: e => e.target.style.borderColor = '#0066cc',
    onBlur: e => e.target.style.borderColor = '#d2d2d7',
  });
  const toArr = (val) => val ? val.split(',').map(s => s.trim()).filter(Boolean) : [];

  async function savePhone() {
    try {
      const digits = newPhone.replace(/\s|-/g, '');
      const normalized = digits.startsWith('+') ? digits : '+1' + digits;
      await api.put('/profile/phone', { phone: normalized });
      const r = await api.get('/profile/me');
      setProfileData(r.data);
      setEditingPhone(false);
      setOtpMsg('Phone number updated. Please verify it.');
      setPhoneOtpSent(false);
    } catch (err) {
      setOtpMsg(err?.response?.data?.message || 'Could not update number.');
    }
  }

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
    const fd = new FormData();
    fd.append('file', idFile);
    try {
      await api.post('/auth/verify-id', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setIdMsg('ID uploaded. Verification pending review.');
    } catch (err) {
      setIdMsg(err?.response?.data?.message || 'Upload failed.');
    } finally { setUploadingId(false); }
  }

  async function uploadPhoto() {
    if (!photoFile) return;
    setUploadingPhoto(true);
    const data = new FormData();
    data.append('file', photoFile);
    try {
      const r = await api.put('/profile/photo', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      setProfileData(p => ({ ...p, photoUrl: r.data.photoUrl }));
      setPhotoMsg('Photo updated.');
      setPhotoFile(null);
    } catch (err) {
      setPhotoMsg(err?.response?.data?.message || 'Upload failed.');
    } finally { setUploadingPhoto(false); }
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
      setMsg('Profile saved.');
    } catch (err) {
      setMsg(err?.response?.data?.message || 'Failed to save. Try again.');
    } finally { setSaving(false); }
  }

  const initials = (name) => name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';

  return (
    <div style={{ minHeight: '100svh', background: '#f5f5f7' }}>
      <NavBar />
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '32px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Profile header */}
        <div style={section}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <p style={{ fontSize: '20px', fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.3px' }}>
              {isElder ? 'Elder Profile' : 'Helper Profile'}
            </p>
            {profileData && <TrustBadge tier={profileData.trustTier} score={profileData.trustScore} />}
          </div>

          {/* Photo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: isElder ? '#d6e8ff' : '#d4edda',
              overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {profileData?.photoUrl
                ? <img src={profileData.photoUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: '20px', fontWeight: 600, color: isElder ? '#0066cc' : '#155724' }}>
                    {initials(form.name)}
                  </span>
              }
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <input type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files[0])}
                style={{ fontSize: '13px', color: '#6e6e73' }} />
              {photoFile && (
                <button onClick={uploadPhoto} disabled={uploadingPhoto} type="button"
                  style={{ fontSize: '12px', background: '#0066cc', color: '#fff', border: 'none', borderRadius: '9999px', padding: '5px 14px', cursor: 'pointer', alignSelf: 'flex-start' }}>
                  {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                </button>
              )}
              {photoMsg && <p style={{ fontSize: '12px', color: photoMsg.includes('updated') ? '#155724' : '#c62828' }}>{photoMsg}</p>}
            </div>
          </div>

          {/* Profile form */}
          <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={lbl}>Full Name</label>
                <input {...f('name')} placeholder="Your name" required />
              </div>
              <div>
                <label style={lbl}>Age</label>
                <input {...f('age')} type="number"
                  placeholder={isElder ? '50–120' : '18–80'}
                  min={isElder ? 50 : 18} max={isElder ? 120 : 80} required />
              </div>
            </div>

            <div>
              <label style={lbl}>Bio</label>
              <textarea {...f('bio')} rows={3}
                style={{ ...inp, resize: 'vertical' }}
                placeholder="Tell us a bit about yourself..." />
            </div>

            <div>
              <label style={lbl}>Languages (comma-separated)</label>
              <input {...f('languages')} placeholder="e.g. English, French" />
            </div>

            {isElder && (
              <>
                <div>
                  <label style={lbl}>Interests (comma-separated)</label>
                  <input {...f('interests')} placeholder="e.g. Gardening, Reading, Chess" />
                </div>
                <div>
                  <label style={lbl}>Looking For</label>
                  <select {...f('lookingFor')} style={{ ...inp }}>
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
                  <label style={lbl}>Skills Offered (comma-separated)</label>
                  <input {...f('skillsOffered')} placeholder="e.g. Driving, Cooking, Tech help" />
                </div>
                <div>
                  <label style={lbl}>Availability Days (comma-separated)</label>
                  <input {...f('availabilityDays')} placeholder="e.g. Monday, Wednesday, Friday" />
                </div>
                <div>
                  <label style={lbl}>Availability Times (comma-separated)</label>
                  <input {...f('availabilityTimes')} placeholder="e.g. Morning, Afternoon" />
                </div>
              </>
            )}

            {msg && (
              <p style={{ fontSize: '14px', color: msg.includes('saved') ? '#155724' : '#c62828' }}>{msg}</p>
            )}

            <button type="submit" disabled={saving}
              style={{ width: '100%', background: saving ? '#86868b' : '#0066cc', color: '#fff', border: 'none', borderRadius: '9999px', padding: '12px', fontSize: '15px', fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        </div>

        {/* Verification */}
        <div style={section}>
          <p style={{ fontSize: '17px', fontWeight: 600, color: '#1d1d1f', marginBottom: '16px' }}>Verification</p>

          {/* Phone */}
          <div style={{ border: '1px solid #d2d2d7', borderRadius: '12px', padding: '16px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: '14px', fontWeight: 500, color: '#1d1d1f' }}>Phone Number</p>
              {profileData?.phoneVerified
                ? <span style={{ fontSize: '12px', background: '#d4edda', color: '#155724', padding: '2px 10px', borderRadius: '9999px' }}>Verified · +10 pts</span>
                : <span style={{ fontSize: '12px', background: '#f2f2f7', color: '#6e6e73', padding: '2px 10px', borderRadius: '9999px' }}>Not verified</span>
              }
            </div>

            {!editingPhone ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', color: '#6e6e73' }}>{profileData?.phone || 'No number on file'}</span>
                <button onClick={() => { setEditingPhone(true); setNewPhone(profileData?.phone || ''); }}
                  style={{ fontSize: '13px', color: '#0066cc', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Change
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input value={newPhone} onChange={e => setNewPhone(e.target.value)}
                  placeholder="416 555 0123"
                  style={{ ...inp, flex: 1 }}
                  onFocus={e => e.target.style.borderColor = '#0066cc'}
                  onBlur={e => e.target.style.borderColor = '#d2d2d7'} />
                <button onClick={savePhone}
                  style={{ fontSize: '13px', background: '#0066cc', color: '#fff', border: 'none', borderRadius: '9999px', padding: '7px 14px', cursor: 'pointer' }}>
                  Save
                </button>
                <button onClick={() => setEditingPhone(false)}
                  style={{ fontSize: '13px', background: '#fff', color: '#6e6e73', border: '1px solid #d2d2d7', borderRadius: '9999px', padding: '7px 12px', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            )}

            {!profileData?.phoneVerified && !editingPhone && (
              !phoneOtpSent ? (
                <button onClick={requestOtp} disabled={verifyingPhone}
                  style={{ fontSize: '13px', background: '#0066cc', color: '#fff', border: 'none', borderRadius: '9999px', padding: '7px 16px', cursor: 'pointer', alignSelf: 'flex-start' }}>
                  {verifyingPhone ? 'Sending...' : 'Send Verification Code'}
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input value={otp} onChange={e => setOtp(e.target.value)}
                    placeholder="Enter 6-digit code"
                    style={{ ...inp, flex: 1 }}
                    onFocus={e => e.target.style.borderColor = '#0066cc'}
                    onBlur={e => e.target.style.borderColor = '#d2d2d7'} />
                  <button onClick={confirmOtp} disabled={verifyingPhone || otp.length < 6}
                    style={{ fontSize: '13px', background: '#34c759', color: '#fff', border: 'none', borderRadius: '9999px', padding: '7px 14px', cursor: 'pointer' }}>
                    Confirm
                  </button>
                </div>
              )
            )}
            {otpMsg && <p style={{ fontSize: '13px', color: otpMsg.includes('verified') || otpMsg.includes('updated') ? '#155724' : '#c62828' }}>{otpMsg}</p>}
          </div>

          {/* ID */}
          <div style={{ border: '1px solid #d2d2d7', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: '14px', fontWeight: 500, color: '#1d1d1f' }}>ID Document</p>
              {profileData?.verificationStatus === 'VERIFIED'
                ? <span style={{ fontSize: '12px', background: '#d4edda', color: '#155724', padding: '2px 10px', borderRadius: '9999px' }}>Verified · +20 pts</span>
                : profileData?.verificationStatus === 'PENDING'
                ? <span style={{ fontSize: '12px', background: '#fff3cd', color: '#b45309', padding: '2px 10px', borderRadius: '9999px' }}>Under review</span>
                : <span style={{ fontSize: '12px', background: '#f2f2f7', color: '#6e6e73', padding: '2px 10px', borderRadius: '9999px' }}>Not submitted</span>
              }
            </div>
            {(profileData?.verificationStatus === 'NONE' || !profileData?.verificationStatus) && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="file" accept="image/*,.pdf" onChange={e => setIdFile(e.target.files[0])}
                  style={{ fontSize: '13px', color: '#6e6e73' }} />
                {idFile && (
                  <button onClick={uploadId} disabled={uploadingId}
                    style={{ fontSize: '13px', background: '#0066cc', color: '#fff', border: 'none', borderRadius: '9999px', padding: '7px 14px', cursor: 'pointer' }}>
                    {uploadingId ? 'Uploading...' : 'Upload'}
                  </button>
                )}
              </div>
            )}
            {idMsg && <p style={{ fontSize: '13px', color: idMsg.includes('pending') ? '#b45309' : '#c62828' }}>{idMsg}</p>}
          </div>
        </div>

        {/* Reviews */}
        <div style={section}>
          <p style={{ fontSize: '17px', fontWeight: 600, color: '#1d1d1f', marginBottom: '16px' }}>
            Reviews Received{reviews.length > 0 ? ` (${reviews.length})` : ''}
          </p>
          {reviews.length === 0 && (
            <p style={{ fontSize: '14px', color: '#86868b' }}>No reviews yet. Complete a service to receive your first review.</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {reviews.map(r => (
              <div key={r.id} style={{ border: '1px solid #f0f0f0', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ fontSize: '14px', fontWeight: 500, color: '#1d1d1f' }}>{r.reviewerName}</p>
                  <Stars rating={r.rating} />
                </div>
                {r.tags?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {r.tags.map(t => (
                      <span key={t} style={{ fontSize: '12px', background: '#d6e8ff', color: '#004499', padding: '2px 8px', borderRadius: '9999px' }}>{t}</span>
                    ))}
                  </div>
                )}
                {r.comment && <p style={{ fontSize: '14px', color: '#6e6e73' }}>{r.comment}</p>}
                {r.safetyConcern && (
                  <p style={{ fontSize: '12px', color: '#ff3b30' }}>Safety concern reported</p>
                )}
                <p style={{ fontSize: '12px', color: '#86868b' }}>{new Date(r.createdAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
