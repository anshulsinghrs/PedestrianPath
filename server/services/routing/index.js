/**
 * Route-planning orchestrator.
 * ============================
 *
 * `planRoutes(origin, destination, options)` is the single entry point the
 * REST layer calls. It:
 *
 *   1. Obtains the walkable OSM network (Overpass fetch, or caller-supplied
 *      `elements` for tests / cached tiles).
 *   2. Builds an incident-aware penalty function from crowdsourced reports.
 *   3. Scores every segment and builds the routable graph.
 *   4. Snaps origin + destination to the nearest network nodes.
 *   5. Computes one route per requested objective (fastest, shortest,
 *      safest, comfortable, AI-recommended) plus an optional custom route
 *      from the user's priority sliders.
 *   6. Returns ranked, de-duplicated routes with full metrics + GeoJSON.
 */
'use strict';

const { haversine, bboxAround } = require('./geo');
const osmGraph = require('./osmGraph');
const routerCore = require('./router');

const SEVERITY_WEIGHT = { minor: 15, moderate: 30, major: 55, fatal: 80 };
const INCIDENT_RADIUS_M = 45;

/**
 * Build an incident penalty sampler: (lng,lat) → 0..100. Reports within
 * INCIDENT_RADIUS_M raise the penalty, decaying linearly with distance.
 * Personal-safety and hazard reports weigh a little heavier.
 */
function makeIncidentPenalty(incidents = []) {
  const pts = incidents
    .map((inc) => {
      const coords = inc.location?.coordinates || [inc.lng, inc.lat];
      if (!Array.isArray(coords) || coords.length < 2) return null;
      let w = SEVERITY_WEIGHT[inc.severity] || 25;
      if (inc.module === 'personal_safety') w *= 1.3;
      else if (inc.module === 'hazard_infrastructure') w *= 1.15;
      return { lng: Number(coords[0]), lat: Number(coords[1]), w };
    })
    .filter((p) => p && Number.isFinite(p.lng) && Number.isFinite(p.lat));

  if (!pts.length) return () => 0;

  return (lng, lat) => {
    let penalty = 0;
    for (const p of pts) {
      const d = haversine([lng, lat], [p.lng, p.lat]);
      if (d < INCIDENT_RADIUS_M) {
        penalty += p.w * (1 - d / INCIDENT_RADIUS_M);
      }
    }
    return Math.min(100, penalty);
  };
}

function hasActivePriorities(p) {
  if (!p) return false;
  if (p.avoidStairs || p.wheelchair) return true;
  return ['safety', 'greenery', 'sidewalks', 'comfort', 'accessibility', 'speed'].some(
    (k) => Number(p[k]) > 0
  );
}

/**
 * @param {[number,number]} origin      [lng, lat]
 * @param {[number,number]} destination [lng, lat]
 * @param {Object} [options]
 * @param {Object} [options.weights]      walkability indicator weights
 * @param {Object} [options.priorities]   custom-route priority sliders
 * @param {string[]} [options.profiles]   named profiles to compute
 * @param {Array} [options.incidents]     crowdsourced reports for penalties
 * @param {Array} [options.elements]      pre-fetched Overpass elements
 * @param {Function} [options.fetchImpl]  fetch override (tests)
 * @returns {Promise<Object>} { routes, recommended, meta }
 */
async function planRoutes(origin, destination, options = {}) {
  if (!isPoint(origin) || !isPoint(destination)) {
    throw httpError(400, 'origin and destination must be [lng, lat] pairs');
  }

  const bbox = bboxAround(origin, destination, options.marginMeters ?? 500);
  let elements = options.elements;
  if (!elements) {
    elements = await osmGraph.fetchOsmNetwork(origin, destination, {
      bbox,
      fetchImpl: options.fetchImpl,
      signal: options.signal,
      endpoints: options.endpoints,
    });
  }

  const incidentPenaltyAt = makeIncidentPenalty(options.incidents);
  const graph = osmGraph.buildGraph(elements, {
    weights: options.weights,
    incidentPenaltyAt,
  });

  if (!graph.nodes.size) {
    throw new httpError(422, 'No walkable network found near the requested points');
  }

  const src = osmGraph.nearestNode(graph, origin);
  const dst = osmGraph.nearestNode(graph, destination);
  if (!src || !dst) {
    throw new httpError(422, 'Could not snap origin/destination to the network');
  }
  if (src.node.id === dst.node.id) {
    throw new httpError(422, 'Origin and destination snap to the same point — pick points further apart');
  }

  const wanted =
    options.profiles && options.profiles.length
      ? options.profiles
      : ['fastest', 'shortest', 'safest', 'comfortable', 'recommended'];

  const routes = [];
  const seen = new Map(); // geometryKey → first route label

  const pushRoute = (route) => {
    if (!route) return;
    const key = geometryKey(route.geometry);
    if (seen.has(key)) route.sameAs = seen.get(key);
    else seen.set(key, route.label);
    routes.push(route);
  };

  for (const key of wanted) {
    if (!routerCore.PROFILES[key]) continue;
    pushRoute(routerCore.computeRoute(graph, src.node.id, dst.node.id, key));
  }

  if (hasActivePriorities(options.priorities)) {
    const impl = routerCore.customProfile(options.priorities);
    pushRoute(routerCore.computeRoute(graph, src.node.id, dst.node.id, 'custom', impl));
  }

  if (!routes.length) {
    throw new httpError(422, 'No route could be found between the requested points');
  }

  const recommended =
    routes.find((r) => r.profile === 'recommended') ||
    routes.find((r) => r.profile === 'custom') ||
    routes[0];

  return {
    routes,
    recommended: recommended.profile,
    meta: {
      bbox,
      origin,
      destination,
      snapDistanceMeters: {
        origin: Math.round(src.distance),
        destination: Math.round(dst.distance),
      },
      graph: {
        nodes: graph.nodes.size,
        edges: graph.edgeCount,
        ways: graph.wayCount,
      },
      incidentsConsidered: (options.incidents || []).length,
      weights: require('../walkability').normalizeWeights(options.weights),
    },
  };
}

function isPoint(p) {
  return (
    Array.isArray(p) &&
    p.length === 2 &&
    Number.isFinite(Number(p[0])) &&
    Number.isFinite(Number(p[1]))
  );
}

function geometryKey(geom) {
  return (geom.coordinates || [])
    .map((c) => `${c[0].toFixed(5)},${c[1].toFixed(5)}`)
    .join('|');
}

/** Lightweight error carrying an HTTP status for the controller layer. */
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

module.exports = {
  planRoutes,
  makeIncidentPenalty,
  hasActivePriorities,
  // re-exports so callers have one import surface
  buildGraph: osmGraph.buildGraph,
  syntheticGrid: osmGraph.syntheticGrid,
  fetchOsmNetwork: osmGraph.fetchOsmNetwork,
};
