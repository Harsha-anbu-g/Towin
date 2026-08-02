import { useNavigate } from 'react-router-dom';
import { privacySections } from '../lib/legalCopy';
import { legalContactEmail } from '../lib/legalContact';
import LegalDraftNotice from '../components/LegalDraftNotice';
import LegalSections from '../components/LegalSections';

export default function Privacy() {
  const navigate = useNavigate();
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px', fontFamily: 'inherit', color: 'var(--ink-deep)', lineHeight: 1.7 }}>
      <button
        onClick={() => navigate(-1)}
        style={{ background: 'none', border: 'none', color: 'var(--blue-deep)', cursor: 'pointer', fontSize: 'var(--text-sm)', marginBottom: 32, padding: 0 }}
      >
        ← Back
      </button>
      <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>

      <LegalDraftNotice />

      <LegalSections sections={privacySections(legalContactEmail())} />
    </div>
  );
}
