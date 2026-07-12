/**
 * Routing-engine tests — graph construction, multi-objective search and
 * the incident-aware penalty layer. Uses the deterministic synthetic
 * lattice so the tests run fully offline (no Overpass).
 *
 * Run: node --test server/test/routing.test.js
 */
const test = require('node:test');
const assert = require('node:assert');

const routing = require('../services/routing');
const { buildGraph, syntheticGrid } = routing;
const { haversine } = require('../services/routing/geo');
const router = require('../services/routing/router');

// A tiny hand-built graph: A—B—C straight, plus A—D—C detour.
//   A(0,0) B(0,0.001) C(0,0.002) along a line; D offset.
function tinyElements() {
  return [
    { type: 'node', id: 1, lon: 0, lat: 0 },
    { type: 'node', id: 2, lon: 0, lat: 0.001 },
    { type: 'node', id: 3, lon: 0, lat: 0.002 },
    { type: 'node', id: 4, lon: 0.001, lat: 0.001 },
    // Direct A-B-C along an unlit arterial with no sidewalk (poor safety).
    { type: 'way', id: 10, nodes: [1, 2], tags: { highway: 'primary', sidewalk: 'no', lit: 'no' } },
    { type: 'way', id: 11, nodes: [2, 3], tags: { highway: 'primary', sidewalk: 'no', lit: 'no' } },
    // Detour A-D-C along a lit designated footway (excellent safety).
    { type: 'way', id: 12, nodes: [1, 4], tags: { highway: 'footway', foot: 'designated', lit: 'yes' } },
    { type: 'way', id: 13, nodes: [4, 3], tags: { highway: 'footway', foot: 'designated', lit: 'yes' } },
  ];
}

test('buildGraph: nodes/edges are created and undirected', () => {
  const g = buildGraph(tinyElements());
  assert.strictEqual(g.nodes.size, 4);
  // 4 ways → 4 undirected edges → 8 adjacency entries.
  assert.strictEqual(g.edgeCount, 4);
  assert.strictEqual(g.edges.get(1).length, 2); // A connects to B and D
});

test('buildGraph: motorways are excluded from the walkable graph', () => {
  const els = [
    { type: 'node', id: 1, lon: 0, lat: 0 },
    { type: 'node', id: 2, lon: 0, lat: 0.001 },
    { type: 'way', id: 10, nodes: [1, 2], tags: { highway: 'motorway' } },
  ];
  const g = buildGraph(els);
  assert.strictEqual(g.edgeCount, 0);
});

test('shortest ignores quality; safest takes the safer detour', () => {
  const g = buildGraph(tinyElements());
  const shortest = router.computeRoute(g, 1, 3, 'shortest');
  const safest = router.computeRoute(g, 1, 3, 'safest');
  assert.ok(shortest && safest);
  // Direct path is shorter than the detour.
  assert.ok(shortest.distanceMeters <= safest.distanceMeters);
  // The safer route actually scores higher on safety.
  assert.ok(safest.safetyScore > shortest.safetyScore);
});

test('planRoutes: produces the five headline objectives with metrics', async () => {
  const elements = syntheticGrid({ rows: 6, cols: 6, spacing: 120 });
  const dLat = (120 / 111320) * 5;
  const dLng = (120 / (111320 * Math.cos((22.57 * Math.PI) / 180))) * 5;
  const res = await routing.planRoutes([88.36, 22.57], [88.36 + dLng, 22.57 + dLat], { elements });

  const keys = res.routes.map((r) => r.profile);
  for (const k of ['fastest', 'shortest', 'safest', 'comfortable', 'recommended']) {
    assert.ok(keys.includes(k), `route ${k} present`);
  }
  for (const r of res.routes) {
    assert.ok(r.distanceMeters > 0);
    assert.ok(r.geometry.type === 'LineString' && r.geometry.coordinates.length >= 2);
    assert.ok(r.walkabilityScore >= 0 && r.walkabilityScore <= 100);
  }
  assert.strictEqual(res.recommended, 'recommended');
});

test('planRoutes: custom priorities add a custom route and honour wheelchair constraint', async () => {
  // Grid with a steps-only shortcut the wheelchair profile must avoid.
  const elements = [
    { type: 'node', id: 1, lon: 0, lat: 0 },
    { type: 'node', id: 2, lon: 0, lat: 0.001 },
    { type: 'node', id: 3, lon: 0.001, lat: 0.0005 },
    // Direct steps (shortest but not wheelchair-accessible).
    { type: 'way', id: 10, nodes: [1, 2], tags: { highway: 'steps' } },
    // Longer ramp route via node 3.
    { type: 'way', id: 11, nodes: [1, 3], tags: { highway: 'footway', wheelchair: 'yes', surface: 'asphalt' } },
    { type: 'way', id: 12, nodes: [3, 2], tags: { highway: 'footway', wheelchair: 'yes', surface: 'asphalt' } },
  ];
  const res = await routing.planRoutes([0, 0], [0, 0.001], {
    elements,
    priorities: { wheelchair: true, accessibility: 1 },
  });
  const custom = res.routes.find((r) => r.profile === 'custom');
  assert.ok(custom, 'custom route present');
  assert.strictEqual(custom.stepSegments, 0, 'wheelchair route avoids all steps');
});

test('makeIncidentPenalty: penalises near a report, zero far away', () => {
  const penalty = routing.makeIncidentPenalty([
    { location: { coordinates: [0, 0] }, severity: 'major', module: 'hazard_infrastructure' },
  ]);
  assert.ok(penalty(0, 0) > 0);
  // ~1 km away → outside the 45 m influence radius.
  assert.strictEqual(penalty(0.01, 0.01), 0);
});

test('incidents steer the route away from a penalised segment', async () => {
  const g1 = tinyElements();
  // Drop an incident right on the footway detour so it loses its advantage.
  const incidentOnDetour = [
    { location: { coordinates: [0.001, 0.001] }, severity: 'fatal', module: 'personal_safety' },
  ];
  const withIncident = await routing.planRoutes([0, 0], [0, 0.002], {
    elements: g1,
    incidents: incidentOnDetour,
    profiles: ['safest'],
  });
  const clean = await routing.planRoutes([0, 0], [0, 0.002], {
    elements: g1,
    profiles: ['safest'],
  });
  // The incident should reduce the safest route's safety score.
  assert.ok(withIncident.routes[0].safetyScore <= clean.routes[0].safetyScore);
});

test('geo.haversine: known distance sanity (~111 km per degree lat)', () => {
  const d = haversine([0, 0], [0, 1]);
  assert.ok(Math.abs(d - 111195) < 500);
});
