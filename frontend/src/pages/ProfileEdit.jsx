import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';
import { useAuth } from '../context/AuthContext';
import NavBar from '../components/NavBar';
import TrustBadge from '../components/TrustBadge';
import BlurFade from '../components/magic/BlurFade';
import api from '../api/axios';

const unsplash = (id, w, h) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

const LIFESTYLE_PHOTOS = [
  { id: 'photo-1576765974256-9b879d60a571', cap: 'Building trust' },
  { id: 'photo-1529156069898-49953e39b3ac', cap: 'Community' },
  { id: 'photo-1573497491208-6b1acb260507', cap: 'Helping hands' },
];

const SF = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

function Stars({ rating }) {
  return (
    <span style={{ color: '#f59e0b', letterSpacing: '-2px', fontSize: '16px' }}>
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  );
}

const initials = (name) => name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';

const Divider = () => (
  <div style={{ height: '1px', background: '#e0e0e0', margin: '4px 0' }} />
);

function FieldRow({ label, children }) {
  return (
    <div style={{ padding: '14px 0' }}>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#7a7a7a', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

export default function ProfileEdit() {
  const { user, logout } = useAuth();
  const isElder = user?.role === 'ELDER' || user?.role === 'BOTH';
  const navigate = useNavigate();

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

  const [notifPrefs, setNotifPrefs] = useState({
    messages: true,
    connectionRequests: true,
    safetyAlerts: false,
    weeklyDigest: false,
  });

  const toggleNotif = (key) => setNotifPrefs(p => ({ ...p, [key]: !p[key] }));

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
    onChange: e => setForm(p => ({ ...p, [key]: e.target.value })),
    className: 'field',
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
    } catch (err) { setOtpMsg(err?.response?.data?.message || 'Could not update number.'); }
  }

  async function requestOtp() {
    setVerifyingPhone(true);
    try { await api.post('/auth/verify-phone/request'); setPhoneOtpSent(true); setOtpMsg('Code sent to your phone.'); }
    catch (err) { setOtpMsg(err?.response?.data?.message || 'Could not send code.'); }
    finally { setVerifyingPhone(false); }
  }

  async function confirmOtp() {
    setVerifyingPhone(true);
    try {
      await api.post('/auth/verify-phone/confirm', { otp });
      setOtpMsg('Phone verified! Trust score updated.');
      setPhoneOtpSent(false); setOtp('');
      const r = await api.get('/profile/me'); setProfileData(r.data);
    } catch (err) { setOtpMsg(err?.response?.data?.message || 'Invalid code.'); }
    finally { setVerifyingPhone(false); }
  }

  async function uploadId() {
    if (!idFile) return;
    setUploadingId(true);
    const fd = new FormData(); fd.append('file', idFile);
    try { await api.post('/auth/verify-id', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); setIdMsg('ID uploaded. Verification pending review.'); }
    catch (err) { setIdMsg(err?.response?.data?.message || 'Upload failed.'); }
    finally { setUploadingId(false); }
  }

  async function uploadPhoto() {
    if (!photoFile) return;
    setUploadingPhoto(true);
    const data = new FormData(); data.append('file', photoFile);
    try {
      const r = await api.put('/profile/photo', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      setProfileData(p => ({ ...p, photoUrl: r.data.photoUrl }));
      setPhotoMsg('Photo updated.'); setPhotoFile(null);
    } catch (err) { setPhotoMsg(err?.response?.data?.message || 'Upload failed.'); }
    finally { setUploadingPhoto(false); }
  }

  async function save(e) {
    e.preventDefault(); setSaving(true); setMsg('');
    try {
      if (isElder) {
        await api.put('/profile/elder', {
          name: form.name, age: Number(form.age), bio: form.bio,
          interests: toArr(form.interests), languages: toArr(form.languages), lookingFor: form.lookingFor,
        });
      } else {
        await api.put('/profile/helper', {
          name: form.name, age: Number(form.age), bio: form.bio,
          skillsOffered: toArr(form.skillsOffered), languages: toArr(form.languages),
          availabilityDays: toArr(form.availabilityDays), availabilityTimes: toArr(form.availabilityTimes),
        });
      }
      setMsg('Profile saved.');
    } catch (err) { setMsg(err?.response?.data?.message || 'Failed to save. Try again.'); }
    finally { setSaving(false); }
  }

  const verBadge = (ok, pts) => ok
    ? <span style={{ fontSize: '11px', background: 'rgba(52,199,89,0.1)', color: '#1a7a3c', border: '1px solid rgba(52,199,89,0.2)', padding: '2px 10px', borderRadius: '9999px', fontWeight: 600 }}>Verified · +{pts} pts</span>
    : null;

  const card = {
    background: '#ffffff',
    borderRadius: '18px',
    padding: '28px 28px',
    marginBottom: '0',
  };

  const sectionHeader = (title) => (
    <p style={{ fontSize: '22px', fontWeight: 600, color: '#1d1d1f', fontFamily: SF, letterSpacing: '-0.3px', marginBottom: '20px' }}>
      {title}
    </p>
  );

  return (
    <div style={{ minHeight: '100svh', background: '#fafafc', fontFamily: SFText }}>
      <NavBar />

      {/* Hero section */}
      <BlurFade delay={1}>
        <div style={{
          background: '#fafafc',
          borderBottom: '1px solid #e0e0e0',
          padding: '40px 24px 32px',
          textAlign: 'center',
        }}>
          {/* Avatar circle */}
          <div style={{
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            border: '3px solid #e0e0e0',
            overflow: 'hidden',
            margin: '0 auto 16px',
            background: profileData?.photoUrl ? 'transparent' : (isElder ? 'linear-gradient(135deg,#0055aa,#5856d6)' : 'linear-gradient(135deg,#065f46,#0066cc)'),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            fontWeight: 700,
            color: '#fff',
            position: 'relative',
          }}>
            {profileData?.photoUrl
              ? <img src={profileData.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials(form.name)
            }
          </div>

          {/* Photo upload */}
          <div style={{ marginBottom: '16px' }}>
            <input type="file" accept="image/*" id="photo-upload" onChange={e => setPhotoFile(e.target.files[0])}
              style={{ display: 'none' }} />
            <label htmlFor="photo-upload" style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#0066cc',
              cursor: 'pointer',
              background: 'rgba(0,102,204,0.08)',
              border: '1px solid rgba(0,102,204,0.2)',
              borderRadius: '9999px',
              padding: '6px 16px',
              display: 'inline-block',
            }}>
              {photoFile ? photoFile.name.slice(0, 14) + '…' : 'Change Photo'}
            </label>
            {photoFile && (
              <button onClick={uploadPhoto} disabled={uploadingPhoto} style={{
                marginLeft: '8px',
                background: '#0066cc',
                color: '#fff',
                border: 'none',
                borderRadius: '9999px',
                padding: '6px 16px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: SFText,
              }}>
                {uploadingPhoto ? 'Uploading…' : 'Upload'}
              </button>
            )}
            {photoMsg && <p style={{ fontSize: '13px', color: '#1a7a3c', marginTop: '6px' }}>{photoMsg}</p>}
          </div>

          <h1 style={{
            fontSize: '40px',
            fontWeight: 600,
            color: '#1d1d1f',
            fontFamily: SF,
            letterSpacing: '-0.8px',
            marginBottom: '8px',
          }}>
            {form.name || 'Your Name'}
          </h1>
          <p style={{ fontSize: '16px', color: '#7a7a7a', marginBottom: '12px' }}>
            {isElder ? 'Elder' : 'Helper'}
          </p>
          {profileData && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <TrustBadge tier={profileData.trustTier} score={profileData.trustScore} />
            </div>
          )}
        </div>
      </BlurFade>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 24px 80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

          {/* LEFT: Personal info form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <BlurFade delay={2}>
              <div style={card}>
                {sectionHeader('Personal Information')}
                <Divider />
                <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column' }}>
                  <FieldRow label="Full Name">
                    <input {...f('name')} placeholder="Your name" required style={{ width: '100%', boxSizing: 'border-box' }} />
                  </FieldRow>
                  <Divider />
                  <FieldRow label="Age">
                    <input {...f('age')} type="number"
                      placeholder={isElder ? '50–120' : '18–80'}
                      min={isElder ? 50 : 18} max={isElder ? 120 : 80} required
                      style={{ width: '100%', boxSizing: 'border-box' }} />
                  </FieldRow>
                  <Divider />
                  <FieldRow label="Bio">
                    <textarea {...f('bio')} rows={3}
                      style={{
                        width: '100%',
                        border: '1.5px solid #e0e0e0',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        fontSize: '15px',
                        fontFamily: SFText,
                        color: '#1d1d1f',
                        background: '#ffffff',
                        outline: 'none',
                        resize: 'vertical',
                        boxSizing: 'border-box',
                      }}
                      placeholder="Tell us a bit about yourself..." />
                  </FieldRow>
                  <Divider />
                  <FieldRow label="Languages">
                    <input {...f('languages')} placeholder="English, French" style={{ width: '100%', boxSizing: 'border-box' }} />
                  </FieldRow>

                  {isElder && (
                    <>
                      <Divider />
                      <FieldRow label="Interests">
                        <input {...f('interests')} placeholder="Gardening, Reading, Chess" style={{ width: '100%', boxSizing: 'border-box' }} />
                      </FieldRow>
                      <Divider />
                      <FieldRow label="Looking For">
                        <select {...f('lookingFor')} className="field" style={{ width: '100%', boxSizing: 'border-box' }}>
                          <option value="FRIENDSHIP">Friendship</option>
                          <option value="HELP">Help</option>
                          <option value="BOTH">Both</option>
                        </select>
                      </FieldRow>
                    </>
                  )}

                  {!isElder && (
                    <>
                      <Divider />
                      <FieldRow label="Skills Offered">
                        <input {...f('skillsOffered')} placeholder="Driving, Cooking, Tech help" style={{ width: '100%', boxSizing: 'border-box' }} />
                      </FieldRow>
                      <Divider />
                      <FieldRow label="Availability Days">
                        <input {...f('availabilityDays')} placeholder="Monday, Wednesday" style={{ width: '100%', boxSizing: 'border-box' }} />
                      </FieldRow>
                      <Divider />
                      <FieldRow label="Availability Times">
                        <input {...f('availabilityTimes')} placeholder="Morning, Afternoon" style={{ width: '100%', boxSizing: 'border-box' }} />
                      </FieldRow>
                    </>
                  )}

                  {msg && (
                    <p style={{ fontSize: '14px', color: msg.includes('saved') ? '#1a7a3c' : '#cc0000', fontWeight: 500, marginTop: '8px' }}>
                      {msg}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      marginTop: '20px',
                      width: '100%',
                      background: '#0066cc',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '9999px',
                      padding: '14px 0',
                      fontSize: '16px',
                      fontWeight: 600,
                      fontFamily: SFText,
                      cursor: 'pointer',
                    }}
                  >
                    {saving ? 'Saving…' : 'Save Profile'}
                  </button>
                </form>
              </div>
            </BlurFade>

            {/* Verification card */}
            <BlurFade delay={3}>
              <div style={card}>
                {sectionHeader('Verification')}

                {/* Phone */}
                <div style={{ border: '1.5px solid #e0e0e0', borderRadius: '14px', padding: '18px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(0,102,204,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0066cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.89 11a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.78 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                        </svg>
                      </div>
                      <div>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: '#1d1d1f' }}>Phone Number</p>
                        <p style={{ fontSize: '13px', color: '#7a7a7a' }}>{profileData?.phone || 'No number on file'}</p>
                      </div>
                    </div>
                    {profileData?.phoneVerified
                      ? verBadge(true, 10)
                      : <span style={{ fontSize: '11px', background: 'rgba(160,160,165,0.1)', color: '#a0a0a5', border: '1px solid #e0e0e0', padding: '2px 10px', borderRadius: '9999px', fontWeight: 600 }}>Not verified</span>
                    }
                  </div>

                  {!editingPhone ? (
                    <button onClick={() => { setEditingPhone(true); setNewPhone(profileData?.phone || ''); }}
                      className="ghost-btn" style={{ alignSelf: 'flex-start', fontSize: '12px', padding: '5px 14px' }}>
                      Change number
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="416 555 0123" className="field" style={{ flex: 1 }} />
                      <button onClick={savePhone} className="primary-btn" style={{ fontSize: '13px' }}>Save</button>
                      <button onClick={() => setEditingPhone(false)} className="ghost-btn" style={{ fontSize: '13px' }}>Cancel</button>
                    </div>
                  )}

                  {!profileData?.phoneVerified && !editingPhone && (
                    !phoneOtpSent ? (
                      <button onClick={requestOtp} disabled={verifyingPhone} className="primary-btn" style={{ alignSelf: 'flex-start', fontSize: '13px' }}>
                        {verifyingPhone ? 'Sending…' : 'Send verification code'}
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input value={otp} onChange={e => setOtp(e.target.value)} placeholder="6-digit code" className="field" style={{ flex: 1 }} />
                        <button onClick={confirmOtp} disabled={verifyingPhone || otp.length < 6}
                          className="primary-btn" style={{ background: '#34c759', fontSize: '13px' }}>Confirm</button>
                      </div>
                    )
                  )}
                  {otpMsg && <p style={{ fontSize: '13px', color: otpMsg.includes('verified') || otpMsg.includes('updated') ? '#1a7a3c' : '#cc0000', fontWeight: 500 }}>{otpMsg}</p>}
                </div>

                {/* ID */}
                <div style={{ border: '1.5px solid #e0e0e0', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                        </svg>
                      </div>
                      <div>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: '#1d1d1f' }}>ID Document</p>
                        <p style={{ fontSize: '13px', color: '#7a7a7a' }}>Driver's licence or passport</p>
                      </div>
                    </div>
                    {profileData?.verificationStatus === 'VERIFIED'
                      ? verBadge(true, 20)
                      : profileData?.verificationStatus === 'PENDING'
                      ? <span style={{ fontSize: '11px', background: 'rgba(245,158,11,0.1)', color: '#b45309', border: '1px solid rgba(245,158,11,0.25)', padding: '2px 10px', borderRadius: '9999px', fontWeight: 600 }}>Under review</span>
                      : <span style={{ fontSize: '11px', background: 'rgba(160,160,165,0.1)', color: '#a0a0a5', border: '1px solid #e0e0e0', padding: '2px 10px', borderRadius: '9999px', fontWeight: 600 }}>Not submitted</span>
                    }
                  </div>
                  {(profileData?.verificationStatus === 'NONE' || !profileData?.verificationStatus) && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <input type="file" accept="image/*,.pdf" onChange={e => setIdFile(e.target.files[0])}
                        style={{ fontSize: '13px', color: '#7a7a7a', flex: 1 }} />
                      {idFile && (
                        <button onClick={uploadId} disabled={uploadingId} className="primary-btn" style={{ fontSize: '13px' }}>
                          {uploadingId ? 'Uploading…' : 'Upload'}
                        </button>
                      )}
                    </div>
                  )}
                  {idMsg && <p style={{ fontSize: '13px', color: idMsg.includes('pending') ? '#f59e0b' : '#cc0000', fontWeight: 500 }}>{idMsg}</p>}
                </div>
              </div>
            </BlurFade>
          </div>

          {/* RIGHT: Preferences, notifications, danger zone */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Community photos strip */}
            <BlurFade delay={2}>
              <div style={card}>
                <p style={{ fontSize: '12px', fontWeight: 600, color: '#a0a0a5', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '14px' }}>
                  Our Community
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {LIFESTYLE_PHOTOS.map(({ id, cap }) => (
                    <div key={id} style={{ borderRadius: '10px', overflow: 'hidden', aspectRatio: '1', position: 'relative' }}>
                      <LazyLoadImage
                        src={unsplash(id, 200, 200)}
                        alt={cap}
                        effect="blur"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        wrapperProps={{ style: { width: '100%', height: '100%', display: 'block' } }}
                      />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent)', padding: '6px 8px' }}>
                        <p style={{ fontSize: '10px', color: '#fff', fontWeight: 600 }}>{cap}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </BlurFade>

            {/* Notifications card */}
            <BlurFade delay={3}>
              <div style={card}>
                {sectionHeader('Notifications')}
                {[
                  { label: 'New messages', sub: 'Get notified when someone messages you', key: 'messages' },
                  { label: 'Connection requests', sub: 'When someone wants to connect', key: 'connectionRequests' },
                  { label: 'Safety alerts', sub: 'Emergency and trust notifications', key: 'safetyAlerts' },
                  { label: 'Weekly digest', sub: 'Summary of your community activity', key: 'weeklyDigest' },
                ].map((row, idx, arr) => {
                  const on = notifPrefs[row.key];
                  return (
                    <div key={row.key}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 0',
                      }}>
                        <div>
                          <p style={{ fontSize: '15px', fontWeight: 500, color: '#1d1d1f', marginBottom: '2px' }}>
                            {row.label}
                          </p>
                          <p style={{ fontSize: '13px', color: '#7a7a7a' }}>{row.sub}</p>
                        </div>
                        {/* iOS-style toggle */}
                        <div
                          role="switch"
                          aria-checked={on}
                          onClick={() => toggleNotif(row.key)}
                          style={{
                            width: '51px',
                            height: '31px',
                            borderRadius: '9999px',
                            background: on ? '#34c759' : '#e0e0e0',
                            position: 'relative',
                            cursor: 'pointer',
                            flexShrink: 0,
                            transition: 'background 0.2s',
                          }}>
                          <div style={{
                            position: 'absolute',
                            top: '2px',
                            left: on ? '20px' : '2px',
                            width: '27px',
                            height: '27px',
                            borderRadius: '50%',
                            background: '#ffffff',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                            transition: 'left 0.2s',
                          }} />
                        </div>
                      </div>
                      {idx < arr.length - 1 && <Divider />}
                    </div>
                  );
                })}
              </div>
            </BlurFade>

            {/* Reviews received */}
            <BlurFade delay={4}>
              <div style={card}>
                <p style={{ fontSize: '22px', fontWeight: 600, color: '#1d1d1f', fontFamily: SF, letterSpacing: '-0.3px', marginBottom: '20px' }}>
                  Reviews Received {reviews.length > 0 && (
                    <span style={{ fontSize: '16px', fontWeight: 400, color: '#a0a0a5' }}>({reviews.length})</span>
                  )}
                </p>
                {reviews.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(245,158,11,0.1)', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                    </div>
                    <p style={{ fontSize: '14px', color: '#a0a0a5' }}>No reviews yet. Complete a service to receive your first review.</p>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {reviews.map(r => (
                    <div key={r.id} style={{ border: '1px solid #e0e0e0', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: '#1d1d1f' }}>{r.reviewerName}</p>
                        <Stars rating={r.rating} />
                      </div>
                      {r.tags?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {r.tags.map(t => (
                            <span key={t} style={{ fontSize: '11px', background: 'rgba(0,102,204,0.08)', color: '#0066cc', border: '1px solid rgba(0,102,204,0.15)', padding: '2px 8px', borderRadius: '9999px', fontWeight: 600 }}>{t}</span>
                          ))}
                        </div>
                      )}
                      {r.comment && <p style={{ fontSize: '14px', color: '#7a7a7a', lineHeight: 1.6 }}>{r.comment}</p>}
                      <p style={{ fontSize: '12px', color: '#a0a0a5' }}>{new Date(r.createdAt).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            </BlurFade>

            {/* Danger zone */}
            <BlurFade delay={5}>
              <div style={{
                background: '#ffffff',
                borderRadius: '18px',
                padding: '20px 24px',
                border: '1.5px solid #ffe0e0',
              }}>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#a0a0a5', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '14px' }}>
                  Account
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => { logout(); navigate('/login'); }}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      color: '#0066cc',
                      border: '1.5px solid rgba(0,102,204,0.3)',
                      borderRadius: '9999px',
                      padding: '10px 0',
                      fontSize: '14px',
                      fontWeight: 600,
                      fontFamily: SFText,
                      cursor: 'pointer',
                    }}
                  >
                    Sign Out
                  </button>
                  <button
                    onClick={() => alert('To delete your account, please contact support at support@towin.app')}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      color: '#cc0000',
                      border: '1.5px solid rgba(204,0,0,0.3)',
                      borderRadius: '9999px',
                      padding: '10px 0',
                      fontSize: '14px',
                      fontWeight: 600,
                      fontFamily: SFText,
                      cursor: 'pointer',
                    }}
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            </BlurFade>

          </div>
        </div>
      </div>
    </div>
  );
}
