/**
 * Multi-objective pedestrian router.
 * ==================================
 *
 * The heart of the platform's "best route, not just the shortest one"
 * promise. Every edge in the scored OSM graph carries a length and a set
 * of 0–100 walkability dimensions. A routing *profile* turns those into a
 * scalar edge cost, and a Dijkstra shortest-path search over that cost
 * yields the optimal route for that objective.
 *
 * Cost model
 * ----------
 * For distance-based objectives an edge's cost inflates its physical
 * length by how *poor* it is on the objective's quality axis:
 *
 *     quality Q ∈ [0,100]              (higher = better for this objective)
 *     cost = length_m · (1 + α · (100 − Q) / 100)
 *
 * α (the "detour tolerance") bounds how far the router will go out of its
 * way for quality: with α = 3 the worst-possible segment costs 4× its
 * length, so a safer/greener detour wins only when it isn't wildly longer.
 * The `fastest` profile instead costs edges by walking *time*, and hard
 * constraints (avoid-stairs, wheelchair) forbid edges outright.
 */
'use strict';

const { clamp } = require('../walkability');

const BASE_WALK_SPEED = 1.35; // m/s, ~4.9 km/h flat pavement

/** Effective pedestrian speed (m/s) for time-based costing. */
function edgeSpeed(edge) {
  let speed = BASE_WALK_SPEED;
  const tags = edge.tags || {};
  if (edge.isSteps) speed = 0.5;
  else if (['gravel', 'unpaved', 'dirt', 'ground', 'sand'].includes(tags.surface))
    speed = 1.1;
  if (tags.incline && /steep|[12][0-9]%|[3-9][0-9]%/.test(String(tags.incline)))
    speed *= 0.8;
  return speed;
}

// ---------------------------------------------------------------------------
// Named profiles. `quality(scores)` → 0..100; `alpha` = detour tolerance;
// `time` = cost by walking time instead of penalised distance;
// `forbid(edge)` = hard constraint.
// ---------------------------------------------------------------------------
const PROFILES = {
  shortest: {
    label: 'Shortest Route',
    alpha: 0,
    quality: (s) => s.walkabilityIndex,
  },
  fastest: {
    label: 'Fastest Route',
    time: true,
    alpha: 0,
    quality: (s) => s.walkabilityIndex,
  },
  safest: {
    label: 'Safest Route',
    alpha: 3.5,
    quality: (s) => s.safetyIndex,
  },
  comfortable: {
    label: 'Most Comfortable Route',
    alpha: 3,
    quality: (s) => 0.45 * s.comfortIndex + 0.3 * s.walkabilityIndex + 0.25 * s.greenViewIndex,
  },
  recommended: {
    label: 'AI Recommended Route',
    alpha: 2.2,
    quality: (s) =>
      0.3 * s.walkabilityIndex +
      0.3 * s.safetyIndex +
      0.25 * s.comfortIndex +
      0.15 * s.accessibilityIndex,
  },
};

/**
 * Build a custom profile from UI priority sliders.
 * @param {Object} p
 * @param {number} [p.safety] [p.greenery] [p.sidewalks] [p.comfort]
 *        [p.accessibility] [p.speed]  each 0..1
 * @param {boolean} [p.avoidStairs] [p.wheelchair]
 */
function customProfile(p = {}) {
  const axes = [
    ['safety', (s) => s.safetyIndex],
    ['greenery', (s) => s.greenViewIndex],
    ['sidewalks', (s) => s.sidewalkPresence],
    ['comfort', (s) => s.comfortIndex],
    ['accessibility', (s) => s.accessibilityIndex],
  ];
  const active = axes
    .map(([key, fn]) => [clamp(Number(p[key]) || 0, 0, 1), fn])
    .filter(([w]) => w > 0);

  const totalW = active.reduce((a, [w]) => a + w, 0);
  const quality =
    totalW > 0
      ? (s) => active.reduce((acc, [w, fn]) => acc + (w / totalW) * fn(s), 0)
      : PROFILES.recommended.quality;

  const speedPref = clamp(Number(p.speed) || 0, 0, 1);
  const wheelchair = !!p.wheelchair;
  const forbid = (edge) => {
    if ((p.avoidStairs || wheelchair) && edge.isSteps) return true;
    if (wheelchair && edge.scores.accessibilityIndex < 25) return true;
    return false;
  };

  return {
    label: 'Your Custom Route',
    // More speed emphasis → less willingness to detour for quality.
    alpha: 2.5 * (1 - 0.6 * speedPref),
    time: speedPref >= 0.85 && totalW === 0,
    quality,
    forbid,
  };
}

// ---------------------------------------------------------------------------
// Binary min-heap keyed on numeric priority — keeps Dijkstra near-linear
// for the bbox-scoped graphs the platform builds.
// ---------------------------------------------------------------------------
class MinHeap {
  constructor() {
    this.items = [];
  }
  get size() {
    return this.items.length;
  }
  push(node, priority) {
    const item = { node, priority };
    this.items.push(item);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent].priority <= item.priority) break;
      this.items[i] = this.items[parent];
      this.items[parent] = item;
      i = parent;
    }
  }
  pop() {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      const n = items.length;
      for (;;) {
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let smallest = i;
        if (l < n && items[l].priority < items[smallest].priority) smallest = l;
        if (r < n && items[r].priority < items[smallest].priority) smallest = r;
        if (smallest === i) break;
        const tmp = items[i];
        items[i] = items[smallest];
        items[smallest] = tmp;
        i = smallest;
      }
    }
    return top;
  }
}

function edgeCost(edge, profile) {
  if (profile.forbid && profile.forbid(edge)) return Infinity;
  if (profile.time) return edge.length / edgeSpeed(edge);
  const Q = clamp(profile.quality(edge.scores), 0, 100);
  return edge.length * (1 + profile.alpha * ((100 - Q) / 100));
}

/**
 * Dijkstra over a scored graph for a single profile.
 * @returns {{edges:Array}|null} the sequence of traversed edges, or null.
 */
function dijkstra(graph, sourceId, targetId, profile) {
  if (sourceId === targetId) return { edges: [] };
  const dist = new Map([[sourceId, 0]]);
  const prevEdge = new Map();
  const visited = new Set();
  const heap = new MinHeap();
  heap.push(sourceId, 0);

  while (heap.size) {
    const { node: u } = heap.pop();
    if (visited.has(u)) continue;
    visited.add(u);
    if (u === targetId) break;

    const neighbours = graph.edges.get(u) || [];
    for (const edge of neighbours) {
      const step = edgeCost(edge, profile);
      if (!Number.isFinite(step)) continue;
      const nd = dist.get(u) + step;
      if (nd < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, nd);
        prevEdge.set(edge.to, edge);
        heap.push(edge.to, nd);
      }
    }
  }

  if (!prevEdge.has(targetId)) return null;
  const edges = [];
  let cur = targetId;
  while (cur !== sourceId) {
    const edge = prevEdge.get(cur);
    if (!edge) return null;
    edges.push(edge);
    cur = edge.from;
  }
  edges.reverse();
  return { edges };
}

/** Length-weighted mean of an edge score field. */
function weightedMean(edges, pick) {
  let total = 0;
  let len = 0;
  for (const e of edges) {
    total += pick(e.scores) * e.length;
    len += e.length;
  }
  return len > 0 ? total / len : 0;
}

/**
 * Aggregate metrics + GeoJSON geometry for a traversed edge sequence.
 */
function summarizeRoute(graph, sourceId, edges) {
  const coords = [];
  const first = graph.nodes.get(sourceId);
  if (first) coords.push([first.lng, first.lat]);
  let distance = 0;
  let time = 0;
  let steps = 0;
  for (const e of edges) {
    const n = graph.nodes.get(e.to);
    if (n) coords.push([n.lng, n.lat]);
    distance += e.length;
    time += e.length / edgeSpeed(e);
    if (e.isSteps) steps++;
  }
  const round = (n) => Math.round(n * 10) / 10;
  return {
    distanceMeters: Math.round(distance),
    walkingTimeMinutes: round(time / 60),
    stepSegments: steps,
    walkabilityScore: round(weightedMean(edges, (s) => s.walkabilityIndex)),
    safetyScore: round(weightedMean(edges, (s) => s.safetyIndex)),
    comfortScore: round(weightedMean(edges, (s) => s.comfortIndex)),
    accessibilityScore: round(weightedMean(edges, (s) => s.accessibilityIndex)),
    greenViewScore: round(weightedMean(edges, (s) => s.greenViewIndex)),
    geometry: { type: 'LineString', coordinates: coords },
  };
}

/**
 * Compute a route for a named or custom profile.
 * @returns {Object|null} route object with metrics + geometry.
 */
function computeRoute(graph, sourceId, targetId, profileKey, profileImpl) {
  const profile = profileImpl || PROFILES[profileKey];
  if (!profile) throw new Error(`Unknown routing profile: ${profileKey}`);
  const result = dijkstra(graph, sourceId, targetId, profile);
  if (!result) return null;
  const summary = summarizeRoute(graph, sourceId, result.edges);
  return {
    profile: profileKey,
    label: profile.label,
    ...summary,
  };
}

module.exports = {
  PROFILES,
  customProfile,
  computeRoute,
  dijkstra,
  summarizeRoute,
  edgeCost,
  edgeSpeed,
  MinHeap,
  BASE_WALK_SPEED,
};
