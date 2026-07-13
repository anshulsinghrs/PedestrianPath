/**
 * Modular AI image-analysis service.
 * ==================================
 *
 * A provider-agnostic vision service: pick a provider via `VISION_PROVIDER`
 * (or per-call) and the business logic never changes. Every provider
 * returns the same normalised prediction schema (`schema.normalize`), so
 * the report pipeline and API layer are decoupled from the model vendor.
 *
 *   VISION_PROVIDER = heuristic (default, no key) | anthropic | openai | gemini
 *
 * If a configured VLM provider isn't actually usable (missing key/SDK), the
 * service falls back to the always-available heuristic provider rather than
 * failing the request — image analysis is best-effort enrichment.
 */
'use strict';

const fs = require('fs');
const schema = require('./schema');

const PROVIDERS = {
  heuristic: require('./providers/heuristic'),
  anthropic: require('./providers/anthropic'),
  openai: require('./providers/openai'),
  gemini: require('./providers/gemini'),
};

function providerKey(requested) {
  return (requested || process.env.VISION_PROVIDER || 'heuristic').toLowerCase();
}

/**
 * Resolve the provider to use. Falls back to heuristic when the requested
 * provider isn't configured.
 * @returns {{ key, impl, fellBack }}
 */
function resolveProvider(requested) {
  const key = providerKey(requested);
  const impl = PROVIDERS[key];
  if (impl && impl.isConfigured()) return { key, impl, fellBack: false };
  return { key: 'heuristic', impl: PROVIDERS.heuristic, fellBack: key !== 'heuristic' };
}

async function loadBuffer(input) {
  if (input.buffer) return input.buffer;
  if (input.path) return fs.promises.readFile(input.path);
  if (input.url) {
    const doFetch = input.fetchImpl || globalThis.fetch;
    if (!doFetch) throw new Error('fetch unavailable for image URL');
    const res = await doFetch(input.url);
    if (!res.ok) throw new Error(`could not fetch image (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  throw new Error('provide one of: buffer, path, url');
}

/**
 * Analyse an image and return normalised predictions.
 * @param {Object} input  { buffer|path|url, mimeType?, provider?, fetchImpl? }
 * @returns {Promise<Object>} normalised prediction (schema.normalize shape)
 */
async function analyzeImage(input = {}) {
  const buffer = await loadBuffer(input);
  const { key, impl, fellBack } = resolveProvider(input.provider);
  const raw = await impl.analyze({
    buffer,
    mimeType: input.mimeType || 'image/jpeg',
    fetchImpl: input.fetchImpl,
  });
  const result = schema.normalize(raw, key, impl.NAME);
  if (fellBack) result.note = `requested provider unavailable; used ${key}`;
  return result;
}

/** Provider availability, for /api/vision/status. */
function status() {
  return {
    active: providerKey(),
    providers: Object.fromEntries(
      Object.entries(PROVIDERS).map(([k, p]) => [
        k,
        { configured: p.isConfigured(), model: p.NAME },
      ])
    ),
    detections: schema.DETECTION_KEYS,
  };
}

module.exports = { analyzeImage, resolveProvider, status, PROVIDERS, schema };
