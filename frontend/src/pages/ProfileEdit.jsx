import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, ShieldCheck, Star as StarIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import NavBar from '../components/NavBar';
import TrustBadge from '../components/TrustBadge';
import BlurFade from '../components/magic/BlurFade';
import ConfirmDialog from '../components/ConfirmDialog';
import api from '../api/axios';

const SF = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

const SKY = '#4FA3CE';
const SKY_TINT = 'rgba(79,163,206,0.10)';
const SKY_BORDER = 'rgba(79,163,206,0.22)';
const LEAF = '#4FA3CE';
const LEAF_DARK = '#4FA3CE';
const LEAF_TINT = 'rgba(79,163,206,0.10)';
const LEAF_BORDER = 'rgba(79,163,206,0.22)';
const MUTED = '#a0a0a5';
const BORDER = '#e0e0e0';

const STAR_GOLD = '#F5B400';

function computeAge(dobStr) {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  const now = new Date();
  const totalDays = Math.floor((now - dob) / (1000 * 60 * 60 * 24));
  let years = now.getFullYear() - dob.getFullYear();
  let months = now.getMonth() - dob.getMonth();
  let days = now.getDate() - dob.getDate();
  if (days < 0) { months -= 1; days += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
  if (months < 0) { years -= 1; months += 12; }
  return { totalDays, years, months, days };
}

function Stars({ rating }) {
  return (
    <span style={{ color: STAR_GOLD, letterSpacing: '-2px', fontSize: '16px' }}>
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
    hobbies: '', occupation: '', facebookUrl: '', instagramUrl: '', dateOfBirth: '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirmSignOut, setConfirmSignOut] = useState(false);
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
        hobbies: (p.hobbies || []).join(', '),
        occupation: p.occupation || '',
        facebookUrl: p.facebookUrl || '',
        instagramUrl: p.instagramUrl || '',
        dateOfBirth: p.dateOfBirth || '',
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
      setPhoneOtpSent(false);
      await requestOtp();
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
    const computedAge = form.dateOfBirth
      ? (computeAge(form.dateOfBirth)?.years ?? Number(form.age))
      : Number(form.age);
    try {
      if (isElder) {
        await api.put('/profile/elder', {
          name: form.name, age: computedAge, bio: form.bio,
          interests: toArr(form.interests), languages: toArr(form.languages), lookingFor: form.lookingFor,
          facebookUrl: form.facebookUrl || null,
          instagramUrl: form.instagramUrl || null,
          occupation: form.occupation || null,
          dateOfBirth: form.dateOfBirth || null,
        });
      } else {
        await api.put('/profile/helper', {
          name: form.name, age: computedAge, bio: form.bio,
          skillsOffered: toArr(form.skillsOffered), languages: toArr(form.languages),
          availabilityDays: toArr(form.availabilityDays), availabilityTimes: toArr(form.availabilityTimes),
          hobbies: toArr(form.hobbies),
          occupation: form.occupation,
          facebookUrl: form.facebookUrl,
          instagramUrl: form.instagramUrl,
          dateOfBirth: form.dateOfBirth || null,
        });
      }
      setMsg('Profile saved.');
    } catch (err) { setMsg(err?.response?.data?.message || 'Failed to save. Try again.'); }
    finally { setSaving(false); }
  }

  const verBadge = (ok, pts) => ok
    ? <span style={{ fontSize: '11px', background: 'rgba(79,163,206,0.10)', color: '#4FA3CE', border: '1px solid rgba(79,163,206,0.20)', padding: '2px 10px', borderRadius: '9999px', fontWeight: 600 }}>Verified · +{pts} pts</span>
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

      {/* Hero section — calm sky-blue, matches app theme */}
      <BlurFade delay={1}>
        <div style={{
          background: 'linear-gradient(180deg, #EAF5FB 0%, #f5f5f7 100%)',
          borderBottom: '1px solid #DCEBF4',
          padding: 'clamp(28px, 6vw, 48px) 20px clamp(24px, 4vw, 36px)',
          textAlign: 'center',
        }}>
          {/* Avatar circle */}
          <div style={{
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            border: '3px solid #ffffff',
            boxShadow: '0 4px 16px rgba(79,163,206,0.18)',
            overflow: 'hidden',
            margin: '0 auto 16px',
            background: profileData?.photoUrl ? 'transparent' : `linear-gradient(135deg, ${SKY}, ${LEAF})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            fontWeight: 600,
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
              color: '#4FA3CE',
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
                background: '#4FA3CE',
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
            {photoMsg && <p style={{ fontSize: '13px', color: '#4FA3CE', marginTop: '6px' }}>{photoMsg}</p>}
          </div>

          <h1 style={{
            fontSize: 'clamp(26px, 7vw, 40px)',
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
        <div className="profile-edit-grid">

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
                    {form.dateOfBirth ? (() => {
                      const age = computeAge(form.dateOfBirth);
                      return age ? (
                        <div style={{
                          padding: '10px 14px', borderRadius: '12px',
                          background: '#f5f5f7', border: '1.5px solid #e0e0e0',
                          fontSize: '14px', color: '#1d1d1f', lineHeight: 1.6,
                        }}>
                          <span style={{ fontWeight: 600, fontSize: '20px', color: '#1a5c2e' }}>
                            {age.years}
                          </span>
                          <span style={{ color: '#7a7a7a' }}> years old</span>
                          <br />
                          <span style={{ fontSize: '12px', color: '#a0a0a5' }}>
                            {age.totalDays.toLocaleString()} days · {age.months} mo {age.days} d
                          </span>
                        </div>
                      ) : null;
                    })() : (
                      <input {...f('age')} type="number"
                        placeholder="Your age"
                        min={1} max={150}
                        style={{ width: '100%', boxSizing: 'border-box' }} />
                    )}
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
                      <Divider />
                      <FieldRow label="Hobbies">
                        <input {...f('hobbies')} placeholder="Reading, Hiking, Cooking" style={{ width: '100%', boxSizing: 'border-box' }} />
                      </FieldRow>
                    </>
                  )}

                  {/* Shared fields — all roles */}
                  <Divider />
                  <FieldRow label="Date of Birth">
                    <input {...f('dateOfBirth')} type="date" style={{ width: '100%', boxSizing: 'border-box' }} />
                  </FieldRow>
                  <Divider />
                  <FieldRow label="Occupation">
                    <input {...f('occupation')} placeholder="e.g. Retired teacher, Artist" style={{ width: '100%', boxSizing: 'border-box' }} />
                  </FieldRow>
                  <Divider />
                  <FieldRow label="Facebook URL">
                    <input {...f('facebookUrl')} placeholder="https://facebook.com/yourname" style={{ width: '100%', boxSizing: 'border-box' }} />
                  </FieldRow>
                  <Divider />
                  <FieldRow label="Instagram URL">
                    <input {...f('instagramUrl')} placeholder="https://instagram.com/yourname" style={{ width: '100%', boxSizing: 'border-box' }} />
                  </FieldRow>

                  {msg && (
                    <p style={{ fontSize: '14px', color: msg.includes('saved') ? '#4FA3CE' : '#5a6470', fontWeight: 500, marginTop: '8px' }}>
                      {msg}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      marginTop: '20px',
                      width: '100%',
                      background: '#4FA3CE',
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
          </div>

          {/* RIGHT: Reviews + Verification + Account */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

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
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: LEAF_TINT, border: `1px solid ${LEAF_BORDER}`, margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <StarIcon size={20} color={STAR_GOLD} strokeWidth={2} fill={STAR_GOLD} />
                    </div>
                    <p style={{ fontSize: '14px', color: MUTED }}>No reviews yet. Complete a service to receive your first review.</p>
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
                            <span key={t} style={{ fontSize: '11px', background: 'rgba(0,102,204,0.08)', color: '#4FA3CE', border: '1px solid rgba(0,102,204,0.15)', padding: '2px 8px', borderRadius: '9999px', fontWeight: 600 }}>{t}</span>
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

            {/* Verification card */}
            <BlurFade delay={4}>
              <div style={card}>
                {sectionHeader('Verification')}

                {/* Phone */}
                <div style={{ border: '1.5px solid #e0e0e0', borderRadius: '14px', padding: '18px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: SKY_TINT, border: `1px solid ${SKY_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Phone size={18} color={SKY} strokeWidth={2} />
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
                          className="primary-btn" style={{ background: '#4FA3CE', fontSize: '13px' }}>Confirm</button>
                      </div>
                    )
                  )}
                  {otpMsg && <p style={{ fontSize: '13px', color: otpMsg.includes('verified') || otpMsg.includes('updated') ? '#4FA3CE' : '#5a6470', fontWeight: 500 }}>{otpMsg}</p>}
                </div>

                {/* ID */}
                <div style={{ border: '1.5px solid #e0e0e0', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: SKY_TINT, border: `1px solid ${SKY_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ShieldCheck size={18} color={SKY} strokeWidth={2} />
                      </div>
                      <div>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: '#1d1d1f' }}>ID Document</p>
                        <p style={{ fontSize: '13px', color: '#7a7a7a' }}>Driver's licence or passport</p>
                      </div>
                    </div>
                    {profileData?.verificationStatus === 'VERIFIED'
                      ? verBadge(true, 20)
                      : profileData?.verificationStatus === 'PENDING'
                      ? <span style={{ fontSize: '11px', background: SKY_TINT, color: SKY, border: `1px solid ${SKY_BORDER}`, padding: '2px 10px', borderRadius: '9999px', fontWeight: 600 }}>Under review</span>
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
                  {idMsg && <p style={{ fontSize: '13px', color: idMsg.includes('pending') ? SKY : MUTED, fontWeight: 500 }}>{idMsg}</p>}
                </div>
              </div>
            </BlurFade>

            {/* Account */}
            <BlurFade delay={5}>
              <div style={{
                background: '#ffffff',
                borderRadius: '18px',
                padding: '20px 24px',
                border: `1px solid ${BORDER}`,
              }}>
                <p style={{ fontSize: '14px', fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '14px' }}>
                  Account
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => setConfirmSignOut(true)}
                    style={{
                      flex: 1,
                      background: SKY,
                      color: '#ffffff',
                      border: 'none',
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
                </div>
              </div>
            </BlurFade>

          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmSignOut}
        title="Sign out of ToWin?"
        message="You can sign back in any time with your email and password."
        confirmLabel="Sign Out"
        cancelLabel="Stay Signed In"
        onConfirm={() => { setConfirmSignOut(false); logout(); navigate('/login'); }}
        onCancel={() => setConfirmSignOut(false)}
      />
    </div>
  );
}
