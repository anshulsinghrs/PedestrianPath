/**
 * Walkability-engine tests — the scoring model ported from
 * kolkata-walkability, plus the OSM-derivation and multi-dimensional
 * scoring the routing engine depends on.
 *
 * Run: node --test server/test/walkability.test.js
 */
const test = require('node:test');
const assert = require('node:assert');

const w = require('../services/walkability');

test('normalizeWeights: L1-normalises to sum 1', () => {
  const n = w.normalizeWeights({ sidewalk: 35, greenery: 20, lighting: 15, crowdedness: 10, crossing_safety: 20 });
  const sum = Object.values(n).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
  assert.ok(n.sidewalk > n.greenery);
});

test('normalizeWeights: all-zero weights fall back to even split', () => {
  const n = w.normalizeWeights({ sidewalk: 0, greenery: 0, lighting: 0, crowdedness: 0, crossing_safety: 0 });
  for (const v of Object.values(n)) assert.ok(Math.abs(v - 0.2) < 1e-9);
});

test('walkabilityScore: perfect indicators → 100, zero → 0', () => {
  const perfect = { sidewalk: 100, greenery: 100, lighting: 100, crowdedness: 100, crossing_safety: 100 };
  const zero = { sidewalk: 0, greenery: 0, lighting: 0, crowdedness: 0, crossing_safety: 0 };
  assert.strictEqual(Math.round(w.walkabilityScore(perfect)), 100);
  assert.strictEqual(Math.round(w.walkabilityScore(zero)), 0);
});

test('walkabilityScore: weighting shifts the result toward heavy indicators', () => {
  // sidewalk carries the largest default weight, so a good sidewalk with
  // everything else poor should beat a poor sidewalk with everything good.
  const goodSidewalk = { sidewalk: 100, greenery: 0, lighting: 0, crowdedness: 0, crossing_safety: 0 };
  const poorSidewalk = { sidewalk: 0, greenery: 100, lighting: 100, crowdedness: 100, crossing_safety: 100 };
  assert.ok(w.walkabilityScore(goodSidewalk) < w.walkabilityScore(poorSidewalk));
  // ...but with a sidewalk-only weighting, the good sidewalk wins outright.
  const onlySidewalk = { sidewalk: 1, greenery: 0, lighting: 0, crowdedness: 0, crossing_safety: 0 };
  assert.strictEqual(Math.round(w.walkabilityScore(goodSidewalk, onlySidewalk)), 100);
});

test('walkabilityScore: missing indicators renormalise over the present subset', () => {
  // Only two indicators present, both 80 → score should be 80, not dragged
  // down by the three absent ones.
  const partial = { sidewalk: 80, lighting: 80 };
  assert.strictEqual(Math.round(w.walkabilityScore(partial)), 80);
});

test('colorForScore / ratingForScore: monotonic ramp', () => {
  assert.strictEqual(w.ratingForScore(0), 'Very Poor');
  assert.strictEqual(w.ratingForScore(100), 'Excellent');
  assert.ok(/^#[0-9a-f]{6}$/.test(w.hexForScore(72)));
});

test('indicatorsFromOsm: a designated footway beats a bare arterial', () => {
  const footway = w.indicatorsFromOsm({ highway: 'footway', foot: 'designated', lit: 'yes', tree_lined: 'yes' });
  const trunk = w.indicatorsFromOsm({ highway: 'trunk' });
  assert.ok(footway.sidewalk > trunk.sidewalk);
  assert.ok(footway.crossing_safety > trunk.crossing_safety);
  assert.strictEqual(footway.lighting, 90);
  assert.ok(footway.greenery >= 88);
});

test('indicatorsFromOsm: explicit sidewalk=no lowers the sidewalk indicator', () => {
  const withSidewalk = w.indicatorsFromOsm({ highway: 'residential', sidewalk: 'both' });
  const without = w.indicatorsFromOsm({ highway: 'residential', sidewalk: 'no' });
  assert.ok(withSidewalk.sidewalk > without.sidewalk);
});

test('accessibilityFromOsm: steps without a ramp are near-impassable', () => {
  assert.ok(w.accessibilityFromOsm({ highway: 'steps' }) < 20);
  assert.ok(w.accessibilityFromOsm({ highway: 'footway', wheelchair: 'yes', surface: 'asphalt' }) > 85);
});

test('scoreSegment: emits all routing dimensions + sub-indices', () => {
  const s = w.scoreSegment({ tags: { highway: 'footway', foot: 'designated', lit: 'yes' } });
  for (const key of ['walkabilityIndex', 'safetyIndex', 'comfortIndex', 'accessibilityIndex', 'greenViewIndex', 'sidewalkPresence', 'lightingScore', 'obstructionScore']) {
    assert.ok(typeof s[key] === 'number', `${key} present`);
    assert.ok(s[key] >= 0 && s[key] <= 100, `${key} in range`);
  }
  assert.ok(/^#[0-9a-f]{6}$/.test(s.color));
});

test('scoreSegment: incident penalty lowers safety and comfort', () => {
  const clean = w.scoreSegment({ tags: { highway: 'residential', sidewalk: 'both', lit: 'yes' } });
  const penalised = w.scoreSegment({ tags: { highway: 'residential', sidewalk: 'both', lit: 'yes' }, incidentPenalty: 60 });
  assert.ok(penalised.safetyIndex < clean.safetyIndex);
  assert.ok(penalised.comfortIndex < clean.comfortIndex);
});
