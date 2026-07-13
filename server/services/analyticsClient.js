/**
 * Thin HTTP client around the Python analytics microservice.
 *
 * The Node API never talks Mongo to the analytics service directly —
 * it forwards points and parameters, the Python service runs the
 * statistics, and the result comes back as JSON.
 *
 * Configure the base URL with ANALYTICS_URL (defaults to the docker-compose
 * service name `analytics`).
 */

const BASE_URL = process.env.ANALYTICS_URL || 'http://analytics:8000';
const DEFAULT_TIMEOUT_MS = Number(process.env.ANALYTICS_TIMEOUT_MS) || 20000;

async function postJson(path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    let parsed;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { raw: text };
    }
    if (!res.ok) {
      const err = new Error(
        `Analytics service error ${res.status}: ${
          parsed?.detail || parsed?.raw || res.statusText
        }`
      );
      err.status = res.status;
      err.upstream = parsed;
      throw err;
    }
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

async function getJson(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${path}`, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Analytics service error ${res.status}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  baseUrl: BASE_URL,
  health: () => getJson('/health'),
  kde: (payload) => postJson('/kde', payload),
  getisOrd: (payload) => postJson('/getis-ord', payload),
  temporalPattern: (payload) => postJson('/temporal-pattern', payload),
  riskScore: (features) => postJson('/risk-score', features),
};
