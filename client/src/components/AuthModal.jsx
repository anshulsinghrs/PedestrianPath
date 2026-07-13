import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { ALL_MODES, modeLabels, modeEmoji } from '../utils/incidentTypes.js';

/**
 * Auth modal with three states:
 *   - 'login'        : email + password form
 *   - 'register'     : signup form
 *   - 'check_email'  : "verification email sent" confirmation, shown
 *                      after a successful register OR when login is
 *                      rejected with code: 'email_unverified'
 */
export default function AuthModal({ onClose }) {
  const { login, register, resendVerification } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    mobilityMode: 'pedestrian',
    consentForResearch: false,
  });
  const [pendingEmail, setPendingEmail] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
        onClose();
      } else {
        const res = await register({
          name: form.name,
          email: form.email,
          password: form.password,
          mobilityMode: form.mobilityMode,
          preferredTravelMode: form.mobilityMode,
          consentForResearch: form.consentForResearch,
        });
        setPendingEmail(res.email || form.email);
        setMode('check_email');
      }
    } catch (err) {
      const data = err.response?.data;
      // Server returns code: 'email_unverified' on a login attempt by a
      // user who hasn't verified. Send them to the resend screen instead
      // of just an error message.
      if (data?.code === 'email_unverified') {
        setPendingEmail(data.email || form.email);
        setMode('check_email');
      } else {
        setError(data?.error || 'Something went wrong');
      }
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await resendVerification(pendingEmail);
      setInfo('Verification email re-sent. Please check your inbox.');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not resend email');
    } finally {
      setBusy(false);
    }
  };

  if (mode === 'check_email') {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal small" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Check your email</h2>
            <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
          </div>
          <div style={{ padding: '8px 20px 20px' }}>
            <div style={{ fontSize: 40, textAlign: 'center', margin: '8px 0 12px' }}>
              📧
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.55, margin: '0 0 12px' }}>
              We've sent a verification link to{' '}
              <strong style={{ wordBreak: 'break-all' }}>{pendingEmail}</strong>.
              Click the link in that email to confirm your address and finish
              signing in.
            </p>
            <p className="form-hint" style={{ margin: '0 0 16px' }}>
              The link expires in 24 hours. Don't see it? Check spam, or
              request a new one below.
            </p>
            {error && <div className="form-error">{error}</div>}
            {info && (
              <div
                className="form-error"
                style={{ background: 'rgba(34,197,94,0.12)', color: '#15803d' }}
              >
                {info}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setInfo(null);
                }}
                disabled={busy}
                style={{ flex: 1 }}
              >
                Back to sign in
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={resend}
                disabled={busy}
                style={{ flex: 1 }}
              >
                {busy ? '…' : 'Resend email'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{mode === 'login' ? 'Sign in' : 'Create account'}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={submit} className="report-form">
          {mode === 'register' && (
            <>
              <label>
                <span>Name *</span>
                <input
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  required
                  minLength={2}
                  maxLength={60}
                />
              </label>
              <label>
                <span>Primary travel mode *</span>
                <select
                  value={form.mobilityMode}
                  onChange={(e) => update('mobilityMode', e.target.value)}
                  required
                >
                  {ALL_MODES.map((m) => (
                    <option key={m} value={m}>
                      {modeEmoji[m]} {modeLabels[m]}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label>
            <span>Email *</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              required
            />
          </label>
          <label>
            <span>Password *</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              required
              minLength={6}
            />
          </label>

          {mode === 'register' && (
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.consentForResearch}
                onChange={(e) => update('consentForResearch', e.target.checked)}
              />
              <span>Allow my anonymized data to be used for road safety research</span>
            </label>
          )}

          {error && <div className="form-error">{error}</div>}

          <button type="submit" className="primary-btn full" disabled={busy}>
            {busy ? '…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>

          <p className="auth-switch">
            {mode === 'login' ? "Don't have an account?" : 'Already have one?'}{' '}
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError(null);
              }}
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
          <p className="anon-note">
            You can also report incidents anonymously without an account.
          </p>
        </form>
      </div>
    </div>
  );
}
