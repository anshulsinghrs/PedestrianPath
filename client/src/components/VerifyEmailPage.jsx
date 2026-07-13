import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Full-screen email verification landing.
 *
 * App.jsx renders this when the URL has ?verify=TOKEN. It POSTs the
 * token to /api/auth/verify-email, which marks the account verified
 * and returns a JWT — AuthContext.verifyEmail stores both. The page
 * then offers a "Continue to PathGuard" button that strips the query
 * param from the URL and reveals the rest of the app.
 */
export default function VerifyEmailPage({ token, onContinue }) {
  const { verifyEmail } = useAuth();
  // 'verifying' | 'ok' | 'error'
  const [state, setState] = useState('verifying');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    verifyEmail(token)
      .then(() => {
        if (!cancelled) setState('ok');
      })
      .catch((err) => {
        if (cancelled) return;
        setState('error');
        setErrorMsg(
          err.response?.data?.error || 'Could not verify this link.'
        );
      });
    return () => {
      cancelled = true;
    };
  }, [token, verifyEmail]);

  return (
    <div className="modal-backdrop" style={{ background: 'var(--color-bg)' }}>
      <div className="modal small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {state === 'verifying' && 'Verifying your email…'}
            {state === 'ok' && 'Email verified'}
            {state === 'error' && 'Verification failed'}
          </h2>
        </div>
        <div style={{ padding: '8px 20px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, margin: '16px 0 12px' }}>
            {state === 'verifying' && '⏳'}
            {state === 'ok' && '✅'}
            {state === 'error' && '⚠️'}
          </div>
          {state === 'verifying' && (
            <p style={{ color: 'var(--color-text-muted)' }}>
              Please wait a moment…
            </p>
          )}
          {state === 'ok' && (
            <>
              <p style={{ fontSize: 14, lineHeight: 1.55 }}>
                Your email is confirmed and you're now signed in. Welcome to
                PathGuard.
              </p>
              <button
                type="button"
                className="primary-btn full"
                onClick={onContinue}
                style={{ marginTop: 16 }}
              >
                Continue to PathGuard
              </button>
            </>
          )}
          {state === 'error' && (
            <>
              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.55,
                  color: 'var(--color-text)',
                }}
              >
                {errorMsg}
              </p>
              <p
                className="form-hint"
                style={{ marginTop: 8 }}
              >
                The link may have expired or already been used. Sign in to
                request a new verification email.
              </p>
              <button
                type="button"
                className="primary-btn full"
                onClick={onContinue}
                style={{ marginTop: 16 }}
              >
                Go to sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
