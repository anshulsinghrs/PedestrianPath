import { useEffect, useState } from 'react';

/**
 * Fail-fast banner shown at the top of the app whenever the frontend
 * can't reach a backend.
 *
 * Two distinct failure modes are handled:
 *
 *   1. **Missing `VITE_API_URL`** at build time AND the page is NOT
 *      served from localhost. This is the GitHub-Pages-without-Render
 *      scenario that produces the confusing "405 Method Not Allowed"
 *      from Pages itself.
 *
 *   2. **`VITE_API_URL` is set but the backend isn't responding** —
 *      e.g. Render free-tier service has spun down (60+ s cold start)
 *      or the URL is mistyped. The `/api/health` fetch throws/errors.
 *
 *   3. **Backend is up but its database is down** — `/api/health` (the
 *      liveness endpoint) returns 200 with `db: 'down'` in the body,
 *      typically an Atlas allowlist issue. Shown as an advisory banner
 *      distinct from full unreachability.
 *
 * The banner links the user to docs/DEPLOYMENT.md and disappears the
 * moment `/api/health` reports the database is up.
 */
export default function BackendStatusBanner() {
  const runtimeApiUrl =
    typeof window !== 'undefined' &&
    window.__PATHGUARD_CONFIG__ &&
    window.__PATHGUARD_CONFIG__.apiUrl;
  const apiUrl = runtimeApiUrl || import.meta.env.VITE_API_URL;
  const isLocalhost =
    typeof window !== 'undefined' &&
    /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);

  // State: 'checking' | 'ok' | 'degraded' | 'unreachable' | 'missing-url'
  const [state, setState] = useState(() => {
    if (!apiUrl && !isLocalhost) return 'missing-url';
    return 'checking';
  });

  useEffect(() => {
    if (state === 'missing-url') return; // nothing to probe
    let cancelled = false;

    async function probe() {
      try {
        const base = apiUrl || ''; // empty = same origin (dev proxy)
        // `/api/health` is the liveness endpoint: it returns 200 whenever the
        // server process is up, reporting DB status in the body. That lets us
        // tell "server reachable but DB down" (degraded) apart from "server
        // unreachable", instead of collapsing both into one message.
        const res = await fetch(`${base}/api/health`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json().catch(() => null);
          setState(data && data.db === 'down' ? 'degraded' : 'ok');
        } else {
          setState('unreachable');
        }
      } catch {
        if (cancelled) return;
        setState('unreachable');
      }
    }
    probe();
    // Retry every 30 s while we're in a bad state — useful for Render's
    // free-tier cold starts which can take 30–60 s.
    const id = setInterval(() => {
      if (state !== 'ok') probe();
    }, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [apiUrl, state]);

  if (state === 'ok' || state === 'checking') return null;

  const isMissing = state === 'missing-url';
  const isDegraded = state === 'degraded';
  // Missing-url and degraded are advisory (amber); unreachable is an error (red).
  const isWarning = isMissing || isDegraded;
  return (
    <div
      role="alert"
      style={{
        background: isWarning ? '#fef3c7' : '#fee2e2',
        color: isWarning ? '#92400e' : '#991b1b',
        borderBottom: `1px solid ${isWarning ? '#fbbf24' : '#fca5a5'}`,
        padding: '10px 16px',
        fontSize: 14,
        lineHeight: 1.5,
        textAlign: 'center',
      }}
    >
      <strong>
        {isMissing
          ? 'Backend URL not configured.'
          : isDegraded
            ? 'Backend database is temporarily unavailable.'
            : 'Backend is currently unreachable.'}
      </strong>{' '}
      {isMissing ? (
        <>
          No API URL is configured (neither <code>VITE_API_URL</code> at
          build time nor <code>window.__PATHGUARD_CONFIG__.apiUrl</code>{' '}
          at runtime), so report submissions will fail with HTTP 405 from
          the static host. Edit <code>config.js</code> next to{' '}
          <code>index.html</code> to point at your backend.
        </>
      ) : isDegraded ? (
        <>
          The API at <code>{apiUrl}</code> is up but can't reach its
          database, so reads and report submissions will fail. This is
          usually a MongoDB Atlas allowlist issue or a cold Atlas cluster —
          it typically recovers on its own within a minute.
        </>
      ) : (
        <>
          The API at <code>{apiUrl}</code> isn't responding. If you're on
          a free Render plan the service may be cold-starting (give it
          ~60 s); otherwise check the Render logs and your MongoDB Atlas
          network allowlist.
        </>
      )}{' '}
      <a
        href="https://github.com/anshulsinghrs/urban_mobility/blob/main/docs/DEPLOYMENT.md"
        target="_blank"
        rel="noreferrer"
        style={{ color: 'inherit', textDecoration: 'underline' }}
      >
        See DEPLOYMENT.md
      </a>
      .
    </div>
  );
}
