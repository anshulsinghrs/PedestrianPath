# 🛡️ PathGuard — Participatory Urban Safety Intelligence

> Open-source research platform for participatory collection and geospatial
> analysis of urban safety data, organised around **three reporting modules**:
> accident/conflict, hazard/infrastructure, and personal-safety. Built for
> vulnerable road users (VRUs) in the South-Asian and broader LMIC context,
> with elevated privacy and safeguarding for personal-safety reports.

> **v3.0 is a major refactor** of the v2.x single-purpose VRU incident
> reporter into a three-module platform. See the
> [v3.0 changelog](#-v30-whats-new) below.

If you use PathGuard in research, please cite via
[`CITATION.cff`](CITATION.cff).

![PathGuard screenshot](screenshots/main.svg)

---

## 🧩 The three modules

| Module | Captures | Privacy posture | Default state |
|--------|----------|-----------------|---------------|
| **1. Accident & Conflict** | Collisions, near-misses, solo falls, mode-conflicts between mobility modes — *interaction-centric* (`reporterMode × interactingMode × interactionType`). | Anonymous-by-default; optional account attachment; standard k-anonymity exports. | **Enabled** |
| **2. Hazard & Infrastructure** | Potholes, damaged sidewalks, flooding, poor lighting, blocked paths, faded markings, construction hazards, drainage, visibility. | Anonymous-by-default; standard k-anonymity exports; photo evidence encouraged (EXIF stripped). | **Enabled** |
| **3. Personal Safety** | Harassment, verbal abuse, unsafe behaviour, theft, stalking, threatening environments, unsafe-route experiences. | **Elevated.** Forced anonymous; no images; PII detection on submit; free-text never exported; spatial output ≥500 m / k≥10; audit log on admin reads; per-record export-suppression flag; deferred-publication policy. | **Enabled** (deployers must still complete the safeguarding checklist before opening to participants) |

The discriminator field is `Incident.module` ∈
`accident_conflict | hazard_infrastructure | personal_safety`. The canonical
enum reference is [`docs/taxonomy.md`](docs/taxonomy.md). The Module 3
design rationale, threat model, and safeguarding protocol are in
[`docs/MODULE_3_DESIGN.md`](docs/MODULE_3_DESIGN.md).

---

## 📦 v3.0 — what's new

- **Three reporting modules with distinct architectural treatments.**
  Module 3 is enabled by default (`MODULE_3_ENABLED=true`), opt-in per
  reporter, and opt-in per export — the deployment flag can still be
  set to `false` to disable it entirely.
- **Closed four-value reporter-mode set:** `pedestrian`, `cyclist`,
  `two_wheeler`, `other`. `two_wheeler` is included because in the
  LMIC / South-Asian context, motorised two-wheeler riders face crash
  risk comparable to cyclists. Cars/buses/trucks/auto-rickshaws are
  *interacting modes only*.
- **Interaction-centric Module 1.** Every accident/conflict carries
  `reporterMode`, `interactingMode` (incl. `none` for solo incidents),
  and `interactionType` (overtaking, turning conflict, dooring, …).
- **Real cell-level k-anonymity** with a privacy manifest on every
  export. Module 3 is **policy-locked** to k≥10, cell≥500 m; the
  manifest reports requested vs applied parameters and every coercion.
- **PII-detection middleware** for Module 3 free-text (phone numbers,
  emails, name patterns); 400 response with a redacted preview, opt-in
  to store the redacted version via `confirmRedacted=true`.
- **Conservative crisis-pattern detection** surfaces support-service
  contacts on the Module 3 submission acknowledgment when language
  suggests immediate danger.
- **Configurable per-deployment support-services registry**
  (`MODULE_3_SUPPORT_SERVICES_CONFIG_PATH`) and crisis-keyword list
  (`MODULE_3_CRISIS_KEYWORDS_PATH`) for locale-relevant content.
- **Per-record `exportSuppressed`** flag, honoured by every export
  pipeline.
- **Audit log** of admin reads of raw Module 3 records.
- **21 dependency-free safeguard tests** under `server/test/` that
  exercise PII detection, crisis detection, k-anonymity policy
  enforcement, manifest fidelity, and the support-services registry.

---

## 🏗️ Architecture

Four containerised services brought up with `docker compose up`:

```
                ┌────────────────────────────────┐
                │   React + Vite + Leaflet UI    │
                │  3 module forms · 3 map layers │
                │  3 analytics tabs              │
                └───────────────┬────────────────┘
                                │ JSON / multipart
                ┌───────────────▼────────────────┐
                │     Node + Express REST API    │
                │ /api/incidents/{m1,m2,m3} ·    │
                │ /api/analytics/* · /api/config │
                │ PII detect · crisis detect ·   │
                │ audit log · k-anonymity        │
                └───────┬─────────────────┬──────┘
                        │ Mongoose        │ HTTP
                ┌───────▼──────────┐  ┌───▼─────────────┐
                │ MongoDB 7        │  │ Python FastAPI  │
                │ 2dsphere index   │  │ KDE · Gi* ·     │
                │ Incident · User  │  │ temporal CI     │
                │ Infrastructure   │  │ (stateless)     │
                └──────────────────┘  └─────────────────┘
```

Detail: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## 🛠️ Tech stack

| Layer       | Tech                                                                |
|-------------|---------------------------------------------------------------------|
| Frontend    | React 18, Vite 5, Leaflet 1.9, leaflet.markercluster, Axios         |
| Backend     | Node 20, Express 4, Mongoose 8, JWT, Multer, express-validator, sharp |
| Analytics   | Python 3.11, FastAPI, numpy, scipy                                  |
| Database    | MongoDB 7 + 2dsphere geospatial indexes                             |
| Tests       | Node's built-in test runner (`node --test`)                         |

---

## 🚀 Getting started

### Quickest path: Docker Compose

```bash
git clone https://github.com/anshulsinghrs/urban_mobility.git
cd urban_mobility
cp .env.example .env       # set JWT_SECRET and (optionally) city vars
docker compose up --build
```

Opens at <http://localhost:8080>. Module 3 stays disabled. The stack
boots Mongo, the Node API, the Python analytics service, and the
nginx-served React client.

### Local development (without Docker)

```bash
# Backend
cd server && npm install && cp .env.example .env
npm run seed                # synthetic Modules 1+2 data around Mumbai
npm run dev                 # http://localhost:5000
npm test                    # 21 safeguard tests

# Analytics service (new terminal)
cd analytics && pip install -r requirements.txt
uvicorn main:app --port 8000

# Frontend (new terminal)
cd client && npm install
npm run dev                 # http://localhost:5173
```

### Migrating from a v2.x install

```bash
cd server
npm run migrate:v3                       # back-fills the module discriminator
npm run migrate:v3 -- --dry-run          # preview without writing
```

---

## 🌐 API at a glance

| Method | Endpoint                                                | Purpose                                  |
|--------|---------------------------------------------------------|------------------------------------------|
| GET    | `/api/config`                                           | Deployment flags (incl. Module 3 state)  |
| GET    | `/api/config/support-services`                          | Support-services registry                |
| GET    | `/api/incidents?module=...`                             | List incidents (non-admin excludes M3)   |
| POST   | `/api/incidents/accident-conflict`                      | **Module 1** create                      |
| POST   | `/api/incidents/hazard-infrastructure`                  | **Module 2** create                      |
| POST   | `/api/incidents/personal-safety`                        | **Module 3** create (forced anonymous, PII-screened) |
| GET    | `/api/incidents/analytics/interactions`                 | Module 1 interaction matrices            |
| GET    | `/api/incidents/analytics/infrastructure-conditions`    | Module 2 hazard + feature stats          |
| GET    | `/api/incidents/analytics/personal-safety-context`      | Module 3 aggregated context only (k≥10) |
| GET    | `/api/incidents/analytics/hotspots/kde`                 | Python-backed KDE density                |
| GET    | `/api/incidents/analytics/hotspots/getis-ord`           | Python-backed Getis-Ord Gi*              |
| GET    | `/api/incidents/export`                                 | k-anonymous CSV/GeoJSON + privacy manifest |

Full spec, request/response shapes, and error codes
(`module_3_disabled`, `pii_detected`, `module_3_raw_access_denied`,
`module_3_immutable`): [`docs/API.md`](docs/API.md).

---

## 🔒 Privacy posture in one glance

| Concern              | Modules 1 + 2                  | Module 3                                            |
|----------------------|--------------------------------|-----------------------------------------------------|
| Anonymity            | Anonymous-by-default           | Forced anonymous (pre-save hook)                    |
| Free text            | Stored; exportable if consented| **Never** exported; PII-screened on submit          |
| Images               | Accepted (EXIF stripped)       | **Disabled** by default                             |
| Spatial granularity  | k≥5, cell≥100 m (configurable) | k≥**10**, cell≥**500 m** (policy-locked)           |
| Read API             | Public list + detail           | Non-admin: 403; admin reads are **audit-logged**    |
| Per-record opt-out   | Available                      | Visible UI control during submission                |

The k-anonymity implementation is in `server/services/privacy.js`; every
export returns a `privacyManifest`.

---

## 🛟 Module 3 — read this before opening to participants

Module 3 is **enabled by default** (`MODULE_3_ENABLED=true`). Before
collecting data from real participants, the deployer must still work
through and sign off
[`docs/MODULE_3_DEPLOYMENT_CHECKLIST.md`](docs/MODULE_3_DEPLOYMENT_CHECKLIST.md):

- IRB / IEC approval in hand.
- Co-investigator with feminist-HCI / women's-safety-research
  background on the team.
- Locally-relevant support-services registry populated and verified.
- Locale-relevant PII rules and crisis-pattern keywords reviewed.
- Participatory-design feedback incorporated into the Module 3 UI.

Deployment process: [`docs/DEPLOY_MODULE_3.md`](docs/DEPLOY_MODULE_3.md).
Participant consent template: [`docs/MODULE_3_CONSENT_TEMPLATE.md`](docs/MODULE_3_CONSENT_TEMPLATE.md).
Pilot protocol (gated placeholder until preconditions are met):
[`docs/MODULE_3_PILOT_PROTOCOL.md`](docs/MODULE_3_PILOT_PROTOCOL.md).

---

## 📂 Project structure

```
urban_mobility/
├── client/                          # React + Vite frontend
│   └── src/
│       ├── components/
│       │   ├── ModulePicker.jsx     # Home entry — 3 modules
│       │   ├── Module1Form.jsx      # Accident / conflict
│       │   ├── Module2Form.jsx      # Hazard / infrastructure
│       │   ├── Module3Form.jsx      # Personal safety (safeguarded)
│       │   ├── MapView.jsx          # 3 toggleable module layers
│       │   └── AnalyticsDashboard.jsx  # 3 tabs
│       ├── context/                 # AuthContext, IncidentContext
│       ├── services/api.js
│       ├── utils/incidentTypes.js   # module-aware enum mirrors
│       └── config/city.js
├── server/                          # Node + Express backend
│   ├── controllers/incidentController.js  # module-aware create/read/export
│   ├── middleware/
│   │   ├── auth.js                  # requireAdmin for Module 3 raw reads
│   │   ├── piiDetection.js          # phone/email/name-pattern
│   │   └── auditLog.js              # Module 3 admin-read audit log
│   ├── routes/
│   │   ├── incidents.js             # module-specific POST endpoints
│   │   └── config.js                # GET /api/config + /support-services
│   ├── services/
│   │   ├── privacy.js               # cell-level k-anonymity
│   │   ├── analyticsClient.js       # HTTP to Python analytics
│   │   └── crisisDetection.js       # Module 3 conservative keywords
│   ├── config/supportServices.js    # configurable registry
│   ├── models/                      # Incident · User · Infrastructure
│   ├── scripts/migrate-to-v3-modules.js
│   ├── test/safeguards.test.js      # 21 safeguard tests
│   └── seed.js                      # --modules 1,2 by default
├── analytics/                       # Python FastAPI stateless service
│   ├── main.py                      # /kde · /getis-ord · /temporal-pattern
│   └── requirements.txt
├── docs/
│   ├── taxonomy.md
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── DEPLOY_FOR_YOUR_CITY.md
│   ├── DEPLOY_MODULE_3.md
│   ├── MODULE_3_DESIGN.md
│   ├── MODULE_3_DEPLOYMENT_CHECKLIST.md
│   ├── MODULE_3_CONSENT_TEMPLATE.md
│   ├── MODULE_3_PILOT_PROTOCOL.md
│   ├── PILOT_CONSENT_TEMPLATE.md
│   └── SEEDING.md
├── docker-compose.yml
├── CITATION.cff
└── .env.example
```

---

## 🧪 Sample data and seeding

```bash
npm run seed --prefix server                           # Modules 1+2, Mumbai
npm run seed --prefix server -- --city kharagpur       # any preset city
npm run seed --prefix server -- --modules 1,2,3        # include Module 3 (synthetic only)
```

Every seeded record carries `dataProvenance: 'synthetic_seed'`. Research
exports exclude these by default unless `includeSynthetic=true` is passed.
See [`docs/SEEDING.md`](docs/SEEDING.md).

---

## 🧰 Tests

```bash
cd server && npm test
```

21 dependency-free Node tests covering Module 3 safeguards: PII
detection, the middleware's 400 + redacted-preview behaviour and the
`confirmRedacted=true` path, crisis-pattern detection, k-anonymity
policy enforcement (k=1 retains everything; k=15 visibly suppresses;
Module 3 minima are policy-locked; manifest reports requested vs
applied parameters), free-text stripping, and the support-services
registry.

---

## 🔬 Research applications

- Interaction-centric crash analysis at junctions and corridors.
- Mode-comparative analysis (pedestrian / cyclist / two-wheeler / other).
- Hazard-condition tracking against an OSM-linked infrastructure layer.
- Aggregate personal-safety mapping with deferred-publication safeguards
  for participatory women's-safety research.
- Reproducible exports with a documented privacy manifest.

---

## 🗺️ Roadmap

- [ ] Module 3 IRB process and the gender-balanced participatory-design
      rounds (paper 2).
- [ ] Trained ML risk-score model (replaces rule-based placeholder).
- [ ] OSM auto-import wired into deployment.
- [ ] Locale packs (Hindi, Marathi, …) for Module 3 PII / crisis lists.
- [ ] Admin moderation dashboard (separate paper).
- [ ] Native mobile app (out of v3.0 scope).
- [ ] Real-time WebSocket updates (out of v3.0 scope).

---

## 📚 Documentation

- [`docs/taxonomy.md`](docs/taxonomy.md) — canonical taxonomy and OSM mappings
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — four-service architecture
- [`docs/API.md`](docs/API.md) — every endpoint and error code
- [`docs/DEPLOY_FOR_YOUR_CITY.md`](docs/DEPLOY_FOR_YOUR_CITY.md) — Modules 1+2
- [`docs/DEPLOY_MODULE_3.md`](docs/DEPLOY_MODULE_3.md) — Module 3 (gated)
- [`docs/MODULE_3_DESIGN.md`](docs/MODULE_3_DESIGN.md) — Module 3 source of truth
- [`docs/MODULE_3_DEPLOYMENT_CHECKLIST.md`](docs/MODULE_3_DEPLOYMENT_CHECKLIST.md)
- [`docs/MODULE_3_CONSENT_TEMPLATE.md`](docs/MODULE_3_CONSENT_TEMPLATE.md)
- [`docs/MODULE_3_PILOT_PROTOCOL.md`](docs/MODULE_3_PILOT_PROTOCOL.md)
- [`docs/SEEDING.md`](docs/SEEDING.md) — synthetic data generation
- [`docs/PILOT_CONSENT_TEMPLATE.md`](docs/PILOT_CONSENT_TEMPLATE.md) — Modules 1+2 consent template

## 🤝 Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).
Module 3 contributions must reference [`docs/MODULE_3_DESIGN.md`](docs/MODULE_3_DESIGN.md);
if a feature conflicts with a safeguard, the safeguard wins.

## 📄 License

[MIT](LICENSE)

## 🙏 Credits

- Spiritual successor to [BikeMaps.org](https://bikemaps.org); inspired
  also by Vision-Zero programmes, pedestrian-safety GIS research,
  feminist-HCI women's-safety research, and community hazard-reporting
  tools.
- Map tiles by [OpenStreetMap](https://www.openstreetmap.org) contributors.
