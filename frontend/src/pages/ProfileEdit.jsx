import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star as StarIcon } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import NavBar from '../components/NavBar';
import Avatar from '../components/ui/Avatar';
import TrustBadge from '../components/TrustBadge';
import BlurFade from '../components/magic/BlurFade';
import ConfirmDialog from '../components/ConfirmDialog';
import api from '../api/axios';
import SmoothInput from '../components/SmoothInput';
import TagInput from '../components/TagInput';

const MUTED = 'var(--ink-4)';
const BORDER = 'var(--border)';

const STAR_GOLD = 'var(--star-gold)';

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
    <span className="star-lit" style={{ letterSpacing: '-2px', fontSize: '16px' }}>
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  );
}

const Divider = () => (
  <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
);

function FieldRow({ label, children }) {
  return (
    <div style={{ padding: '14px 0' }}>
      <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink-slate)', marginBottom: '6px' }}>
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
  const [localPhotoPreview, setLocalPhotoPreview] = useState(null);

  const [locationQuery, setLocationQuery] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationMsg, setLocationMsg] = useState('');
  const [locationSaved, setLocationSaved] = useState(false);

  useEffect(() => {
    return () => { if (localPhotoPreview) URL.revokeObjectURL(localPhotoPreview); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // Mount-only load; isElder comes from the signed JWT and cannot change
  // without a login round-trip that remounts the page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const f = (key) => ({
    value: form[key],
    onChange: e => setForm(p => ({ ...p, [key]: e.target.value })),
    className: 'field',
  });
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
    setSavingLocation(true); setLocationMsg(''); setLocationSaved(false);
    try {
      const { data } = await api.get(`/geocode/search?q=${encodeURIComponent(q)}`);
      await api.put('/profile/location', { locationLat: data.lat, locationLng: data.lng, city: data.city });
      const resolved = data.city || q;
      setProfileData(p => ({ ...(p || {}), city: resolved }));
      setLocationQuery(resolved);
      setLocationSaved(true);
      setTimeout(() => setLocationSaved(false), 2000);
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

  function handlePhotoSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (localPhotoPreview) URL.revokeObjectURL(localPhotoPreview);
    setLocalPhotoPreview(URL.createObjectURL(file));
    setPhotoFile(file);
    setPhotoMsg('');
  }

  async function uploadPhoto() {
    if (!photoFile) return;
    setUploadingPhoto(true);
    const data = new FormData(); data.append('file', photoFile);
    try {
      const r = await api.put('/profile/photo', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      setProfileData(p => ({ ...p, photoUrl: r.data.photoUrl }));
      // Keep localPhotoPreview showing — it's the same bytes as the S3 file,
      // so the avatar stays instant without waiting for the S3 round-trip.
      setPhotoMsg('Photo updated.'); setPhotoFile(null);
    } catch (err) {
      if (localPhotoPreview) { URL.revokeObjectURL(localPhotoPreview); setLocalPhotoPreview(null); }
      setPhotoMsg(err?.response?.data?.message || 'Upload failed.');
    }
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
    ? (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--green-deep)', whiteSpace: 'nowrap' }}>
        <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        Verified · +{pts} pts
      </span>
    )
    : null;

  const card = {
    background: 'var(--canvas)',
    borderRadius: '18px',
    border: '1px solid var(--border)',
    padding: '28px 28px',
    marginBottom: '0',
  };

  const sectionHeader = (title) => (
    <h2 style={{ fontSize: 'var(--text-lg)', margin: '0 0 16px' }}>
      {title}
    </h2>
  );

  return (
    <div style={{ minHeight: '100svh', background: 'var(--surface-pearl)' }}>
      <NavBar />

      <div className="pe-shell" style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* Identity */}
        <BlurFade delay={1}>
          <section className="pe-card" style={{ ...card, marginBottom: '20px' }}>
            <div className="pe-idhead" style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
              <Avatar name={form.name} photoUrl={localPhotoPreview || profileData?.photoUrl} size={84} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <h1 style={{ fontSize: 'var(--text-xl)', lineHeight: 1.2, margin: 0, overflowWrap: 'anywhere' }}>
                  {form.name || 'Your Name'}
                </h1>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-slate)', margin: '6px 0 0' }}>
                  {[isElder ? 'Elder' : 'Helper', profileData?.username && `@${profileData.username}`].filter(Boolean).join(' · ')}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                  <input type="file" accept="image/*" id="photo-upload" onChange={handlePhotoSelect}
                    style={{ display: 'none' }} />
                  <label htmlFor="photo-upload" className="ghost-btn"
                    style={{ fontSize: 'var(--text-sm)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', minHeight: '44px', boxSizing: 'border-box', whiteSpace: 'nowrap' }}>
                    {photoFile ? photoFile.name.slice(0, 14) + '…' : 'Change photo'}
                  </label>
                  {photoFile && (
                    <button onClick={uploadPhoto} disabled={uploadingPhoto} className="primary-btn"
                      style={{ fontSize: 'var(--text-sm)', minHeight: '44px' }}>
                      {uploadingPhoto ? 'Uploading…' : 'Upload'}
                    </button>
                  )}
                  {photoMsg && <p style={{ fontSize: '14px', color: 'var(--blue-deep)', margin: 0 }}>{photoMsg}</p>}
                </div>
              </div>
              {profileData && (profileData.trustScore != null || profileData.trustTier) && (
                <div className="pe-idtrust" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span aria-hidden className="star-lit">★</span>
                    {profileData.trustScore ?? 0} points
                  </span>
                  <TrustBadge tier={profileData.trustTier} />
                </div>
              )}
            </div>
          </section>
        </BlurFade>

        <div className="profile-edit-grid">

          {/* LEFT: Personal info form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <BlurFade delay={2}>
              <div className="pe-card" style={card}>
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
                          background: 'var(--surface)', border: '1.5px solid var(--border)',
                          fontSize: 'var(--text-sm)', color: 'var(--ink)', lineHeight: 1.6,
                        }}>
                          <span style={{ fontWeight: 600, fontSize: '20px', color: 'var(--ink)' }}>
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
                        border: '1.5px solid var(--border)',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        fontSize: '16px',
                        color: 'var(--ink)',
                        background: 'var(--canvas)',
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
                        onChange={e => { setLocationQuery(e.target.value); setLocationSaved(false); }}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveLocation(); } }}
                        placeholder="Town or postcode…"
                        className="field"
                        wrapperStyle={{ flex: 1 }}
                      />
                      <button type="button" onClick={saveLocation} disabled={savingLocation || locationSaved} className="ghost-btn"
                        style={{ fontSize: '14px', whiteSpace: 'nowrap', color: locationSaved ? 'var(--green-deep)' : undefined, borderColor: locationSaved ? 'var(--green-deep)' : undefined }}>
                        {savingLocation ? 'Saving…' : locationSaved ? 'Saved ✓' : 'Save'}
                      </button>
                    </div>
                    {locationMsg && (
                      <p style={{ fontSize: '13px', color: 'var(--red-mild)', margin: '8px 0 0' }}>
                        {locationMsg}
                      </p>
                    )}
                  </FieldRow>

                  {msg && (
                    <p style={{ fontSize: 'var(--text-sm)', color: msg.includes('saved') ? 'var(--blue)' : 'var(--ink-slate)', fontWeight: 500, marginTop: '8px' }}>
                      {msg}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      marginTop: '20px',
                      width: '100%',
                      background: 'var(--action-fill)',
                      color: 'var(--action-ink)',
                      border: 'none',
                      borderRadius: '9999px',
                      padding: '14px 0',
                      fontSize: '16px',
                      fontWeight: 600,
                      fontFamily: 'inherit',
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
              <div className="pe-card" style={card}>
                {sectionHeader('Verification')}

                {/* Phone */}
                <div style={{ border: '1.5px solid var(--border)', borderRadius: '14px', padding: '18px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink)' }}>Phone number</p>
                      <p style={{ fontSize: '14px', color: 'var(--ink-3)', margin: '2px 0 0' }}>{profileData?.phone || 'No number on file'}</p>
                    </div>
                    {profileData?.phoneVerified
                      ? verBadge(true, 10)
                      : <span style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-4)', fontWeight: 600, whiteSpace: 'nowrap' }}>Not verified</span>
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
                <div style={{ border: '1.5px solid var(--border)', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink)' }}>ID document</p>
                      <p style={{ fontSize: '14px', color: 'var(--ink-3)', margin: '2px 0 0' }}>Driver's licence or passport</p>
                    </div>
                    {profileData?.verificationStatus === 'VERIFIED'
                      ? verBadge(true, 20)
                      : profileData?.verificationStatus === 'PENDING'
                      ? <span style={{ fontSize: 'var(--text-sm)', color: 'var(--blue-deep)', fontWeight: 600, whiteSpace: 'nowrap' }}>Under review</span>
                      : <span style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-4)', fontWeight: 600, whiteSpace: 'nowrap' }}>Not submitted</span>
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
                  {idMsg && <p style={{ fontSize: '14px', color: idMsg.includes('pending') ? 'var(--blue-deep)' : MUTED, fontWeight: 500 }}>{idMsg}</p>}
                </div>
              </div>
            </BlurFade>

            {/* Emergency Contacts — elders only. Managed inline, right inside Profile. */}
            {isElder && (
              <BlurFade delay={4}>
                <div className="pe-card" style={card}>
                  <h2 style={{ fontSize: 'var(--text-lg)', margin: '0 0 6px' }}>
                    Emergency Contacts
                    <span style={{ fontSize: '16px', color: 'var(--ink-4)', marginLeft: '8px' }}>
                      ({emContacts.length}/3)
                    </span>
                  </h2>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)', marginBottom: '16px', lineHeight: 1.5 }}>
                    People we'll alert if you don't check in for several days, or when you press SOS.
                  </p>

                  {emContacts.length === 0 ? (
                    <div style={{ border: '1.5px solid var(--border)', borderRadius: '14px', padding: '20px', textAlign: 'center' }}>
                      <p style={{ fontSize: 'var(--text-sm)', color: MUTED, margin: 0 }}>
                        No emergency contacts yet. Add up to 3 people who care about you.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {emContacts.map(c => (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 14px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>{c.name}</p>
                            <p style={{ fontSize: '14px', color: 'var(--ink-3)', margin: '1px 0 0' }}>
                              {c.relationship ? `${c.relationship} · ` : ''}{c.phone}
                            </p>
                          </div>
                          <button type="button" onClick={() => setEmPendingRemove(c)} className="danger-text" style={{
                            flexShrink: 0, background: 'transparent',
                            border: '1.5px solid var(--border)', borderRadius: '9999px',
                            padding: '6px 14px', fontSize: '14px', fontWeight: 600,
                            minHeight: '44px',
                            fontFamily: 'inherit', cursor: 'pointer',
                          }}>
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {emMsg && (
                    <p className={emMsg.includes('added') ? undefined : 'danger-text'} style={{ fontSize: '14px', fontWeight: 500, marginTop: '12px', color: emMsg.includes('added') ? 'var(--blue-teal)' : undefined }}>
                      {emMsg}
                    </p>
                  )}

                  {/* Add form — appears inline, no page change */}
                  {emContacts.length < 3 && (
                    emShowAdd ? (
                      <form onSubmit={addEmContact} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px', borderTop: '1px solid var(--hairline)', paddingTop: '16px' }}>
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
                          <button type="submit" disabled={emAdding} className="btn-confirm" style={{ flex: 1, fontSize: 'var(--text-sm)' }}>
                            {emAdding ? 'Adding…' : 'Add Contact'}
                          </button>
                          <button type="button" onClick={() => { setEmShowAdd(false); setEmMsg(''); }} className="ghost-btn" style={{ flex: 1, fontSize: 'var(--text-sm)' }}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button type="button" onClick={() => { setEmShowAdd(true); setEmMsg(''); }} className="ghost-btn"
                        style={{ width: '100%', marginTop: '16px', fontSize: 'var(--text-sm)', minHeight: '44px' }}>
                        Add contact
                      </button>
                    )
                  )}
                </div>
              </BlurFade>
            )}

            {/* My Family — link card next to Emergency Contacts (kept separate). */}
            {isElder && (
              <BlurFade delay={4}>
                <div className="pe-card" style={card}>
                  <h2 style={{ fontSize: 'var(--text-lg)', margin: '0 0 6px' }}>My Family</h2>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)', marginBottom: '16px', lineHeight: 1.5 }}>
                    Link your family so they can see you're safe. They only see the friendships
                    you choose to share, and you can remove anyone at any time.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/family')}
                    className="ghost-btn"
                    style={{ width: '100%', fontSize: 'var(--text-sm)', minHeight: '44px' }}
                  >
                    Manage My Family
                  </button>
                </div>
              </BlurFade>
            )}

            {/* Reviews received */}
            <BlurFade delay={4}>
              <div className="pe-card" style={card}>
                <h2 style={{ fontSize: 'var(--text-lg)', margin: '0 0 16px' }}>
                  Reviews Received {reviews.length > 0 && (
                    <span style={{ fontSize: '16px', color: 'var(--ink-4)' }}>({reviews.length})</span>
                  )}
                </h2>
                {reviews.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--surface)', border: '1px solid var(--blue-soft)', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <StarIcon size={20} color={STAR_GOLD} strokeWidth={2} fill={STAR_GOLD} />
                    </div>
                    <p style={{ fontSize: 'var(--text-sm)', color: MUTED }}>No reviews yet. Complete a service to receive your first review.</p>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {reviews.map(r => (
                    <div key={r.id} style={{ border: '1px solid var(--border)', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink)', minWidth: 0, overflowWrap: 'anywhere' }}>
                          {r.reviewerName}
                          {/* Written by a family member for them. Safety reports stay
                              anonymous — the server sends no name for those, so there
                              is simply nothing here to show. */}
                          {r.actedByName && (
                            <span style={{ fontWeight: 600, color: 'var(--gold-deep)' }}> · written by {r.actedByName}</span>
                          )}
                        </p>
                        <Stars rating={r.rating} />
                      </div>
                      {r.tags?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {r.tags.map(t => (
                            <span key={t} style={{ fontSize: 'var(--text-xs)', fontWeight: 600, background: 'var(--surface-2)', color: 'var(--ink-slate)', padding: '4px 11px', borderRadius: '9999px' }}>{t}</span>
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
              <div className="pe-card" style={{
                background: 'var(--canvas)',
                borderRadius: '18px',
                padding: '20px 24px',
                border: `1px solid ${BORDER}`,
              }}>
                <h2 style={{ fontSize: 'var(--text-lg)', margin: '0 0 14px' }}>
                  Account
                </h2>

                {/* Username */}
                {profileData?.username && (
                  <div style={{ marginBottom: '10px', padding: '10px 14px', background: 'var(--surface)', borderRadius: '10px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: MUTED, margin: '0 0 2px' }}>Username</p>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink)', margin: 0 }}>@{profileData.username}</p>
                  </div>
                )}

                {/* Linked Google account */}
                {profileData?.authProvider === 'GOOGLE' && profileData?.email && (
                  <div style={{ marginBottom: '10px', padding: '10px 14px', background: 'var(--info-wash)', border: '1px solid var(--info-line)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--blue-deep)', margin: '0 0 1px' }}>Linked Google account</p>
                      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink)', margin: 0 }}>{profileData.email}</p>
                    </div>
                  </div>
                )}

                {/* Change Password when a password exists; Set a Password for
                    Google-only accounts so they can also sign in with a password */}
                {profileData && profileData.hasPassword !== undefined && (
                  <button
                    type="button"
                    onClick={() => navigate('/profile/change-password')}
                    className="ghost-btn"
                    style={{ width: '100%', fontSize: 'var(--text-sm)', minHeight: '44px', marginBottom: '10px' }}
                  >
                    {profileData.hasPassword ? 'Change Password' : 'Set a Password'}
                  </button>
                )}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setConfirmSignOut(true)}
                    className="ghost-btn"
                    style={{ flex: 1, fontSize: 'var(--text-sm)' }}
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
