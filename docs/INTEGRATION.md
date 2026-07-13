# Integration Guide — merging UrbanPulse + PathGuard into PedestrianPath

This document records how the two source repositories were unified, what came
from where, and the decisions behind the merged architecture.

## Source projects

| Repo | Alias | Stack | Role in the merge |
|------|-------|-------|-------------------|
| `anshulsinghrs/kolkata-walkability` | UrbanPulse | Vanilla JS + Leaflet frontend, Python data script, extensive planning docs | Walkability **scoring model** and GIS/heatmap heritage |
| `anshulsinghrs/urban_mobility` | PathGuard v4 | React + Vite + Leaflet client, Node/Express + MongoDB server, Python analytics service, Docker | The **production application skeleton** |

## Base-choice decision

PathGuard was chosen as the **base** because it is already a working,
well-architected, deployable full-stack application (auth, database, real-time
map, admin, analytics, tests, Docker). UrbanPulse's most valuable and reusable
asset is its **walkability model**, not its vanilla-JS UI. So rather than port
PathGuard's mature React app back onto UrbanPulse's static frontend, we:

1. Kept PathGuard's entire `client/` + `server/` + `analytics/` intact — **no
   existing functionality was removed or regressed** (the 27 pre-existing
   server tests still pass).
2. Ported UrbanPulse's scoring model to `server/services/walkability.js` so it
   runs server-side as the routing cost function, and re-exposed its indicator
   weights + colour ramp via the API.
3. Built the new routing engine — the capability neither project had alone —
   as the connective tissue between "walkability scores" and "reported
   hazards".

## What was added (all net-new, additive)

### Server
- `services/walkability.js` — UrbanPulse model + OSM-tag derivation + the four
  routing dimensions (walkability / safety / comfort / accessibility) and
  sub-indices.
- `services/routing/` — `geo.js`, `osmGraph.js`, `router.js`, `index.js`.
- `controllers/routeController.js`, `controllers/walkabilityController.js`.
- `routes/routes.js`, `routes/walkability.js` — mounted at `/api/routes` and
  `/api/walkability` (plus `/api/v4/*` aliases) in `server.js`.
- `test/walkability.test.js`, `test/routing.test.js` — 19 new tests.

### Client
- `context/RouteContext.jsx` — planner ⇄ map shared state (mirrors
  `IncidentContext`).
- `components/RoutePlanner.jsx`, `components/LocationField.jsx`.
- `components/MapView.jsx` — added route polyline rendering, A/B endpoint
  markers and the walkability heatmap overlay (existing incident/KDE/infra
  layers untouched).
- New **Routes** tab in `Navbar.jsx`; `App.jsx` renders the planner over the
  (persistent) map without unmounting it.
- `services/api.js` — `planRoutes`, `fetchRouteProfiles`, walkability calls.

### Touch-points in existing files (surgical, non-breaking)
- `server/server.js` — two `require`s + four `app.use` mounts.
- `server/routes/config.js` — advertises the new `features` flags and bumps the
  platform version to `5.0.0`.
- `client/src/main.jsx` — wraps the tree in `RouteProvider`.
- `client/src/components/Navbar.jsx` — rebrand + Routes tab.

## Data model reuse

The router reads the **existing** `Incident` collection (GeoJSON `Point`,
`severity`, `module`) for penalty scoring, and the **existing** `Infrastructure`
collection (with its `osmTags`) for the walkability heatmap. No schema changes
were required — the merge rides on PathGuard's existing geospatial indexes
(`2dsphere`).

## Preserving provenance

- The original PathGuard README is preserved verbatim at
  `docs/PATHGUARD_REPORTING.md`.
- UrbanPulse's planning docs (roadmap, GIS pipeline, PostGIS schema, FastAPI
  backend plan) are preserved under `docs/walkability-atlas/` and inform the
  roadmap items (e.g. batch pre-scoring at city scale via PostGIS).

## Why MongoDB, not PostGIS (yet)

The umbrella spec suggests PostgreSQL + PostGIS. PathGuard already ships a
mature MongoDB data layer with working geospatial queries and a full test
suite; rewriting it would have **regressed working functionality** for no
immediate routing benefit, since the router scores segments on demand from
OSM rather than from pre-baked DB tiles. A PostGIS migration for city-scale
pre-scoring is captured as a roadmap item, with UrbanPulse's proposed schema
preserved in `docs/walkability-atlas/DB_SCHEMA.md`.
