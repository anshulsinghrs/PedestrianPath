# Walkability Engine & Routing Engine

The two new subsystems that turn PedestrianPath from a reporting tool into a
navigation platform. Both live in `server/services/` and are pure,
dependency-free and unit-tested.

---

## 1. Walkability Engine — `services/walkability.js`

A server-side port of the UrbanPulse (`kolkata-walkability`) scoring model.

### Indicators & weights

Five indicators, each on a 0–100 scale, combined by an L1-normalised weighted
sum — identical to the original browser model:

| Indicator | Default weight |
|-----------|---------------:|
| `sidewalk` | 35 |
| `greenery` | 20 |
| `lighting` | 15 |
| `crowdedness` | 10 |
| `crossing_safety` | 20 |

```js
const { walkabilityScore } = require('./services/walkability');
walkabilityScore({ sidewalk: 90, greenery: 60, lighting: 80,
                   crowdedness: 50, crossing_safety: 70 });  // → 0..100
```

Indicators actually present are re-normalised over their own subset, so a
missing indicator never silently drags the score to zero (same behaviour as
UrbanPulse's `Weights.recompute`).

### Deriving indicators from OpenStreetMap

`indicatorsFromOsm(tags)` maps a highway way's OSM tags to the five indicators
so the model can score a live network with no pre-baked dataset. It reads
`highway`, `sidewalk`, `foot`, `lit`, `surface`, `tree_lined`, `maxspeed`,
`traffic_calming`, etc. Values are deliberately conservative: unknown tags
yield ~50, not an optimistic score.

### The four routing dimensions

`scoreSegment({ tags | indicators, weights, incidentPenalty })` expands the
single score into the axes the platform ranks routes on, each 0–100:

| Field | Meaning | Driven by |
|-------|---------|-----------|
| `walkabilityIndex` | overall walkability | weighted indicator sum |
| `safetyIndex` | how safe to walk | crossing safety + lighting − incidents |
| `comfortIndex` | how pleasant | sidewalk + greenery + clear path − incidents |
| `accessibilityIndex` | elderly / wheelchair | steps, incline, surface, width, tactile paving |

Plus sub-indices required by the spec: `greenViewIndex`, `sidewalkPresence`,
`lightingScore`, `obstructionScore`, and a `color` / `rating` from the 7-stop
UrbanPulse colour ramp.

`incidentPenalty` (0–100) is subtracted from safety/comfort/accessibility, so
crowdsourced reports lower the score of the segments they sit on.

---

## 2. Routing Engine — `services/routing/`

### Pipeline (`index.js` → `planRoutes`)

1. Compute a bounding box around origin→destination (+ margin).
2. Fetch the walkable OSM network for that bbox from **Overpass**
   (`osmGraph.fetchOsmNetwork`), or accept caller-supplied `elements`.
3. Build an **incident penalty field** from reports in the bbox
   (`makeIncidentPenalty`): a report raises penalty within a 45 m radius,
   decaying linearly; personal-safety and hazard reports weigh heavier.
4. Build a **scored graph** (`osmGraph.buildGraph`): every OSM way is split
   into node-to-node edges, each carrying its length and full `scoreSegment`
   output (penalty sampled at the edge midpoint). Motorways are excluded.
5. Snap origin + destination to the nearest graph nodes.
6. Run the router once per objective; de-duplicate identical geometries.

### The cost model (`router.js`)

Each objective (**profile**) maps an edge's scores to a scalar cost. For
distance-based objectives, a poor segment's physical length is *inflated*:

```
quality Q ∈ [0,100]                 (higher = better for this objective)
cost = length_m · (1 + α · (100 − Q) / 100)
```

`α` (detour tolerance) bounds how far the router will detour for quality — with
`α = 3` the worst segment costs 4× its length. The `fastest` profile instead
costs edges by walking **time** (`length / edgeSpeed`, where steps and rough
surfaces slow you down).

| Profile | Quality `Q` | `α` | Notes |
|---------|-------------|----:|-------|
| `shortest` | — | 0 | pure distance |
| `fastest` | — | — | pure walking time |
| `safest` | `safetyIndex` | 3.5 | lighting + crossings, avoids incidents |
| `comfortable` | 0.45·comfort + 0.3·walk + 0.25·green | 3 | |
| `recommended` | 0.3·walk + 0.3·safety + 0.25·comfort + 0.15·access | 2.2 | the AI pick |
| `custom` | weighted blend of the active sliders | 2.5·(1−0.6·speed) | + hard constraints |

**Hard constraints** (custom profile): `avoidStairs` / `wheelchair` forbid
`highway=steps`; `wheelchair` also forbids any edge with `accessibilityIndex <
25`. Forbidden edges get `cost = Infinity` and are skipped by Dijkstra.

The search is a binary-heap **Dijkstra** (`MinHeap`), near-linear for the
bbox-scoped graphs the platform builds. Route metrics (distance, time, and each
0–100 score) are **length-weighted averages** over the traversed edges.

### Output

```jsonc
{
  "routes": [
    {
      "profile": "recommended",
      "label": "AI Recommended Route",
      "distanceMeters": 1240,
      "walkingTimeMinutes": 15.3,
      "stepSegments": 0,
      "walkabilityScore": 78.8,
      "safetyScore": 79.8,
      "comfortScore": 80.4,
      "accessibilityScore": 74.0,
      "greenViewScore": 72.1,
      "geometry": { "type": "LineString", "coordinates": [[lng,lat], …] },
      "sameAs": "Safest Route"        // present if geometry-identical to another
    }
    // … fastest, shortest, safest, comfortable, (custom)
  ],
  "recommended": "recommended",
  "meta": { "bbox": [...], "graph": { "nodes": 812, "edges": 1934 },
            "incidentsConsidered": 5, "snapDistanceMeters": {...}, "weights": {...} }
}
```

---

## 3. API

### `POST /api/routes/plan`

```jsonc
{
  "origin":      { "lat": 22.5726, "lng": 88.3639 },   // or [lng,lat] or "lat,lng"
  "destination": { "lat": 22.5760, "lng": 88.3680 },
  "weights":     { "sidewalk": 40, "greenery": 30, … },  // optional
  "priorities":  { "safety": 0.8, "greenery": 0.4,        // optional → custom route
                   "sidewalks": 0, "comfort": 0,
                   "accessibility": 0, "speed": 0,
                   "avoidStairs": false, "wheelchair": true },
  "profiles":    ["fastest","safest","recommended"],     // optional subset
  "considerIncidents": true,                              // default true
  "elements":    [ /* Overpass elements */ ]             // optional offline override
}
```

Errors: `400` bad input · `422` no walkable network / same snap point · `502`
Overpass unreachable.

### `GET /api/routes/profiles` — objective catalogue.

### `POST /api/walkability/score`
```jsonc
{ "tags": { "highway": "footway", "lit": "yes" } }   // or { "indicators": {…} }
```
→ full `scoreSegment` output.

### `GET /api/walkability/weights` — indicator weights + colour scale.

### `GET /api/walkability/heatmap?bbox=minLng,minLat,maxLng,maxLat`
GeoJSON `FeatureCollection` of scored infrastructure points for the map layer.

---

## 4. Offline / restricted networks

Route planning needs the OSM network at request time. Three options when
Overpass is blocked:

1. Set `OVERPASS_URL` to a self-hosted or mirror endpoint (comma-separated for
   fallbacks).
2. POST pre-fetched Overpass `elements` in the request body.
3. For demos/tests, `services/routing/osmGraph.js` exposes `syntheticGrid()` —
   a deterministic lattice with a diagonal "greenway" so the quality objectives
   have a genuinely different optimum from the shortest path.

## 5. Tests

`server/test/walkability.test.js` (11) and `server/test/routing.test.js` (8)
cover the scoring model, OSM derivation, graph construction, each objective,
the incident penalty layer and the wheelchair hard-constraint — all offline.
Run with `npm test` in `server/`.
