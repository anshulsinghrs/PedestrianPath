# Deploying PathGuard for your city

PathGuard is designed to deploy to any city via **configuration**, not
code changes. A reader who knows their city's coordinates and an OSM
bounding box should be able to run a usable instance in under 30 minutes.

This guide walks through the four steps. Run times are wall-clock
estimates on a moderately fast laptop with broadband.

| Step                                  | Time          |
|---------------------------------------|---------------|
| 1. Clone & copy `.env.example`        | 1 min         |
| 2. Set city env vars                  | 2 min         |
| 3. `docker compose up --build`         | ~5 min first run |
| 4. Import OSM infrastructure          | 5–20 min depending on bbox |

---

## 1. Clone and copy environment template

```bash
git clone https://github.com/anshulsinghrs/pathguard.git
cd pathguard
cp .env.example .env
```

The repo-root `.env` is read by `docker-compose.yml`; the values flow to
the Node API at runtime and to the React client at build time. There is
no separate `client/.env` to maintain when using compose.

## 2. Set city configuration

Find your city's coordinates (latitude, longitude) and a rough zoom
level (12 is a good default for a 20 km extent, 13 for a single
neighbourhood). Optionally, find an OSM bounding box on
[bboxfinder.com](http://bboxfinder.com) in the form
`minLng,minLat,maxLng,maxLat`.

Edit `.env`:

```env
VITE_CITY_NAME=Kharagpur
VITE_CITY_LAT=22.3149
VITE_CITY_LNG=87.31
VITE_CITY_ZOOM=13
VITE_CITY_LOCALE=en
VITE_CITY_OSM_BBOX=87.27,22.28,87.35,22.36

JWT_SECRET=replace_with_a_long_random_string
CLIENT_URL=http://localhost:8080
```

Optional regional taxonomy customisation: if your city needs additional
incident types or contributing factors, add them to
`server/models/Incident.js` and `client/src/utils/incidentTypes.js`
**additively** (never remove existing values, or you will break
backwards compatibility with the sample dataset and the paper's
exemplars). Document any additions in your fork of `docs/taxonomy.md`.

## 3. Launch the stack

```bash
docker compose up --build
```

On first run this will:

1. Pull `mongo:7` and `nginx:alpine`.
2. Build the analytics image (~600 MB; scipy + libpysal wheels).
3. Build the server image (Node 20 + sharp).
4. Build the client image (npm install + Vite build, ~2 min).
5. Start all four services.

Open <http://localhost:8080> — the map should centre on your city.

Health checks:

- `http://localhost:8080/api/health` returns `{status:"ok"}`.
- The analytics service's `/health` is reachable from inside the compose
  network only; you can verify it with
  `docker compose exec server wget -qO- http://analytics:8000/health`.

## 4. Import OSM infrastructure features

You can hydrate the infrastructure layer from OpenStreetMap so that
report submitters see real footpaths, crossings, and bike lanes when
linking incidents. There are two simple approaches.

### 4a. Overpass API (recommended for small cities)

Use Overpass Turbo's export to pull the relevant tags within your
bounding box, then POST them to PathGuard.

A worked example for Kharagpur (`87.27,22.28,87.35,22.36`):

```bash
# Pull crossings, footways, cycleways from OSM
curl -G 'https://overpass-api.de/api/interpreter' \
  --data-urlencode 'data=
    [out:json][timeout:60];
    (
      node["highway"="crossing"](22.28,87.27,22.36,87.35);
      node["highway"="bus_stop"](22.28,87.27,22.36,87.35);
      way["highway"="footway"](22.28,87.27,22.36,87.35);
      way["highway"="cycleway"](22.28,87.27,22.36,87.35);
      way["cycleway"](22.28,87.27,22.36,87.35);
    );
    out center tags;' \
  -o kharagpur_osm.json

# Reshape to PathGuard import format and POST
node -e '
const fs = require("fs");
const raw = JSON.parse(fs.readFileSync("kharagpur_osm.json"));
const features = raw.elements
  .map(e => ({
    id: `${e.type}/${e.id}`,
    lat: e.lat ?? e.center?.lat,
    lng: e.lon ?? e.center?.lon,
    tags: e.tags || {},
  }))
  .filter(f => Number.isFinite(f.lat));
process.stdout.write(JSON.stringify({features}));
' | curl -X POST http://localhost:8080/api/infrastructure/import-osm \
        -H 'Content-Type: application/json' \
        --data-binary @-
```

PathGuard upserts each feature by `osmId`, so re-running the import
updates rather than duplicates entries. Records land with
`dataProvenance: 'osm_import'` and the original tag set preserved in
`osmTags` for reproducible re-derivation.

### 4b. osmnx + Python (for larger cities)

If your bbox is large enough that Overpass times out, switch to
`osmnx`/`pyrosm` locally and pipe the same JSON shape into the import
endpoint. The schema docs in [`API.md`](API.md) detail the expected fields.

## 5. Seed synthetic data (optional)

For demos and screenshots only:

```bash
docker compose exec server node seed.js --city kharagpur --count 200
```

Synthetic records are tagged with `dataProvenance: 'synthetic_seed'`
and are **excluded by default** from research exports. See
[`SEEDING.md`](SEEDING.md).

## 6. Locale switching

PathGuard's existing i18n scaffold respects `VITE_CITY_LOCALE`. Adding
a new language is out of scope for this release (paper §7.3 future
work); see `client/src/utils/i18n.js` for the entry point.

## 7. Production considerations

- Set a real `JWT_SECRET` and use HTTPS termination in front of nginx.
- Mount `server_uploads` to a durable volume or replace
  `server/middleware/upload.js` with an S3/Cloudinary uploader. The
  EXIF-stripping logic uses `sharp` and is independent of storage
  backend.
- Tighten CORS by setting `CLIENT_URL` to your real client origin.
- Tune the per-IP rate limit in `server/routes/incidents.js` if you
  expect high-volume submissions.

## 8. IRB and pilot considerations

If you intend to use PathGuard for participatory data collection that
will be published, use the consent template at
[`PILOT_CONSENT_TEMPLATE.md`](PILOT_CONSENT_TEMPLATE.md) as a starting
point and seek your institution's ethics review. Tag the deployment by
visiting `/pilot/<cohort-tag>` once per participant so submissions
land with the correct `dataProvenance` and `pilotCohort`.

---

## Module 3 (Personal Safety)

This guide covers Modules 1 and 2 only. **Module 3 is disabled by default**
and requires a separate deployment process. See
[`DEPLOY_MODULE_3.md`](DEPLOY_MODULE_3.md) and complete
[`MODULE_3_DEPLOYMENT_CHECKLIST.md`](MODULE_3_DEPLOYMENT_CHECKLIST.md)
before flipping the flag.
