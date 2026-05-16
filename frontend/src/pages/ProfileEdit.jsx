import { useEffect, useState } from 'react';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';
import { useAuth } from '../context/AuthContext';
import NavBar from '../components/NavBar';
import TrustBadge from '../components/TrustBadge';
import BlurFade from '../components/magic/BlurFade';
import api from '../api/axios';

const unsplash = (id, w, h) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

/* Lifestyle photos shown as inspiration strip */
const LIFESTYLE_PHOTOS = [
  { id: 'photo-1576765974256-9b879d60a571', cap: 'Building trust' },
  { id: 'photo-1529156069898-49953e39b3ac', cap: 'Community' },
  { id: 'photo-1573497491208-6b1acb260507', cap: 'Helping hands' },
];

function Stars({ rating }) {
  return (
    <span style={{ color: 'var(--amber)', letterSpacing: '-2px', fontSize: '16px' }}>
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  );
}

const initials = (name) => name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';

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
    ? <span style={{ fontSize: '11px', background: 'rgba(34,197,94,0.1)', color: 'var(--green)', border: '1px solid rgba(34,197,94,0.2)', padding: '2px 10px', borderRadius: '9999px', fontWeight: 600 }}>Verified · +{pts} pts</span>
    : null;

  return (
    <div style={{ minHeight: '100svh', background: 'var(--surface)' }}>
      <NavBar />
      <div style={{ maxWidth: '660px', margin: '0 auto', padding: '32px 16px 60px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Profile hero */}
        <BlurFade delay={1}>
          <div className="card" style={{ overflow: 'hidden' }}>
            {/* Photo cover banner */}
            <div style={{ height: '140px', position: 'relative', overflow: 'hidden' }}>
              <LazyLoadImage
                src={unsplash('photo-1576765974256-9b879d60a571', 700, 280)}
                alt=""
                effect="blur"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                wrapperProps={{ style: { width: '100%', height: '100%', display: 'block' } }}
              />
              <div style={{
                position: 'absolute', inset: 0,
                background: isElder
                  ? 'linear-gradient(135deg, rgba(29,78,216,0.7) 0%, rgba(124,58,237,0.45) 100%)'
                  : 'linear-gradient(135deg, rgba(6,95,70,0.7) 0%, rgba(37,99,235,0.45) 100%)',
              }} />
              {/* Avatar */}
              <div style={{
                position: 'absolute', bottom: '-28px', left: '24px',
                width: '60px', height: '60px', borderRadius: '50%',
                border: '3px solid var(--canvas)',
                overflow: 'hidden',
                background: profileData?.photoUrl ? 'transparent' : (isElder ? 'linear-gradient(135deg,#1d4ed8,#7c3aed)' : 'linear-gradient(135deg,#065f46,#2563eb)'),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '18px', fontWeight: 700, color: '#fff',
                boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
              }}>
                {profileData?.photoUrl
                  ? <img src={profileData.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : initials(form.name)
                }
              </div>
            </div>

            <div style={{ padding: '40px 24px 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <p className="font-display" style={{ fontSize: '22px', color: 'var(--ink)', letterSpacing: '-0.2px' }}>
                  {form.name || 'Your Name'}
                </p>
                {profileData && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                    <TrustBadge tier={profileData.trustTier} score={profileData.trustScore} />
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                <input type="file" accept="image/*" id="photo-upload" onChange={e => setPhotoFile(e.target.files[0])}
                  style={{ display: 'none' }} />
                <label htmlFor="photo-upload" style={{
                  fontSize: '12px', fontWeight: 600, color: 'var(--blue)',
                  cursor: 'pointer', background: 'rgba(37,99,235,0.08)',
                  border: '1px solid rgba(37,99,235,0.2)', borderRadius: '9999px', padding: '4px 12px',
                }}>
                  {photoFile ? photoFile.name.slice(0, 12) + '…' : 'Change photo'}
                </label>
                {photoFile && (
                  <button onClick={uploadPhoto} disabled={uploadingPhoto} className="primary-btn" style={{ fontSize: '12px', padding: '4px 12px' }}>
                    {uploadingPhoto ? 'Uploading…' : 'Upload'}
                  </button>
                )}
                {photoMsg && <p style={{ fontSize: '12px', color: 'var(--green)' }}>{photoMsg}</p>}
              </div>
            </div>
          </div>
        </BlurFade>

        {/* Lifestyle photo strip */}
        <BlurFade delay={2}>
          <div className="card" style={{ padding: '20px 24px' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '14px' }}>
              Our community
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {LIFESTYLE_PHOTOS.map(({ id, cap }) => (
                <div key={id} style={{ borderRadius: '12px', overflow: 'hidden', aspectRatio: '16/9', position: 'relative' }} className="lift">
                  <LazyLoadImage
                    src={unsplash(id, 280, 160)}
                    alt={cap}
                    effect="blur"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    wrapperProps={{ style: { width: '100%', height: '100%', display: 'block' } }}
                  />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)', padding: '8px 10px' }}>
                    <p style={{ fontSize: '11px', color: '#fff', fontWeight: 600 }}>{cap}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </BlurFade>

        {/* Profile form */}
        <BlurFade delay={3}>
          <div className="card" style={{ padding: '24px' }}>
            <p className="font-display" style={{ fontSize: '22px', color: 'var(--ink)', marginBottom: '20px' }}>
              {isElder ? 'Elder Profile' : 'Helper Profile'}
            </p>

            <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>Full Name</label>
                  <input {...f('name')} placeholder="Your name" required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>Age</label>
                  <input {...f('age')} type="number"
                    placeholder={isElder ? '50–120' : '18–80'}
                    min={isElder ? 50 : 18} max={isElder ? 120 : 80} required />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>Bio</label>
                <textarea {...f('bio')} rows={3}
                  style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: '12px', padding: '12px 16px', fontSize: '15px', fontFamily: 'var(--font-body)', color: 'var(--ink)', background: 'var(--canvas)', outline: 'none', resize: 'vertical', transition: 'border-color 0.15s' }}
                  placeholder="Tell us a bit about yourself..." />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>Languages</label>
                <input {...f('languages')} placeholder="English, French" />
              </div>

              {isElder && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>Interests</label>
                    <input {...f('interests')} placeholder="Gardening, Reading, Chess" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>Looking For</label>
                    <select {...f('lookingFor')} className="field">
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
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>Skills Offered</label>
                    <input {...f('skillsOffered')} placeholder="Driving, Cooking, Tech help" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>Availability Days</label>
                      <input {...f('availabilityDays')} placeholder="Monday, Wednesday" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>Availability Times</label>
                      <input {...f('availabilityTimes')} placeholder="Morning, Afternoon" />
                    </div>
                  </div>
                </>
              )}

              {msg && (
                <p style={{ fontSize: '14px', color: msg.includes('saved') ? 'var(--green)' : 'var(--red)', fontWeight: 500 }}>{msg}</p>
              )}

              <button type="submit" disabled={saving} className="shimmer-btn" style={{ width: '100%' }}>
                {saving ? 'Saving…' : 'Save Profile'}
              </button>
            </form>
          </div>
        </BlurFade>

        {/* Verification */}
        <BlurFade delay={4}>
          <div className="card" style={{ padding: '24px' }}>
            <p className="font-display" style={{ fontSize: '22px', color: 'var(--ink)', marginBottom: '20px' }}>Verification</p>

            {/* Phone */}
            <div style={{ border: '1.5px solid var(--border)', borderRadius: '14px', padding: '18px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(37,99,235,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.89 11a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.78 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                  </div>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>Phone Number</p>
                    <p style={{ fontSize: '13px', color: 'var(--ink-2)' }}>{profileData?.phone || 'No number on file'}</p>
                  </div>
                </div>
                {profileData?.phoneVerified
                  ? verBadge(true, 10)
                  : <span style={{ fontSize: '11px', background: 'rgba(148,163,184,0.1)', color: 'var(--ink-3)', border: '1px solid var(--border)', padding: '2px 10px', borderRadius: '9999px', fontWeight: 600 }}>Not verified</span>
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
                      className="primary-btn" style={{ background: 'var(--green)', fontSize: '13px' }}>Confirm</button>
                  </div>
                )
              )}
              {otpMsg && <p style={{ fontSize: '13px', color: otpMsg.includes('verified') || otpMsg.includes('updated') ? 'var(--green)' : 'var(--red)', fontWeight: 500 }}>{otpMsg}</p>}
            </div>

            {/* ID */}
            <div style={{ border: '1.5px solid var(--border)', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                    </svg>
                  </div>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>ID Document</p>
                    <p style={{ fontSize: '13px', color: 'var(--ink-2)' }}>Driver's licence or passport</p>
                  </div>
                </div>
                {profileData?.verificationStatus === 'VERIFIED'
                  ? verBadge(true, 20)
                  : profileData?.verificationStatus === 'PENDING'
                  ? <span style={{ fontSize: '11px', background: 'rgba(245,158,11,0.1)', color: '#b45309', border: '1px solid rgba(245,158,11,0.25)', padding: '2px 10px', borderRadius: '9999px', fontWeight: 600 }}>Under review</span>
                  : <span style={{ fontSize: '11px', background: 'rgba(148,163,184,0.1)', color: 'var(--ink-3)', border: '1px solid var(--border)', padding: '2px 10px', borderRadius: '9999px', fontWeight: 600 }}>Not submitted</span>
                }
              </div>
              {(profileData?.verificationStatus === 'NONE' || !profileData?.verificationStatus) && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input type="file" accept="image/*,.pdf" onChange={e => setIdFile(e.target.files[0])}
                    style={{ fontSize: '13px', color: 'var(--ink-2)', flex: 1 }} />
                  {idFile && (
                    <button onClick={uploadId} disabled={uploadingId} className="primary-btn" style={{ fontSize: '13px' }}>
                      {uploadingId ? 'Uploading…' : 'Upload'}
                    </button>
                  )}
                </div>
              )}
              {idMsg && <p style={{ fontSize: '13px', color: idMsg.includes('pending') ? 'var(--amber)' : 'var(--red)', fontWeight: 500 }}>{idMsg}</p>}
            </div>
          </div>
        </BlurFade>

        {/* Reviews received */}
        <BlurFade delay={5}>
          <div className="card" style={{ padding: '24px' }}>
            <p className="font-display" style={{ fontSize: '22px', color: 'var(--ink)', marginBottom: '20px' }}>
              Reviews Received {reviews.length > 0 && <span style={{ fontSize: '16px', color: 'var(--ink-3)' }}>({reviews.length})</span>}
            </p>
            {reviews.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(245,158,11,0.1)', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                </div>
                <p style={{ fontSize: '14px', color: 'var(--ink-3)' }}>No reviews yet. Complete a service to receive your first review.</p>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {reviews.map(r => (
                <div key={r.id} style={{ border: '1px solid var(--border)', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>{r.reviewerName}</p>
                    <Stars rating={r.rating} />
                  </div>
                  {r.tags?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {r.tags.map(t => (
                        <span key={t} style={{ fontSize: '11px', background: 'rgba(37,99,235,0.08)', color: 'var(--blue)', border: '1px solid rgba(37,99,235,0.15)', padding: '2px 8px', borderRadius: '9999px', fontWeight: 600 }}>{t}</span>
                      ))}
                    </div>
                  )}
                  {r.comment && <p style={{ fontSize: '14px', color: 'var(--ink-2)', lineHeight: 1.6 }}>{r.comment}</p>}
                  <p style={{ fontSize: '12px', color: 'var(--ink-3)' }}>{new Date(r.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </div>
        </BlurFade>

      </div>
    </div>
  );
}
