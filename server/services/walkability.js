/**
 * Walkability Engine
 * ==================
 *
 * A server-side port of the walkability-scoring model from the
 * `kolkata-walkability` (UrbanPulse) project, generalised for use as the
 * routing cost function of the unified Pedestrian Mobility Platform.
 *
 * The original browser module (`frontend/js/weights.js` + `config.js` +
 * `color-scale.js`) computed a single 0–100 walkability score from five
 * tunable indicators. Here we:
 *
 *   1. Preserve that exact model (`walkabilityScore`, indicator weights,
 *      colour scale) so scores are identical to the legacy atlas.
 *   2. Add `indicatorsFromOsm()` — derive the five indicators from
 *      OpenStreetMap way tags so the model can score a real pedestrian
 *      network with no pre-baked dataset.
 *   3. Add `scoreSegment()` — expand the single score into the four
 *      routing dimensions the platform ranks routes on: walkability,
 *      safety, comfort and accessibility, plus the sub-indices the spec
 *      calls for (green-view, sidewalk presence, lighting, obstruction).
 *
 * Everything is pure and dependency-free so it can be unit-tested and
 * reused by the routing engine, the REST controllers and (eventually) a
 * batch scoring worker without touching the database.
 */

'use strict';

// ---------------------------------------------------------------------------
// 1. Core model — ported verbatim (in spirit) from the UrbanPulse config.
// ---------------------------------------------------------------------------

/** The five tunable indicators, each expressed on a 0–100 scale. */
const INDICATOR_KEYS = [
  'sidewalk',
  'greenery',
  'lighting',
  'crowdedness',
  'crossing_safety',
];

/** Default indicator weights (UrbanPulse `DEFAULT_WEIGHTS`). */
const DEFAULT_WEIGHTS = Object.freeze({
  sidewalk: 35,
  greenery: 20,
  lighting: 15,
  crowdedness: 10,
  crossing_safety: 20,
});

/** 7-stop colour ramp (UrbanPulse `SCORE_STOPS`), score → RGB. */
const SCORE_STOPS = [
  { t: 0, color: [185, 28, 28], label: 'Very Poor' },
  { t: 5, color: [234, 88, 12], label: 'Poor' },
  { t: 15, color: [217, 119, 6], label: 'Fair' },
  { t: 30, color: [202, 138, 4], label: 'Moderate' },
  { t: 50, color: [101, 163, 13], label: 'Good' },
  { t: 75, color: [22, 163, 74], label: 'Very Good' },
  { t: 100, color: [4, 120, 87], label: 'Excellent' },
];

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/** L1-normalise a partial weight object over INDICATOR_KEYS (sum → 1). */
function normalizeWeights(weights = DEFAULT_WEIGHTS) {
  const raw = {};
  let sum = 0;
  for (const k of INDICATOR_KEYS) {
    const v = Math.max(0, Number(weights[k]) || 0);
    raw[k] = v;
    sum += v;
  }
  if (sum === 0) {
    const even = 1 / INDICATOR_KEYS.length;
    return INDICATOR_KEYS.reduce((o, k) => ((o[k] = even), o), {});
  }
  return INDICATOR_KEYS.reduce((o, k) => ((o[k] = raw[k] / sum), o), {});
}

/**
 * Weighted-sum walkability score. Mirrors UrbanPulse `Weights.recompute`:
 * only indicators actually present contribute, and weights are
 * renormalised over the present subset so a missing indicator never
 * silently drags the score to zero.
 *
 * @param {Object} indicators - subset of INDICATOR_KEYS → 0..100
 * @param {Object} [weights]  - raw (un-normalised) weights
 * @returns {number} score in [0, 100]
 */
function walkabilityScore(indicators, weights = DEFAULT_WEIGHTS) {
  const w = normalizeWeights(weights);
  let total = 0;
  let weightSum = 0;
  for (const k of INDICATOR_KEYS) {
    const v = indicators[k];
    if (v == null || Number.isNaN(Number(v))) continue;
    total += clamp(Number(v), 0, 100) * w[k];
    weightSum += w[k];
  }
  return weightSum > 0 ? total / weightSum : 0;
}

/** Interpolate the colour ramp for a 0–100 score → [r,g,b]. */
function colorForScore(score) {
  const s = clamp(Number(score) || 0, 0, 100);
  if (s <= SCORE_STOPS[0].t) return SCORE_STOPS[0].color.slice();
  const last = SCORE_STOPS[SCORE_STOPS.length - 1];
  if (s >= last.t) return last.color.slice();
  for (let i = 0; i < SCORE_STOPS.length - 1; i++) {
    const a = SCORE_STOPS[i];
    const b = SCORE_STOPS[i + 1];
    if (s >= a.t && s <= b.t) {
      const t = (s - a.t) / (b.t - a.t);
      return [
        Math.round(a.color[0] + (b.color[0] - a.color[0]) * t),
        Math.round(a.color[1] + (b.color[1] - a.color[1]) * t),
        Math.round(a.color[2] + (b.color[2] - a.color[2]) * t),
      ];
    }
  }
  return [128, 128, 128];
}

function hexForScore(score) {
  const [r, g, b] = colorForScore(score);
  const h = (n) => n.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Human label for a score (UrbanPulse `ColorScale.ratingFor`). */
function ratingForScore(score) {
  const s = clamp(Number(score) || 0, 0, 100);
  let label = SCORE_STOPS[0].label;
  for (const stop of SCORE_STOPS) if (s >= stop.t) label = stop.label;
  return label;
}

// ---------------------------------------------------------------------------
// 2. OSM tag → indicator derivation.
//
// Maps a highway way's OpenStreetMap tags to the five 0–100 indicators so
// the model can score a live pedestrian network. Values are deliberately
// conservative: an unknown tag yields a neutral ~50 rather than an
// optimistic score, so the routing engine never over-trusts sparse data.
// ---------------------------------------------------------------------------

const PEDESTRIAN_HIGHWAYS = new Set([
  'footway',
  'pedestrian',
  'path',
  'steps',
  'living_street',
  'residential',
  'service',
  'unclassified',
  'track',
  'cycleway',
  'primary',
  'secondary',
  'tertiary',
  'trunk',
  'road',
]);

/** Highways a pedestrian should generally not be routed onto at all. */
const NON_WALKABLE_HIGHWAYS = new Set(['motorway', 'motorway_link', 'trunk_link']);

/** Base sidewalk indicator by highway class when no `sidewalk` tag exists. */
const HIGHWAY_SIDEWALK_BASE = {
  footway: 95,
  pedestrian: 95,
  path: 78,
  living_street: 70,
  residential: 48,
  service: 42,
  unclassified: 45,
  track: 55,
  steps: 45,
  cycleway: 50,
  tertiary: 40,
  secondary: 30,
  primary: 25,
  trunk: 18,
  road: 45,
};

/** Base crossing-safety indicator by highway class (calmer = safer). */
const HIGHWAY_CROSSING_BASE = {
  footway: 92,
  pedestrian: 95,
  path: 85,
  living_street: 80,
  residential: 68,
  service: 62,
  unclassified: 60,
  track: 70,
  steps: 80,
  cycleway: 62,
  tertiary: 45,
  secondary: 34,
  primary: 26,
  trunk: 18,
  road: 55,
};

function truthy(tag) {
  return tag === 'yes' || tag === 'designated' || tag === 'true' || tag === '1';
}

/**
 * Derive the five walkability indicators from OSM way tags.
 * @param {Object} tags - raw OSM key→value tags for a highway way
 * @returns {{sidewalk:number, greenery:number, lighting:number,
 *            crowdedness:number, crossing_safety:number}}
 */
function indicatorsFromOsm(tags = {}) {
  const hw = tags.highway || 'road';

  // --- sidewalk ---
  let sidewalk = HIGHWAY_SIDEWALK_BASE[hw] ?? 50;
  const sw = tags.sidewalk || tags['sidewalk:both'];
  if (sw === 'both' || sw === 'yes') sidewalk = 90;
  else if (sw === 'left' || sw === 'right') sidewalk = 72;
  else if (sw === 'separate') sidewalk = 85;
  else if (sw === 'no' || sw === 'none') sidewalk = 20;
  if (truthy(tags.foot) && sidewalk < 80 && hw !== 'steps') sidewalk = Math.max(sidewalk, 78);
  if (tags.foot === 'no') sidewalk = Math.min(sidewalk, 15);

  // --- greenery (green-view proxy) ---
  let greenery = 45;
  if (hw === 'path' || hw === 'track' || hw === 'footway') greenery = 58;
  if (truthy(tags.tree_lined) || tags.natural === 'tree_row') greenery = 88;
  if (tags.leisure === 'park' || tags.landuse === 'grass' || tags.landuse === 'forest')
    greenery = 90;
  if (tags.surface === 'grass' || tags.surface === 'ground') greenery = Math.max(greenery, 65);

  // --- lighting ---
  let lighting = 50;
  if (truthy(tags.lit)) lighting = 90;
  else if (tags.lit === 'no') lighting = 15;
  else if (hw === 'primary' || hw === 'secondary' || hw === 'residential') lighting = 58;

  // --- crowdedness (activity / passive-surveillance proxy) ---
  // Moderate footfall is best; isolated tracks and busy arterials both score
  // lower on the "comfortable liveliness" axis the original model captured.
  let crowdedness = 50;
  if (hw === 'pedestrian' || hw === 'living_street') crowdedness = 70;
  if (hw === 'residential' || hw === 'footway') crowdedness = 60;
  if (hw === 'track' || hw === 'path') crowdedness = 35;
  if (hw === 'trunk' || hw === 'primary') crowdedness = 40;

  // --- crossing_safety ---
  let crossing_safety = HIGHWAY_CROSSING_BASE[hw] ?? 55;
  if (truthy(tags.traffic_calming) || tags.traffic_calming) crossing_safety += 10;
  if (tags.maxspeed) {
    const spd = parseInt(tags.maxspeed, 10);
    if (Number.isFinite(spd)) {
      if (spd <= 30) crossing_safety += 10;
      else if (spd >= 60) crossing_safety -= 12;
    }
  }

  return {
    sidewalk: clamp(sidewalk, 0, 100),
    greenery: clamp(greenery, 0, 100),
    lighting: clamp(lighting, 0, 100),
    crowdedness: clamp(crowdedness, 0, 100),
    crossing_safety: clamp(crossing_safety, 0, 100),
  };
}

// ---------------------------------------------------------------------------
// 3. Multi-dimensional segment scoring.
//
// Expands the single walkability score into the four axes the platform
// ranks routes on. Each axis is 0–100 (higher = better). Nearby reported
// incidents apply a penalty to the safety and comfort axes so the routing
// engine naturally steers around crowdsourced problem spots.
// ---------------------------------------------------------------------------

const STEEP_INCLINE_RE = /(steep|-?[12][0-9]%|-?[3-9][0-9]%)/;

/**
 * Accessibility index for elderly / wheelchair users.
 * Penalises steps, steep inclines, rough surfaces and narrow paths;
 * rewards tactile paving and explicit wheelchair=yes.
 */
function accessibilityFromOsm(tags = {}) {
  const hw = tags.highway;
  let score = 70;
  if (hw === 'steps') score = tags.ramp === 'yes' ? 35 : 8;
  if (tags.wheelchair === 'yes') score = Math.max(score, 90);
  else if (tags.wheelchair === 'limited') score = Math.min(score, 55);
  else if (tags.wheelchair === 'no') score = Math.min(score, 15);

  if (tags.incline && STEEP_INCLINE_RE.test(String(tags.incline))) score -= 30;

  const smoothSurface = ['paved', 'asphalt', 'concrete', 'paving_stones'];
  const roughSurface = ['gravel', 'unpaved', 'dirt', 'ground', 'sand', 'grass', 'cobblestone'];
  if (tags.surface) {
    if (smoothSurface.includes(tags.surface)) score += 8;
    else if (roughSurface.includes(tags.surface)) score -= 22;
  }
  if (truthy(tags.tactile_paving)) score += 10;
  else if (tags.tactile_paving === 'no') score -= 6;

  const width = parseFloat(tags.width);
  if (Number.isFinite(width)) {
    if (width < 1.2) score -= 18;
    else if (width >= 1.8) score += 6;
  }
  return clamp(score, 0, 100);
}

/**
 * Obstruction score (higher = clearer path). Derived from surface
 * smoothness and explicit obstruction tags; incidents can lower it further.
 */
function obstructionFromOsm(tags = {}) {
  let score = 78;
  if (tags.smoothness) {
    const good = ['excellent', 'good', 'intermediate'];
    score = good.includes(tags.smoothness) ? 85 : 45;
  }
  if (tags.surface && ['gravel', 'unpaved', 'dirt', 'ground', 'sand'].includes(tags.surface))
    score -= 15;
  if (truthy(tags.obstacle) || tags.barrier) score -= 25;
  return clamp(score, 0, 100);
}

/**
 * Score a road/path segment across all routing dimensions.
 *
 * @param {Object} opts
 * @param {Object} [opts.tags]        OSM tags for the way.
 * @param {Object} [opts.indicators]  Pre-computed indicators (overrides tags).
 * @param {Object} [opts.weights]     Walkability indicator weights.
 * @param {number} [opts.incidentPenalty] 0–100 penalty from nearby reports.
 * @returns {Object} scores + sub-indices, each 0–100.
 */
function scoreSegment({ tags = {}, indicators, weights, incidentPenalty = 0 } = {}) {
  const ind = indicators || indicatorsFromOsm(tags);
  const penalty = clamp(Number(incidentPenalty) || 0, 0, 100);

  const walkabilityIndex = walkabilityScore(ind, weights);
  const accessibilityBase = indicators ? 65 : accessibilityFromOsm(tags);
  const obstructionScore = indicators ? 75 : obstructionFromOsm(tags);

  // Safety leans on crossing safety + lighting, dampened by incidents.
  const safetyIndex = clamp(
    0.5 * ind.crossing_safety + 0.35 * ind.lighting + 0.15 * ind.sidewalk - penalty,
    0,
    100
  );

  // Comfort leans on sidewalk quality, greenery and a clear path.
  const comfortIndex = clamp(
    0.4 * ind.sidewalk + 0.3 * ind.greenery + 0.3 * obstructionScore - 0.5 * penalty,
    0,
    100
  );

  const accessibilityIndex = clamp(accessibilityBase - 0.3 * penalty, 0, 100);

  return {
    indicators: ind,
    walkabilityIndex: round1(walkabilityIndex),
    safetyIndex: round1(safetyIndex),
    comfortIndex: round1(comfortIndex),
    accessibilityIndex: round1(accessibilityIndex),
    // Sub-indices requested by the platform spec.
    greenViewIndex: round1(ind.greenery),
    sidewalkPresence: round1(ind.sidewalk),
    lightingScore: round1(ind.lighting),
    obstructionScore: round1(obstructionScore),
    incidentPenalty: round1(penalty),
    rating: ratingForScore(walkabilityIndex),
    color: hexForScore(walkabilityIndex),
  };
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

module.exports = {
  INDICATOR_KEYS,
  DEFAULT_WEIGHTS,
  SCORE_STOPS,
  NON_WALKABLE_HIGHWAYS,
  PEDESTRIAN_HIGHWAYS,
  normalizeWeights,
  walkabilityScore,
  colorForScore,
  hexForScore,
  ratingForScore,
  indicatorsFromOsm,
  accessibilityFromOsm,
  obstructionFromOsm,
  scoreSegment,
  clamp,
};
