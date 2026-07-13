/**
 * Canonical schema + normaliser for AI image-analysis predictions.
 *
 * Every provider (heuristic, Anthropic, OpenAI, Gemini, …) returns its own
 * shape; `normalize()` coerces that into one stable object so the rest of
 * the platform — the report pipeline, the API response, the client — never
 * has to care which model produced it.
 */
'use strict';

const DETECTION_KEYS = [
  'sidewalk',
  'obstruction',
  'crossing',
  'pothole',
  'lighting',
  'encroachment',
];

const SEVERITIES = ['minor', 'moderate', 'major', 'fatal'];
const LIGHTING_LEVELS = ['good', 'moderate', 'poor', 'unknown'];

function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function clamp100(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function coerceDetection(raw) {
  if (raw == null) return { present: false, confidence: 0 };
  if (typeof raw === 'boolean') return { present: raw, confidence: raw ? 0.6 : 0.4 };
  return {
    present: !!(raw.present ?? raw.detected ?? false),
    confidence: clamp01(raw.confidence ?? raw.score ?? 0.5),
  };
}

/**
 * Coerce arbitrary provider output into the canonical prediction schema.
 * @param {Object} raw       provider output
 * @param {string} provider  provider key
 * @param {string} model     model id/name
 */
function normalize(raw = {}, provider = 'unknown', model = 'unknown') {
  const detections = {};
  const src = raw.detections || raw;
  for (const key of DETECTION_KEYS) {
    if (key === 'lighting') continue; // lighting is a level, handled below
    detections[key] = coerceDetection(src[key]);
  }

  // Lighting is a qualitative level plus a confidence.
  let lightingLevel = (raw.lighting?.level || raw.lightingLevel || src.lighting?.level || 'unknown')
    .toString()
    .toLowerCase();
  if (!LIGHTING_LEVELS.includes(lightingLevel)) lightingLevel = 'unknown';
  detections.lighting = {
    level: lightingLevel,
    confidence: clamp01(raw.lighting?.confidence ?? src.lighting?.confidence ?? 0.5),
  };

  let severity = (raw.suggestedSeverity || raw.severity || '').toString().toLowerCase();
  if (!SEVERITIES.includes(severity)) severity = severityFromDetections(detections);

  const tags = Array.isArray(raw.tags)
    ? raw.tags.map((t) => String(t)).slice(0, 12)
    : tagsFromDetections(detections);

  return {
    provider,
    model,
    detections,
    walkabilityEstimate: clamp100(raw.walkabilityEstimate ?? raw.walkability),
    description: (raw.description || raw.caption || '').toString().slice(0, 500),
    suggestedSeverity: severity,
    tags,
    analyzedAt: new Date().toISOString(),
  };
}

/** Heuristic severity when the provider didn't supply one. */
function severityFromDetections(detections) {
  let score = 0;
  if (detections.pothole?.present) score += 2;
  if (detections.obstruction?.present) score += 1;
  if (detections.encroachment?.present) score += 1;
  if (detections.lighting?.level === 'poor') score += 1;
  if (detections.sidewalk && !detections.sidewalk.present) score += 1;
  if (score >= 4) return 'major';
  if (score >= 2) return 'moderate';
  return 'minor';
}

function tagsFromDetections(detections) {
  const tags = [];
  if (detections.pothole?.present) tags.push('pothole');
  if (detections.obstruction?.present) tags.push('obstruction');
  if (detections.encroachment?.present) tags.push('encroachment');
  if (detections.crossing?.present) tags.push('crossing');
  if (detections.sidewalk?.present) tags.push('sidewalk');
  if (detections.lighting?.level === 'poor') tags.push('poor_lighting');
  return tags;
}

module.exports = {
  DETECTION_KEYS,
  SEVERITIES,
  LIGHTING_LEVELS,
  normalize,
  severityFromDetections,
  clamp01,
  clamp100,
};
