# 🚶 PedestrianPath — Unified Urban Walkability & Pedestrian Navigation Platform

> **The best walking route, not just the shortest one** — plus crowdsourced
> reporting of the infrastructure problems that make streets un-walkable.

PedestrianPath is an AI-assisted pedestrian mobility platform that unifies two
research projects from IIT Kharagpur into a single application:

| Source project | What it contributed |
|----------------|---------------------|
| [**kolkata-walkability** / *UrbanPulse*](https://github.com/anshulsinghrs/kolkata-walkability) | The walkability-scoring model (indicator weights, 0–100 index, colour ramp) and the GIS/heatmap heritage. |
| [**urban_mobility** / *PathGuard*](https://github.com/anshulsinghrs/urban_mobility) | The production full-stack app: React + Express + MongoDB, three-module incident reporting, auth, admin, analytics, real-time map, Docker deployment. |

The merge keeps **all** of PathGuard's reporting/analytics functionality and
adds the headline capability the two projects were always meant to combine: an
**intelligent multi-objective pedestrian route planner** that scores the live
OpenStreetMap pedestrian network with the walkability engine and steers around
crowdsourced hazards.

---

## ✨ What's new in the unified platform

### 1. Intelligent Pedestrian Route Planner
Enter a start and a destination and get **five ranked routes**, each with
distance, walking time and four 0–100 scores (walkability, safety, comfort,
accessibility):

- **Fastest** — least walking time
- **Shortest** — least distance
- **Safest** — maximises lighting + crossing safety, avoids reported incidents
- **Most Comfortable** — sidewalks, greenery, clear paths
- **AI Recommended** — the overall multi-criteria optimum

Priority **sliders** (safer / greener / better sidewalks / more accessible /
faster) and **toggles** (avoid stairs, wheelchair-friendly) produce an
additional bespoke **Custom** route with hard accessibility constraints.

### 2. Walkability Engine (server-side)
The UrbanPulse scoring model, ported to Node (`server/services/walkability.js`)
and extended to derive its five indicators directly from OpenStreetMap way tags
and to expand the single score into the four routing dimensions plus sub-indices
(green-view, sidewalk presence, lighting, obstruction). It is the shared cost
function for both the router and the map heatmap, so route scores and map
colours always agree.

### 3. Incident-aware routing + walkability heatmap
Crowdsourced reports from the reporting platform become **routing penalties** —
a fatal personal-safety report near a segment makes the router prefer an
alternative. A walkability heatmap layer colours the network by score.

### 4. AI image analysis (modular VLM service)
Report photos are analysed by a **provider-agnostic vision service** — swap
between Claude, GPT-4o, Gemini or a no-key heuristic default with one env var
(`VISION_PROVIDER`), no business-logic change. It detects sidewalk /
obstruction / crossing / pothole / encroachment, estimates lighting and
walkability, writes an auto-caption, and suggests a severity — stored on the
report and shown in its detail view. See [`docs/VISION.md`](docs/VISION.md).

### 5. Everything PathGuard already did
Three-module incident reporting (accident/conflict, hazard/infrastructure,
personal-safety with elevated privacy), JWT auth, admin dashboard, spatial
analytics (KDE / Getis-Ord hotspots), OSM infrastructure import, real-time
Socket.IO map, k-anonymity exports, Docker Compose deployment — all preserved.
See [`docs/PATHGUARD_REPORTING.md`](docs/PATHGUARD_REPORTING.md).

---

## 🏗️ Architecture

```
PedestrianPath/
├── client/                       React 18 + Vite + Leaflet SPA
│   └── src/
│       ├── components/
│       │   ├── RoutePlanner.jsx  ← NEW  route planner panel + result cards
│       │   ├── LocationField.jsx ← NEW  geocoding origin/destination input
│       │   ├── MapView.jsx       ← +routes, +endpoint markers, +heatmap
│       │   └── … (reporting UI, admin, analytics — preserved)
│       ├── context/
│       │   ├── RouteContext.jsx  ← NEW  planner ⇄ map shared state
│       │   └── IncidentContext.jsx
│       └── services/api.js       ← +route/walkability calls
│
├── server/                       Node + Express + MongoDB API
│   ├── services/
│   │   ├── walkability.js        ← NEW  walkability engine (UrbanPulse port)
│   │   └── routing/              ← NEW  routing engine
│   │       ├── geo.js            haversine / bbox helpers
│   │       ├── osmGraph.js       Overpass fetch → scored graph (+ synthetic)
│   │       ├── router.js         multi-objective Dijkstra + profiles
│   │       └── index.js          planRoutes() orchestrator
│   ├── controllers/
│   │   ├── routeController.js    ← NEW
│   │   └── walkabilityController.js ← NEW
│   ├── routes/{routes,walkability}.js ← NEW
│   ├── test/{walkability,routing}.test.js ← NEW (19 tests)
│   └── … (incident/auth/admin controllers, models — preserved)
│
├── analytics/                    Python spatial-stats microservice (preserved)
├── docs/                         merged documentation (see below)
└── docker-compose.yml            mongo + server + analytics + client
```

The routing data flow:

```
origin,destination ─► bbox ─► Overpass pedestrian network ─┐
                                                            ├─► scored graph
crowdsourced incidents (MongoDB, in bbox) ─► penalty field ─┘        │
                                                                     ▼
                              multi-objective Dijkstra × {fastest, shortest,
                              safest, comfortable, recommended, custom}
                                                                     │
                                                                     ▼
                                     ranked routes + metrics + GeoJSON
```

---

## 🚀 Quick start

### With Docker Compose (full stack)

```bash
cp .env.example .env        # then edit secrets
docker compose up --build
# client → http://localhost:8080   api → http://localhost:5000
```

### Local dev

```bash
# API
cd server && npm install && cp .env.example .env && npm run dev   # :5000

# Web
cd client && npm install && npm run dev                            # :5173
```

The Vite dev server proxies `/api` to `localhost:5000`. Open the **Routes**
tab, pick a start + destination, and hit **Find best routes**.

> **Network note:** route planning fetches the live pedestrian network from the
> public [Overpass API](https://overpass-api.de) at request time. If your
> environment blocks Overpass, point `OVERPASS_URL` at a self-hosted instance,
> or POST pre-fetched Overpass `elements` in the request body (the same hook the
> test-suite uses to run fully offline).

---

## 🔌 New API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/routes/plan` | Multi-objective route optimisation → ranked routes |
| `GET`  | `/api/routes/profiles` | Describe available routing objectives |
| `GET`  | `/api/walkability/weights` | Default indicator weights + colour scale |
| `POST` | `/api/walkability/score` | Score a segment from OSM tags or indicators |
| `GET`  | `/api/walkability/heatmap` | Walkability heatmap (GeoJSON) for the map |
| `POST` | `/api/vision/analyze` | AI image analysis of a report photo (multipart or `imageUrl`) |
| `GET`  | `/api/vision/status` | Active + configured vision providers |

`POST /api/routes/plan` request:

```jsonc
{
  "origin":      { "lat": 22.5726, "lng": 88.3639 },
  "destination": { "lat": 22.5760, "lng": 88.3680 },
  "priorities":  { "safety": 0.8, "greenery": 0.4, "wheelchair": true },
  "considerIncidents": true
}
```

Full reference and examples: [`docs/ROUTING.md`](docs/ROUTING.md) and the
existing reporting API in [`docs/API.md`](docs/API.md).

---

## 🧪 Tests

```bash
cd server && npm test          # 53 tests incl. walkability, routing & vision
cd client && npm run build     # production bundle
```

The routing/walkability tests use a deterministic synthetic lattice, so they
run with no database and no network.

---

## 📚 Documentation

| Doc | Contents |
|-----|----------|
| [`docs/INTEGRATION.md`](docs/INTEGRATION.md) | How the two repos were merged; what came from where; design decisions |
| [`docs/ROUTING.md`](docs/ROUTING.md) | Walkability engine + routing engine deep-dive, cost model, API |
| [`docs/VISION.md`](docs/VISION.md) | Modular AI image-analysis service — providers, schema, API |
| [`docs/PATHGUARD_REPORTING.md`](docs/PATHGUARD_REPORTING.md) | Full reporting-platform manual (original PathGuard README) |
| [`docs/API.md`](docs/API.md) | REST API reference |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | System architecture & deployment |
| [`docs/walkability-atlas/`](docs/walkability-atlas/) | Preserved UrbanPulse planning docs (roadmap, GIS pipeline, schema) |

---

## 🗺️ Roadmap (spec items not yet implemented)

The unified foundation is production-ready for routing, walkability scoring,
reporting, analytics and deployment. Larger spec items intentionally left as
clearly-scoped next steps:

- **Government dashboard** PDF/GIS-layer export and department assignment.
- **AI recommendation engine** ("install crossing here, +X walkability").
- **PostGIS migration** for pre-baked segment scoring at city scale (the
  current engine scores on-demand; see `docs/walkability-atlas/DB_SCHEMA.md`).

---

## 📄 License

MIT for code. OpenStreetMap data © OpenStreetMap contributors (ODbL). Please
cite the underlying IIT Kharagpur research (see
[`CITATION.cff`](CITATION.cff)) when reusing the walkability model or datasets.
