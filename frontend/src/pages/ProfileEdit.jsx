import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, ShieldCheck, Star as StarIcon, Siren } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import NavBar from '../components/NavBar';
import TrustBadge from '../components/TrustBadge';
import BlurFade from '../components/magic/BlurFade';
import ConfirmDialog from '../components/ConfirmDialog';
import api from '../api/axios';
import SmoothInput from '../components/SmoothInput';
import TagInput from '../components/TagInput';

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
  <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
);

function FieldRow({ label, children }) {
  return (
    <div style={{ padding: '14px 0' }}>
      <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--ink-3)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
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
    interests: [], languages: [], lookingFor: 'BOTH',
    skillsOffered: [],
    hobbies: [], occupation: '', gender: '', facebookUrl: '', instagramUrl: '', dateOfBirth: '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [profileData, setProfileData] = useState(null);
  const [emContacts, setEmContacts] = useState([]);
  const [emShowAdd, setEmShowAdd] = useState(false);
  const [emForm, setEmForm] = useState({ name: '', phone: '', relationship: '', inactivityDays: 5 });
  const [emAdding, setEmAdding] = useState(false);
  const [emMsg, setEmMsg] = useState('');
  const [emPendingRemove, setEmPendingRemove] = useState(null);
  const [emRemoving, setEmRemoving] = useState(false);

  const [editingPhone, setEditingPhone] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [idFile, setIdFile] = useState(null);
  const [uploadingId, setUploadingId] = useState(false);
  const [idMsg, setIdMsg] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoMsg, setPhotoMsg] = useState('');

  const [locationQuery, setLocationQuery] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationMsg, setLocationMsg] = useState('');

  useEffect(() => {
    api.get('/reviews/mine').then(r => setReviews(r.data)).catch(() => {});
    if (isElder) api.get('/emergency/contacts').then(r => setEmContacts(r.data)).catch(() => {});
    api.get('/profile/me').then(r => {
      const p = r.data;
      setProfileData(p);
      if (p.city) setLocationQuery(p.city);
      setForm({
        name: p.name || '',
        age: p.age || '',
        bio: p.bio || '',
        interests: p.interests || [],
        languages: p.languages || [],
        lookingFor: p.lookingFor || 'BOTH',
        skillsOffered: p.skillsOffered || [],
        hobbies: p.hobbies || [],
        occupation: p.occupation || '',
        gender: p.gender || '',
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
    } catch (err) { console.error('Could not update number.', err); }
  }

  // Turn a typed town/postcode into coordinates (backend Nominatim) and save them,
  // so the user appears in "near me" results without needing GPS.
  async function saveLocation() {
    const q = locationQuery.trim();
    if (!q) return;
    setSavingLocation(true); setLocationMsg('');
    try {
      const { data } = await api.get(`/geocode/search?q=${encodeURIComponent(q)}`);
      await api.put('/profile/location', { locationLat: data.lat, locationLng: data.lng });
      setProfileData(p => ({ ...(p || {}), city: data.city }));
      setLocationQuery(data.city || q);
      setLocationMsg(`Location set to ${data.city || q}.`);
    } catch (err) {
      setLocationMsg(err?.response?.status === 404
        ? "We couldn't find that place — try a postcode."
        : 'Could not save location. Please try again.');
    } finally {
      setSavingLocation(false);
    }
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

  const emF = (key) => ({ value: emForm[key], onChange: e => setEmForm(p => ({ ...p, [key]: e.target.value })) });

  async function addEmContact(e) {
    e.preventDefault();
    setEmAdding(true); setEmMsg('');
    try {
      const res = await api.post('/emergency/contacts', { ...emForm, inactivityDays: Number(emForm.inactivityDays) });
      setEmContacts(prev => [...prev, res.data]);
      setEmForm({ name: '', phone: '', relationship: '', inactivityDays: 5 });
      setEmShowAdd(false);
      setEmMsg('Contact added.');
    } catch (err) {
      setEmMsg(err?.response?.data?.message || 'Could not add contact.');
    } finally { setEmAdding(false); }
  }

  async function removeEmContact(id) {
    setEmRemoving(true);
    try {
      await api.delete(`/emergency/contacts/${id}`);
      setEmContacts(prev => prev.filter(c => c.id !== id));
      setEmPendingRemove(null);
    } catch {
      setEmMsg('Could not remove contact. Please try again.');
    } finally { setEmRemoving(false); }
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
          interests: form.interests, languages: form.languages, lookingFor: form.lookingFor,
          facebookUrl: form.facebookUrl || null,
          instagramUrl: form.instagramUrl || null,
          occupation: form.occupation || null,
          gender: form.gender || null,
          dateOfBirth: form.dateOfBirth || null,
        });
      } else {
        await api.put('/profile/helper', {
          name: form.name, age: computedAge, bio: form.bio,
          skillsOffered: form.skillsOffered, languages: form.languages,
          hobbies: form.hobbies,
          occupation: form.occupation,
          gender: form.gender || null,
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
    ? <span style={{ fontSize: '12px', background: 'rgba(34,160,80,0.10)', color: '#1a7a3a', border: '1px solid rgba(34,160,80,0.25)', padding: '2px 10px', borderRadius: '9999px', fontWeight: 600 }}>Verified · +{pts} pts</span>
    : null;

  const card = {
    background: '#ffffff',
    borderRadius: '18px',
    padding: '28px 28px',
    marginBottom: '0',
  };

  const sectionHeader = (title) => (
    <p style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--ink)', fontFamily: SF, letterSpacing: '-0.3px', marginBottom: '20px' }}>
      {title}
    </p>
  );

  return (
    <div style={{ minHeight: '100svh', background: 'var(--surface-pearl)', fontFamily: SFText }}>
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
            boxShadow: '0 4px 16px rgba(90,100,112,0.20)',
            overflow: 'hidden',
            margin: '0 auto 16px',
            background: profileData?.photoUrl ? 'transparent' : `linear-gradient(135deg, #8b939d, #5a6470)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'var(--text-xl)',
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
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              color: 'var(--blue)',
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
                background: 'var(--blue)',
                color: '#fff',
                border: 'none',
                borderRadius: '9999px',
                padding: '6px 16px',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: SFText,
              }}>
                {uploadingPhoto ? 'Uploading…' : 'Upload'}
              </button>
            )}
            {photoMsg && <p style={{ fontSize: '14px', color: 'var(--blue)', marginTop: '6px' }}>{photoMsg}</p>}
          </div>

          <h1 style={{
            fontSize: 'clamp(26px, 7vw, 40px)',
            fontWeight: 600,
            color: 'var(--ink)',
            fontFamily: SF,
            letterSpacing: '-0.8px',
            marginBottom: '8px',
          }}>
            {form.name || 'Your Name'}
          </h1>
          <p style={{ fontSize: '16px', color: 'var(--ink-3)', marginBottom: '4px' }}>
            {isElder ? 'Elder' : 'Helper'}
          </p>
          {profileData?.username && (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-4)', marginBottom: '12px', marginTop: '0' }}>
              @{profileData.username}
            </p>
          )}
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
                    <SmoothInput {...f('name')} placeholder="Your name" required style={{ width: '100%', boxSizing: 'border-box' }} />
                  </FieldRow>
                  <Divider />
                  <FieldRow label="Age">
                    {form.dateOfBirth ? (() => {
                      const age = computeAge(form.dateOfBirth);
                      return age ? (
                        <div style={{
                          padding: '10px 14px', borderRadius: '12px',
                          background: 'var(--surface)', border: '1.5px solid #e0e0e0',
                          fontSize: 'var(--text-sm)', color: 'var(--ink)', lineHeight: 1.6,
                        }}>
                          <span style={{ fontWeight: 600, fontSize: '20px', color: 'var(--green-deep)' }}>
                            {age.years}
                          </span>
                          <span style={{ color: 'var(--ink-3)' }}> years old</span>
                          <br />
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-4)' }}>
                            {age.totalDays.toLocaleString()} days · {age.months} mo {age.days} d
                          </span>
                        </div>
                      ) : null;
                    })() : (
                      <SmoothInput {...f('age')} type="number"
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
                        fontSize: '16px',
                        fontFamily: SFText,
                        color: 'var(--ink)',
                        background: '#ffffff',
                        outline: 'none',
                        resize: 'vertical',
                        boxSizing: 'border-box',
                      }}
                      placeholder="Tell us a bit about yourself..." />
                  </FieldRow>
                  <Divider />
                  <FieldRow label="Languages">
                    <TagInput
                      value={form.languages}
                      onChange={tags => setForm(p => ({ ...p, languages: tags }))}
                      placeholder="Type a language, press Enter…"
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </FieldRow>

                  {isElder && (
                    <>
                      <Divider />
                      <FieldRow label="Interests">
                        <TagInput
                          value={form.interests}
                          onChange={tags => setForm(p => ({ ...p, interests: tags }))}
                          placeholder="Type an interest, press Enter…"
                          style={{ width: '100%', boxSizing: 'border-box' }}
                        />
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
                      <FieldRow label="Hobbies">
                        <TagInput
                          value={form.hobbies}
                          onChange={tags => setForm(p => ({ ...p, hobbies: tags }))}
                          placeholder="Type a hobby, press Enter…"
                          style={{ width: '100%', boxSizing: 'border-box' }}
                        />
                      </FieldRow>
                      <Divider />
                      <FieldRow label="Skills Offered">
                        <TagInput
                          value={form.skillsOffered}
                          onChange={tags => setForm(p => ({ ...p, skillsOffered: tags }))}
                          placeholder="Type a skill, press Enter…"
                          style={{ width: '100%', boxSizing: 'border-box' }}
                        />
                      </FieldRow>
                    </>
                  )}

                  {/* Shared fields — all roles */}
                  <Divider />
                  <FieldRow label="Date of Birth">
                    <SmoothInput {...f('dateOfBirth')} type="date" style={{ width: '100%', boxSizing: 'border-box' }} />
                  </FieldRow>
                  <Divider />
                  <FieldRow label="Occupation">
                    <SmoothInput {...f('occupation')} placeholder="e.g. Retired teacher, Artist" style={{ width: '100%', boxSizing: 'border-box' }} />
                  </FieldRow>
                  <Divider />
                  <FieldRow label="Sex">
                    <select {...f('gender')} className="field" style={{ width: '100%', boxSizing: 'border-box' }}>
                      <option value="">Select…</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </FieldRow>
                  <Divider />
                  <FieldRow label="Facebook URL">
                    <SmoothInput {...f('facebookUrl')} placeholder="https://facebook.com/yourname" style={{ width: '100%', boxSizing: 'border-box' }} />
                  </FieldRow>
                  <Divider />
                  <FieldRow label="Instagram URL">
                    <SmoothInput {...f('instagramUrl')} placeholder="https://instagram.com/yourname" style={{ width: '100%', boxSizing: 'border-box' }} />
                  </FieldRow>
                  <Divider />
                  <FieldRow label="Location">
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <SmoothInput
                        value={locationQuery}
                        onChange={e => setLocationQuery(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveLocation(); } }}
                        placeholder="Town or postcode…"
                        className="field"
                        wrapperStyle={{ flex: 1 }}
                      />
                      <button type="button" onClick={saveLocation} disabled={savingLocation} className="primary-btn" style={{ fontSize: '14px', whiteSpace: 'nowrap' }}>
                        {savingLocation ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                    {locationMsg && (
                      <p style={{ fontSize: '13px', color: locationMsg.startsWith('Location set') ? '#4FA3CE' : '#CF6A66', margin: '8px 0 0' }}>
                        {locationMsg}
                      </p>
                    )}
                  </FieldRow>

                  {msg && (
                    <p style={{ fontSize: 'var(--text-sm)', color: msg.includes('saved') ? '#4FA3CE' : '#5a6470', fontWeight: 500, marginTop: '8px' }}>
                      {msg}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      marginTop: '20px',
                      width: '100%',
                      background: 'var(--blue)',
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
                        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink)' }}>Phone Number</p>
                        <p style={{ fontSize: '14px', color: 'var(--ink-3)' }}>{profileData?.phone || 'No number on file'}</p>
                      </div>
                    </div>
                    {profileData?.phoneVerified
                      ? verBadge(true, 10)
                      : <span style={{ fontSize: '12px', background: 'rgba(160,160,165,0.1)', color: 'var(--ink-4)', border: '1px solid #e0e0e0', padding: '2px 10px', borderRadius: '9999px', fontWeight: 600 }}>Not verified</span>
                    }
                  </div>

                  {!editingPhone ? (
                    <button onClick={() => { setEditingPhone(true); setNewPhone(profileData?.phone || ''); }}
                      className="ghost-btn" style={{ alignSelf: 'flex-start', fontSize: 'var(--text-xs)', padding: '5px 14px' }}>
                      Change number
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <SmoothInput value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="416 555 0123" className="field" wrapperStyle={{ flex: 1 }} />
                      <button onClick={savePhone} className="primary-btn" style={{ fontSize: '14px' }}>Save</button>
                      <button onClick={() => setEditingPhone(false)} className="ghost-btn" style={{ fontSize: '14px' }}>Cancel</button>
                    </div>
                  )}

                </div>

                {/* ID */}
                <div style={{ border: '1.5px solid #e0e0e0', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: SKY_TINT, border: `1px solid ${SKY_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ShieldCheck size={18} color={SKY} strokeWidth={2} />
                      </div>
                      <div>
                        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink)' }}>ID Document</p>
                        <p style={{ fontSize: '14px', color: 'var(--ink-3)' }}>Driver's licence or passport</p>
                      </div>
                    </div>
                    {profileData?.verificationStatus === 'VERIFIED'
                      ? verBadge(true, 20)
                      : profileData?.verificationStatus === 'PENDING'
                      ? <span style={{ fontSize: '12px', background: SKY_TINT, color: SKY, border: `1px solid ${SKY_BORDER}`, padding: '2px 10px', borderRadius: '9999px', fontWeight: 600 }}>Under review</span>
                      : <span style={{ fontSize: '12px', background: 'rgba(160,160,165,0.1)', color: 'var(--ink-4)', border: '1px solid #e0e0e0', padding: '2px 10px', borderRadius: '9999px', fontWeight: 600 }}>Not submitted</span>
                    }
                  </div>
                  {(profileData?.verificationStatus === 'NONE' || !profileData?.verificationStatus) && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <input type="file" accept="image/*,.pdf" onChange={e => setIdFile(e.target.files[0])}
                        style={{ fontSize: '14px', color: 'var(--ink-3)', flex: 1 }} />
                      {idFile && (
                        <button onClick={uploadId} disabled={uploadingId} className="primary-btn" style={{ fontSize: '14px' }}>
                          {uploadingId ? 'Uploading…' : 'Upload'}
                        </button>
                      )}
                    </div>
                  )}
                  {idMsg && <p style={{ fontSize: '14px', color: idMsg.includes('pending') ? SKY : MUTED, fontWeight: 500 }}>{idMsg}</p>}
                </div>
              </div>
            </BlurFade>

            {/* Emergency Contacts — elders only. Managed inline, right inside Profile. */}
            {isElder && (
              <BlurFade delay={4}>
                <div style={card}>
                  <p style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--ink)', fontFamily: SF, letterSpacing: '-0.3px', marginBottom: '6px' }}>
                    Emergency Contacts
                    <span style={{ fontSize: '16px', fontWeight: 400, color: 'var(--ink-4)', marginLeft: '8px' }}>
                      ({emContacts.length}/3)
                    </span>
                  </p>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)', marginBottom: '16px', lineHeight: 1.5 }}>
                    People we'll alert if you don't check in for several days, or when you press SOS.
                  </p>

                  {emContacts.length === 0 ? (
                    <div style={{ border: '1.5px solid #e0e0e0', borderRadius: '14px', padding: '20px', textAlign: 'center' }}>
                      <p style={{ fontSize: 'var(--text-sm)', color: MUTED, margin: 0 }}>
                        No emergency contacts yet. Add up to 3 people who care about you.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {emContacts.map(c => (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '12px 14px' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: SKY_TINT, border: `1px solid ${SKY_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Siren size={18} color={SKY} strokeWidth={2} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>{c.name}</p>
                            <p style={{ fontSize: '14px', color: 'var(--ink-3)', margin: '1px 0 0' }}>
                              {c.relationship ? `${c.relationship} · ` : ''}{c.phone}
                            </p>
                          </div>
                          <button type="button" onClick={() => setEmPendingRemove(c)} style={{
                            flexShrink: 0, background: 'transparent', color: 'var(--red-deep)',
                            border: '1.5px solid #e0e0e0', borderRadius: '9999px',
                            padding: '6px 14px', fontSize: '14px', fontWeight: 600,
                            fontFamily: SFText, cursor: 'pointer',
                          }}>
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {emMsg && (
                    <p style={{ fontSize: '14px', fontWeight: 500, marginTop: '12px', color: emMsg.includes('added') ? '#3D8AB0' : '#9b3535' }}>
                      {emMsg}
                    </p>
                  )}

                  {/* Add form — appears inline, no page change */}
                  {emContacts.length < 3 && (
                    emShowAdd ? (
                      <form onSubmit={addEmContact} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px', borderTop: '1px solid #f0f0f0', paddingTop: '16px' }}>
                        <div className="two-col-grid" style={{ gap: '12px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>Name</label>
                            <SmoothInput {...emF('name')} className="field" placeholder="Contact name" required />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>Phone</label>
                            <SmoothInput {...emF('phone')} className="field" placeholder="+1 555 000 0000" required />
                          </div>
                        </div>
                        <div className="two-col-grid" style={{ gap: '12px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>Relationship</label>
                            <SmoothInput {...emF('relationship')} className="field" placeholder="Daughter, Doctor…" />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>Alert after (days)</label>
                            <SmoothInput {...emF('inactivityDays')} type="number" min={1} max={30} className="field" />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button type="submit" disabled={emAdding} style={{
                            flex: 1, background: SKY, color: '#fff', border: 'none',
                            borderRadius: '9999px', padding: '10px 0', fontSize: 'var(--text-sm)',
                            fontWeight: 600, fontFamily: SFText, cursor: 'pointer',
                          }}>
                            {emAdding ? 'Adding…' : 'Add Contact'}
                          </button>
                          <button type="button" onClick={() => { setEmShowAdd(false); setEmMsg(''); }} style={{
                            flex: 1, background: 'transparent', color: 'var(--ink-3)',
                            border: '1.5px solid #e0e0e0', borderRadius: '9999px', padding: '10px 0',
                            fontSize: 'var(--text-sm)', fontWeight: 600, fontFamily: SFText, cursor: 'pointer',
                          }}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button type="button" onClick={() => { setEmShowAdd(true); setEmMsg(''); }} style={{
                        width: '100%', marginTop: '16px', background: '#ffffff', color: SKY,
                        border: `1.5px solid ${SKY}`, borderRadius: '9999px', padding: '10px 0',
                        fontSize: 'var(--text-sm)', fontWeight: 600, fontFamily: SFText, cursor: 'pointer',
                      }}>
                        + Add Contact
                      </button>
                    )
                  )}
                </div>
              </BlurFade>
            )}

            {/* Reviews received */}
            <BlurFade delay={4}>
              <div style={card}>
                <p style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--ink)', fontFamily: SF, letterSpacing: '-0.3px', marginBottom: '20px' }}>
                  Reviews Received {reviews.length > 0 && (
                    <span style={{ fontSize: '16px', fontWeight: 400, color: 'var(--ink-4)' }}>({reviews.length})</span>
                  )}
                </p>
                {reviews.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: LEAF_TINT, border: `1px solid ${LEAF_BORDER}`, margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <StarIcon size={20} color={STAR_GOLD} strokeWidth={2} fill={STAR_GOLD} />
                    </div>
                    <p style={{ fontSize: 'var(--text-sm)', color: MUTED }}>No reviews yet. Complete a service to receive your first review.</p>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {reviews.map(r => (
                    <div key={r.id} style={{ border: '1px solid #e0e0e0', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink)' }}>{r.reviewerName}</p>
                        <Stars rating={r.rating} />
                      </div>
                      {r.tags?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {r.tags.map(t => (
                            <span key={t} style={{ fontSize: '12px', background: 'rgba(0,102,204,0.08)', color: 'var(--blue)', border: '1px solid rgba(0,102,204,0.15)', padding: '2px 8px', borderRadius: '9999px', fontWeight: 600 }}>{t}</span>
                          ))}
                        </div>
                      )}
                      {r.comment && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)', lineHeight: 1.6 }}>{r.comment}</p>}
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-4)' }}>{new Date(r.createdAt).toLocaleDateString()}</p>
                    </div>
                  ))}
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
                <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '14px' }}>
                  Account
                </p>

                {/* Username */}
                {profileData?.username && (
                  <div style={{ marginBottom: '10px', padding: '10px 14px', background: 'var(--surface)', borderRadius: '10px' }}>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.4px', margin: '0 0 2px' }}>Username</p>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink)', margin: 0 }}>@{profileData.username}</p>
                  </div>
                )}

                {/* Linked Google account */}
                {profileData?.authProvider === 'GOOGLE' && profileData?.email && (
                  <div style={{ marginBottom: '10px', padding: '10px 14px', background: '#f0f7ff', border: '1px solid #bfdbfe', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    <div>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.4px', margin: '0 0 1px' }}>Linked Google Account</p>
                      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink)', margin: 0 }}>{profileData.email}</p>
                    </div>
                  </div>
                )}

                {/* Change Password — only for accounts that sign in with a password */}
                {profileData && profileData.authProvider !== 'GOOGLE' && (
                  <button
                    type="button"
                    onClick={() => navigate('/profile/change-password')}
                    style={{
                      width: '100%',
                      background: '#ffffff',
                      color: SKY,
                      border: `1.5px solid ${SKY}`,
                      borderRadius: '9999px',
                      padding: '10px 0',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 600,
                      fontFamily: SFText,
                      cursor: 'pointer',
                      marginBottom: '10px',
                    }}
                  >
                    Change Password
                  </button>
                )}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setConfirmSignOut(true)}
                    style={{
                      flex: 1,
                      background: SKY,
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '9999px',
                      padding: '10px 0',
                      fontSize: 'var(--text-sm)',
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
        message="You can sign back in any time with your username and password."
        confirmLabel="Sign Out"
        cancelLabel="Stay Signed In"
        onConfirm={() => { setConfirmSignOut(false); logout(); navigate('/login'); }}
        onCancel={() => setConfirmSignOut(false)}
      />

      <ConfirmDialog
        open={!!emPendingRemove}
        danger
        title={`Remove ${emPendingRemove?.name || 'this contact'}?`}
        message="They will no longer be alerted if you trigger an SOS or go inactive. You can add them again later."
        confirmLabel="Remove Contact"
        cancelLabel="Keep"
        loading={emRemoving}
        onConfirm={() => emPendingRemove && removeEmContact(emPendingRemove.id)}
        onCancel={() => setEmPendingRemove(null)}
      />
    </div>
  );
}
