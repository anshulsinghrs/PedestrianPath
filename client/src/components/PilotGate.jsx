import { useEffect, useState } from 'react';
import { useParams, useNavigate, Routes, Route } from 'react-router-dom';

const STORAGE_KEY = 'pathguard-pilot-cohort';

/**
 * Mount this once at the top of <App />. It does two jobs:
 *
 *   1. When the URL matches /pilot/:cohort, persist the cohort tag in
 *      localStorage and redirect to '/' so the rest of the app behaves
 *      normally. From then on the api.js interceptor forwards the tag
 *      via the X-Pilot-Cohort header on every request, which the server
 *      uses to flag new reports as `dataProvenance: 'pilot'`.
 *
 *   2. Render an opt-out banner once the cohort is set, with a link to
 *      the consent template, so participants always see what they're in.
 */
export default function PilotGate() {
  return (
    <Routes>
      <Route path="/pilot/:cohort" element={<CohortSetter />} />
      <Route path="*" element={<CohortBanner />} />
    </Routes>
  );
}

function CohortSetter() {
  const { cohort } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    if (cohort) localStorage.setItem(STORAGE_KEY, cohort);
    navigate('/', { replace: true });
  }, [cohort, navigate]);
  return (
    <div className="pilot-welcome">
      <h2>Welcome to the {cohort} pilot</h2>
      <p>Loading…</p>
    </div>
  );
}

function CohortBanner() {
  const [cohort, setCohort] = useState(
    () => localStorage.getItem(STORAGE_KEY) || ''
  );
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = () =>
      setCohort(localStorage.getItem(STORAGE_KEY) || '');
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  if (!cohort || dismissed) return null;

  const leave = () => {
    localStorage.removeItem(STORAGE_KEY);
    setCohort('');
  };

  return (
    <div className="pilot-banner" role="status">
      <span>
        You are participating in the <strong>{cohort}</strong> pilot. Reports
        you submit are tagged for research.{' '}
      </span>
      <button className="ghost-btn small" type="button" onClick={leave}>
        Leave pilot
      </button>
      <button
        className="ghost-btn small"
        type="button"
        onClick={() => setDismissed(true)}
      >
        Dismiss
      </button>
    </div>
  );
}
