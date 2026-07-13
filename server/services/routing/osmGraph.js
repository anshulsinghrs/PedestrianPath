/**
 * OSM pedestrian-network graph builder.
 * =====================================
 *
 * Turns raw OpenStreetMap data (Overpass API `elements`) into a routable,
 * walkability-scored graph:
 *
 *   nodes:  Map<osmId, { id, lng, lat }>
 *   edges:  adjacency Map<osmId, Array<Edge>>   (undirected → stored both ways)
 *
 * Each Edge carries the geometry length and the full multi-dimensional
 * walkability scores from `services/walkability.js`, so the router can
 * cost an edge on any objective without re-scoring.
 *
 * The Overpass fetch is injectable (`fetchImpl`) so the module is fully
 * unit-testable offline, and `buildGraph(elements)` accepts a raw element
 * array directly.
 */
'use strict';

const { haversine, bboxAround } = require('./geo');
const walkability = require('../walkability');

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

/**
 * Build the Overpass QL query for the walkable network inside a bbox.
 * Excludes motorways and explicitly foot=no ways.
 */
function overpassQuery(bbox) {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const b = `${minLat},${minLng},${maxLat},${maxLng}`;
  return `[out:json][timeout:25];
(
  way["highway"]["highway"!~"^(motorway|motorway_link|trunk_link|construction|proposed|raceway|bus_guideway)$"]["foot"!~"^(no|private)$"]["access"!~"^(private|no)$"](${b});
);
(._;>;);
out body;`;
}

/**
 * Fetch the walkable network around origin→destination from Overpass.
 * @returns {Promise<Array>} Overpass `elements`
 */
async function fetchOsmNetwork(origin, destination, opts = {}) {
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('No fetch implementation available for Overpass');
  }
  const bbox = opts.bbox || bboxAround(origin, destination, opts.marginMeters ?? 500);
  const query = overpassQuery(bbox);
  const endpoints = opts.endpoints || OVERPASS_ENDPOINTS;

  let lastErr;
  for (const url of endpoints) {
    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
        signal: opts.signal,
      });
      if (!res.ok) {
        lastErr = new Error(`Overpass ${url} responded ${res.status}`);
        continue;
      }
      const json = await res.json();
      if (Array.isArray(json.elements)) return json.elements;
      lastErr = new Error('Overpass response missing elements');
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('All Overpass endpoints failed');
}

/**
 * Build a scored graph from an Overpass `elements` array.
 *
 * @param {Array} elements  Overpass nodes + ways.
 * @param {Object} [opts]
 * @param {Object} [opts.weights]           walkability indicator weights
 * @param {Function} [opts.incidentPenaltyAt]  (lng,lat) → 0..100 penalty
 * @returns {{nodes:Map, edges:Map, wayCount:number, edgeCount:number}}
 */
function buildGraph(elements, opts = {}) {
  const rawNodes = new Map();
  const ways = [];
  for (const el of elements) {
    if (el.type === 'node') {
      rawNodes.set(el.id, { id: el.id, lng: el.lon, lat: el.lat });
    } else if (el.type === 'way' && Array.isArray(el.nodes)) {
      ways.push(el);
    }
  }

  const nodes = new Map();
  const edges = new Map();
  const incidentPenaltyAt = opts.incidentPenaltyAt || (() => 0);

  const ensureNode = (id) => {
    if (nodes.has(id)) return nodes.get(id);
    const n = rawNodes.get(id);
    if (!n) return null;
    nodes.set(id, n);
    edges.set(id, []);
    return n;
  };

  let edgeCount = 0;
  for (const way of ways) {
    const tags = way.tags || {};
    if (walkability.NON_WALKABLE_HIGHWAYS.has(tags.highway)) continue;

    for (let i = 0; i < way.nodes.length - 1; i++) {
      const aId = way.nodes[i];
      const bId = way.nodes[i + 1];
      const a = ensureNode(aId);
      const b = ensureNode(bId);
      if (!a || !b) continue;

      const length = haversine([a.lng, a.lat], [b.lng, b.lat]);
      if (length <= 0) continue;

      // Score at the segment midpoint (incident penalty sampled there).
      const midLng = (a.lng + b.lng) / 2;
      const midLat = (a.lat + b.lat) / 2;
      const incidentPenalty = incidentPenaltyAt(midLng, midLat);
      const scores = walkability.scoreSegment({
        tags,
        weights: opts.weights,
        incidentPenalty,
      });

      const edge = {
        from: aId,
        to: bId,
        wayId: way.id,
        length,
        tags,
        scores,
        isSteps: tags.highway === 'steps',
      };
      edges.get(aId).push({ ...edge, from: aId, to: bId });
      edges.get(bId).push({ ...edge, from: bId, to: aId });
      edgeCount++;
    }
  }

  return { nodes, edges, wayCount: ways.length, edgeCount };
}

/**
 * Nearest graph node to a [lng,lat] point (linear scan — graphs here are
 * bbox-scoped and small enough that a spatial index isn't worth it).
 */
function nearestNode(graph, point) {
  let best = null;
  let bestDist = Infinity;
  for (const node of graph.nodes.values()) {
    const d = haversine(point, [node.lng, node.lat]);
    if (d < bestDist) {
      bestDist = d;
      best = node;
    }
  }
  return best ? { node: best, distance: bestDist } : null;
}

/**
 * A synthetic lattice graph for offline demos and tests. Produces an
 * `rows × cols` grid of nodes spaced `spacing` metres apart, with each
 * interior edge tagged so scoring produces meaningful variation. A
 * diagonal "greenway" of footway tags gives the comfort/walkability
 * objective a genuinely different optimum from the shortest path.
 */
function syntheticGrid({ rows = 6, cols = 6, spacing = 120, originLng = 88.36, originLat = 22.57 } = {}) {
  const elements = [];
  const idAt = (r, c) => 1000 + r * cols + c;
  const dLat = spacing / 111320;
  const dLng = spacing / (111320 * Math.cos((originLat * Math.PI) / 180));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      elements.push({
        type: 'node',
        id: idAt(r, c),
        lat: originLat + r * dLat,
        lon: originLng + c * dLng,
      });
    }
  }

  let wayId = 5000;
  const addWay = (a, b, tags) =>
    elements.push({ type: 'way', id: wayId++, nodes: [a, b], tags });

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const onGreenway = r === c; // diagonal footway corridor
      const tags = onGreenway
        ? { highway: 'footway', foot: 'designated', lit: 'yes', tree_lined: 'yes', surface: 'paving_stones' }
        : { highway: 'residential', sidewalk: c % 2 === 0 ? 'both' : 'no' };
      if (c < cols - 1) addWay(idAt(r, c), idAt(r, c + 1), tags);
      if (r < rows - 1) addWay(idAt(r, c), idAt(r + 1, c), tags);
    }
  }
  return elements;
}

module.exports = {
  fetchOsmNetwork,
  overpassQuery,
  buildGraph,
  nearestNode,
  syntheticGrid,
  OVERPASS_ENDPOINTS,
};
