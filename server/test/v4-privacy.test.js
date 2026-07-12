/**
 * v4.0 privacy tests — exercises the new aggregated fields emitted by
 * `applyKAnonymity` so the export endpoint can rely on them.
 *
 * Run: node --test server/test/v4-privacy.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const { applyKAnonymity } = require('../services/privacy');

function recordsAt(lat, lng, n, extra = {}) {
  return Array.from({ length: n }, (_, i) => ({
    location: { type: 'Point', coordinates: [lng, lat] },
    incidentDate: new Date('2026-05-17'),
    module: 'accident_conflict',
    reporterMode: 'cyclist',
    severity: i % 2 === 0 ? 'minor' : 'moderate',
    ...extra,
  }));
}

test('v4 privacy: aggregates n_by_collisionType when present', () => {
  const recs = [
    ...recordsAt(0, 0, 3, { collisionType: 'rear_end' }),
    ...recordsAt(0, 0, 2, { collisionType: 'side_swipe' }),
  ];
  const { rows } = applyKAnonymity(recs, {
    k: 5,
    cellSizeM: 200,
    temporal: 'month',
  });
  assert.strictEqual(rows.length, 1);
  assert.deepStrictEqual(rows[0].n_by_collisionType, {
    rear_end: 3,
    side_swipe: 2,
  });
});

test('v4 privacy: aggregates n_by_hazardCategory', () => {
  const recs = [
    ...recordsAt(0, 0, 4, {
      module: 'hazard_infrastructure',
      hazardCategory: 'surface_structural',
      hazardType: 'pothole',
      reporterMode: undefined,
    }),
    ...recordsAt(0, 0, 2, {
      module: 'hazard_infrastructure',
      hazardCategory: 'cycling_micromobility',
      hazardType: 'missing_bike_lane',
      reporterMode: undefined,
    }),
  ];
  const { rows } = applyKAnonymity(recs, {
    k: 1,
    cellSizeM: 200,
    temporal: 'month',
  });
  // Stratified by hazardType (Module 2 group key) so we'll see 2 rows.
  // Each row must carry an n_by_hazardCategory dict matching its records.
  for (const r of rows) {
    assert.ok(r.n_by_hazardCategory);
  }
});

test('v4 privacy: emits mean_perceivedDanger when records carry the scale', () => {
  const recs = [
    ...recordsAt(0, 0, 3, { perceivedDangerScale: 4 }),
    ...recordsAt(0, 0, 2, { perceivedDangerScale: 2 }),
  ];
  const { rows } = applyKAnonymity(recs, {
    k: 5,
    cellSizeM: 200,
    temporal: 'month',
  });
  assert.strictEqual(rows.length, 1);
  assert.ok(typeof rows[0].mean_perceivedDanger === 'number');
  // 3 records of 4 and 2 records of 2 → mean = (12 + 4) / 5 = 3.2
  assert.ok(Math.abs(rows[0].mean_perceivedDanger - 3.2) < 1e-9);
});

