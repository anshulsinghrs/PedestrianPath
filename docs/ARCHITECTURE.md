# PathGuard v3.0 — Architecture

PathGuard is a participatory urban-safety intelligence platform organised
around **three reporting modules**:

- **Module 1 — Accident & Conflict Reporting** (interaction-centric).
- **Module 2 — Hazard & Infrastructure Condition Reporting**.
- **Module 3 — Personal Safety Reporting** (safeguarded; off by default).

Each module shares one schema (`Incident`) discriminated by the `module`
field, but Module 3 has elevated privacy and safeguarding rules — see
`MODULE_3_DESIGN.md`.

---

## 1. Services

Four containerised services (see `docker-compose.yml`):

| Service     | Stack                                          | Responsibilities                                                                 |
|-------------|------------------------------------------------|----------------------------------------------------------------------------------|
| `client`    | React 18 + Vite 5 + Leaflet 1.9 + nginx        | UI, mapping, three reporting flows, three-tab analytics dashboard.               |
| `server`    | Node 20 + Express 4 + Mongoose 8               | REST API, validation, PII detection, k-anonymity, audit log, module gating.      |
| `analytics` | Python 3.11 + FastAPI + numpy/scipy            | Stateless spatial stats (KDE, Getis-Ord Gi*, temporal patterns).                 |
| `mongo`     | MongoDB 7                                       | Persistence, 2dsphere geospatial index, named volume for durability.             |

The client talks only to the server. The server talks to MongoDB directly
and forwards points-only payloads to the analytics service over HTTP
(`ANALYTICS_URL`). The analytics service holds no DB connection.

---

## 2. Data model

Three Mongoose models in `server/models/`:

- **Incident** — single collection covering all three modules. The
  `module` discriminator is required; per-module fields are validated
  per-module by the route validators (`server/routes/incidents.js`).
- **Infrastructure** — built-environment features. Stores both
  OSM-imported (`dataProvenance='osm_import'`) and user-reported features
  in the same collection.
- **User** — registration / authentication. Reporter mode is constrained
  to the four-value reporter-mode set (`pedestrian`, `cyclist`,
  `two_wheeler`, `other`). Wheelchair / runner / e-scooter usage is
  captured via `accessibilityNeeds` or folded into `other`.

See `docs/taxonomy.md` for every enum value.

---

## 3. Privacy posture

| Concern                | Modules 1 + 2                                            | Module 3                                                                 |
|------------------------|----------------------------------------------------------|--------------------------------------------------------------------------|
| Anonymity              | Anonymous-by-default; user may attach account.           | Forced anonymous by pre-save hook (no account attachment).                |
| Free text              | Stored; included in JSON exports if consented.           | Stripped from every export; PII-screened on submission.                  |
| Images                 | Accepted; EXIF stripped via `sharp` on upload.           | Disabled by default. Gated behind `MODULE_3_IMAGES_ENABLED` (deferred). |
| Spatial granularity     | Configurable cell k-anonymity (default k=5, 100 m).      | Locked: k ≥ 10, cell ≥ 500 m.                                            |
| Temporal granularity    | day / week / month.                                       | day / week / month (no sub-day).                                          |
| Export-suppression      | Per-record `exportSuppressed` flag (rare; uncommon UI).  | Per-record `exportSuppressed` flag (visible UI control).                 |
| Read API                | Public list + detail with filters.                       | Non-admin: list/detail return 403. Admins read via audit-logged path.   |

The k-anonymity implementation is in `server/services/privacy.js`. Every
export returns a `privacyManifest` recording the requested-vs-applied
parameters, suppression counts, and retention fraction.

---

## 4. Module 3 safeguarding

Module 3 has additional surface beyond schema and privacy:

- `server/middleware/piiDetection.js` — phone / email / name-pattern
  detection; returns 400 with a redacted preview unless
  `confirmRedacted=true` is sent.
- `server/services/crisisDetection.js` — conservative keyword detection;
  surfaces helpline contacts on the submission acknowledgment.
- `server/config/supportServices.js` — configurable registry of local
  helplines.
- `server/middleware/auditLog.js` — append-only JSON-lines log of every
  admin read of Module 3 records.
- `server/routes/config.js` → `GET /api/config` — exposes whether the
  Module 3 flag is on; the client polls this and adapts.

Module 3 is enabled only when `MODULE_3_ENABLED=true` AND the deployment
checklist (`docs/MODULE_3_DEPLOYMENT_CHECKLIST.md`) is complete.

---

## 5. Frontend flow

1. **Landing.** The Navbar "Report" button opens `ModulePicker`. Module 3
   is only visible if the server reports it enabled.
2. **Module pick.** Choosing a module starts the location-picking mode on
   the map.
3. **Form.** One of `Module1Form` / `Module2Form` / `Module3Form` opens
   with the picked location pinned. Module 3 has its distinct UI
   affordances (banner, quick-exit, PII warnings, support panel).
4. **Map view.** Three module layers + KDE + infrastructure overlay,
   each independently toggleable. Module 3 toggle is hidden when the flag
   is off and only renders aggregated cell counts when on.
5. **Analytics dashboard.** Three tabs (Modules 1, 2, 3). Module 3 export
   parameters are locked to the policy minima in the UI.

---

## 6. Reproducibility

- `docker compose up` brings the whole stack with Module 3 disabled by
  default.
- `server/seed.js` generates synthetic Module 1 + 2 data tagged
  `dataProvenance='synthetic_seed'`; never seeds Module 3 unless asked
  via `--modules 1,2,3`.
- `server/scripts/migrate-to-v3-modules.js` back-fills the `module`
  discriminator on existing pre-v3 documents.
- `server/test/safeguards.test.js` exercises every Module 3 safeguard
  (Node's built-in test runner).
- `CITATION.cff` lists the preferred research citations.
