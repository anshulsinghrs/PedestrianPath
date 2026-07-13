# Deploying PathGuard (v4.0)

This guide takes you from a clean machine to a live three-tier deployment:

```
┌────────────────────────────┐   HTTPS    ┌────────────────────────────┐   TLS    ┌─────────────────────┐
│   Frontend (React/Vite)    │ ─────────► │   Backend (Node/Express)   │ ───────► │  MongoDB Atlas      │
│   GitHub Pages             │   /api/*   │   Render                   │  driver  │  (managed cluster)  │
│   anshulsinghrs.github.io  │            │   pathguard-api.onrender   │          │ cluster.mongodb.net │
└────────────────────────────┘            └────────────────────────────┘          └─────────────────────┘
                                                       │
                                                       │  HTTPS  (public on Free,
                                                       │          private when paid)
                                                       ▼
                                          ┌────────────────────────────┐
                                          │  Analytics (Python/FastAPI)│
                                          │  Render Free web service   │
                                          └────────────────────────────┘
```

Why this split?

- **GitHub Pages** is free, fast, and globally cached — perfect for a
  static React app, useless for an API.
- **Render** runs Node and Python with one-click deploys, persistent
  disks, and a generous free tier. The `render.yaml` blueprint provisions
  both services and the upload disk automatically.
- **MongoDB Atlas** is Mongo-as-a-service with a free 512 MB tier, daily
  snapshots, and TLS by default.

A 30-minute setup gets you to production. The rest of this doc walks
through it step by step.

---

## 0. Prerequisites

| Tool | Version | Why |
|---|---|---|
| `git` | any | clone + push |
| `node` | 18.x–20.x | local dev of `server/` and `client/` |
| `npm` | 9+ | bundled with Node |
| `docker` + `docker compose` | optional | one-command local stack |
| GitHub account | free | host repo + Pages |
| Render account | free | host backend |
| MongoDB Atlas account | free | host database |

You don't need a credit card for any of the free tiers.

---

## 1. Local development (do this first)

The fastest way to confirm the codebase works on your machine.

### Option A — Docker Compose (recommended)

```bash
git clone https://github.com/anshulsinghrs/urban_mobility.git
cd urban_mobility
docker compose up --build
```

Open <http://localhost:8080>. Mongo, the API, the analytics service and
the React app come up together. Data persists in named Docker volumes
(`mongo_data`, `server_uploads`) across restarts.

### Option B — Run each service in a terminal

```bash
# Terminal 1 — Mongo
docker run -d -p 27017:27017 --name pathguard-mongo \
  -v pathguard-mongo:/data/db mongo:7

# Terminal 2 — backend
cd server
cp ../.env.example .env   # then edit; minimum: MONGO_URI, JWT_SECRET
npm install
npm run seed              # optional: load v4.0 synthetic data
npm run dev               # nodemon on :5000

# Terminal 3 — frontend
cd client
cp .env.example .env      # leave VITE_API_URL empty for the dev proxy
npm install
npm run dev               # Vite on :5173
```

Visit <http://localhost:5173>. The Vite dev server proxies `/api/*` to
the backend on `:5000`, so no CORS hassles in dev.

### Run the test suite

```bash
cd server && npm test       # 50/50 should pass
cd client && npx vite build # production bundle should compile
```

---

## 2. MongoDB Atlas (production database)

This is the one piece that has to come before the backend deploy, because
Render needs the connection string at startup.

### 2.1 Create the cluster

1. Sign in to <https://cloud.mongodb.com/>.
2. **Create → Build a database → M0 (Free)**. Region: pick one close to
   your Render region (Oregon works well with Render's Oregon region).
3. Cluster name: `pathguard` (or anything you like).

### 2.2 Create the application user

1. Database Access → **Add new database user**.
2. Username: `pathguard-app`. Password: click **Autogenerate** and copy
   it — you won't see it again.
3. Built-in role: **Read and write to any database**.

### 2.3 Allow Render to reach Atlas

Render's outbound IPs aren't fixed on the free tier, so:

1. Network Access → **Add IP address → Allow access from anywhere**
   (`0.0.0.0/0`).
2. On paid plans, replace this with Render's static outbound IPs — see
   <https://render.com/docs/static-outbound-ip-addresses>.

### 2.4 Grab the connection string

1. Database → **Connect → Drivers → Node.js**.
2. Copy the URI. It looks like:

   ```
   mongodb+srv://pathguard-app:<password>@pathguard.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

3. Replace `<password>` with the password from step 2.2 and add the
   database name `pathguard` after the host:

   ```
   mongodb+srv://pathguard-app:THEPASSWORD@pathguard.xxxxx.mongodb.net/pathguard?retryWrites=true&w=majority
   ```

Keep this URI somewhere safe; you'll paste it into Render in step 3.

---

## 3. Backend on Render (one-click via Blueprint, no credit card)

The repo's `render.yaml` Blueprint provisions both services on Render's
**Free** plan. No payment information required.

> **Free-tier trade-offs to know up front.** Services sleep after
> 15 min of inactivity and cold-start (~30–60 s) on next request — the
> frontend banner shows this to users automatically. No persistent
> disks (uploads are ephemeral, see §5). No private services
> (the analytics service is a public web service; safe because it
> holds no user data — see comments in `render.yaml`). Soft cap of
> ~750 instance-hours/month per service, which two infrequently-used
> sleeping services fit inside.

### 3.1 First-time setup

1. Push the repo to GitHub if you haven't already.
2. Sign in to <https://dashboard.render.com>.
3. **New + → Blueprint**.
4. Connect your GitHub account and pick `anshulsinghrs/urban_mobility`
   (or your fork).
5. Render reads `render.yaml`, shows the two services it's about to
   create (`pathguard-api`, `pathguard-analytics`), and prompts you for
   the values of every env var marked `sync: false`.

### 3.2 Fill in the env vars Render asks for

| Variable | Value |
|---|---|
| `MONGO_URI` | the Atlas URI from step 2.4 |
| `ADMIN_EMAILS` | comma-separated emails (or leave blank) |

`JWT_SECRET` is auto-generated (`generateValue: true` in the Blueprint).
`CLIENT_URL` defaults to `https://anshulsinghrs.github.io` — update this
in `render.yaml` to your Pages URL if you've forked, otherwise CORS will
block your frontend.

### 3.3 Click **Apply**

Render builds, deploys and runs the health check. The first build takes
~5 min for the API (npm install + sharp) and ~3 min for the analytics
service. When it's done you'll see two public URLs like
`https://pathguard-api.onrender.com` and `https://pathguard-analytics.onrender.com`.

### 3.4 Wire the analytics URL into the API

`render.yaml` defaults `ANALYTICS_URL` to
`https://pathguard-analytics.onrender.com`. If Render assigned a
different hostname (it sometimes appends a suffix when the name is taken
across accounts):

1. Open `pathguard-api` in the Render dashboard.
2. **Environment** tab → edit `ANALYTICS_URL` → paste the actual
   `pathguard-analytics` URL.
3. Save → Render redeploys automatically.

### 3.5 Verify it's live

```bash
curl https://pathguard-api.onrender.com/api/health
# {"status":"ok","db":"up","schemaVersion":"4.0","timestamp":"..."}

# Readiness (gates on the database — returns 503 when db is down):
curl -i https://pathguard-api.onrender.com/api/health/ready
```

`/api/health` (liveness) returns HTTP 200 as long as the service is up,
even if the database is unreachable — check the `db` field in the body.
Cold start on the first request? Wait ~60 s and try again — that's the
Free-tier behaviour, not a bug. If `db: 'down'` persists, re-check
`MONGO_URI` and your Atlas IP allowlist.

### 3.6 (Optional) Seed synthetic data

Free-tier Render does support the dashboard **Shell** tab while the
service is awake. To seed:

1. Open the `pathguard-api` service in the Render dashboard.
2. Click **Shell** (top-right). If the service is asleep, hit
   `/api/health` once to wake it before opening the shell.
3. Run `node seed.js --modules 1,2 --count 200`.

Synthetic records carry `dataProvenance: 'synthetic_seed'` so they can
be filtered out of any export.

---

## 4. Frontend on GitHub Pages

### 4.1 Wire the backend URL into Pages

1. In your GitHub repo: **Settings → Secrets and variables → Actions**.
2. **New repository secret**:
   - **Name:** `VITE_API_URL`
   - **Value:** the Render URL from step 3.3 (e.g.
     `https://pathguard-api.onrender.com`) — **no trailing slash**.

Optional **variables** (not secrets) for city customisation:

- `VITE_CITY_NAME` (e.g. `Kharagpur`)
- `VITE_CITY_LAT` (e.g. `22.3149`)
- `VITE_CITY_LNG` (e.g. `87.31`)
- `VITE_CITY_ZOOM` (e.g. `13`)
- `VITE_MODULE3_ENABLED` (default `true`)

### 4.2 Enable Pages

**Settings → Pages → Build and deployment → Source: GitHub Actions**.

### 4.3 Trigger the deploy

Push to `main` (or **Actions → Deploy to GitHub Pages → Run workflow**).
The workflow warns (but no longer hard-fails) if `VITE_API_URL` is
missing, because you can also point the frontend at a backend via the
runtime override in §4.3.1.

### 4.3.1 Runtime override (no rebuild)

The build also publishes a tiny `config.js` next to `index.html`:

```js
window.__PATHGUARD_CONFIG__ = { apiUrl: 'https://pathguard-api.onrender.com' };
```

This file is loaded synchronously before the React bundle. If you ever
need to repoint the frontend at a different backend (staging, a moved
Render service, a custom domain), you can edit `client/public/config.js`
and re-deploy — or in a pinch, edit the already-deployed `config.js` on
the static host directly. The runtime value takes precedence over the
build-time `VITE_API_URL`. This also means a fork can deploy without
ever creating an Actions secret: set `apiUrl` in `client/public/config.js`
before the first push to `main`.

### 4.4 Verify end-to-end

1. Open your Pages URL.
2. There should be **no orange/red banner** at the top of the page.
3. Open the report flow; clicking through to **Submit** should succeed.
4. Confirm the browser dev-tools Network panel shows requests going to
   your Render URL (not to `github.io`).

---

## 5. Media uploads in production

**Render Free has no persistent disks.** Whatever `multer` writes to
`server/uploads/` lives only in the running container's filesystem and
is lost on every redeploy, restart, or cold-start. The submission and
the database row survive (Mongo is on Atlas, not on Render); only the
attached image / video file vanishes.

| | Behaviour |
|---|---|
| **Render Free (this blueprint)** | Uploads ephemeral. Image/video URLs in the DB become 404. Suitable for pilots where evidence isn't critical. |
| **Render Starter + 1 GB disk** (~$1.25/mo disk + $7/mo service) | Files survive redeploys. See "Add the disk back" below. |
| **Free object storage** (Cloudinary / Backblaze B2) | Recommended for any production deployment. See "Migrate to object storage" below. |

> **Module 3 never writes media.** The pre-save hook in
> `server/models/Incident.js` forces `imageUrl`/`videoUrl` to undefined
> regardless of input. The disk question only ever matters for Modules
> 1 + 2 evidence.

### Add the disk back (paid Render plan)

When you upgrade the API service to Starter or higher, append this
stanza inside the `pathguard-api` service block in `render.yaml`:

```yaml
disk:
  name: pathguard-uploads
  mountPath: /opt/render/project/src/server/uploads
  sizeGB: 1
```

…and bump `plan: free` to `plan: starter`. Render will mount the disk
on the next deploy. Existing DB rows that pointed at lost files will
remain 404 until you re-collect; new uploads will persist.

### Migrate to object storage (recommended at any scale)

Cloudinary's free tier (25 GB storage + 25 GB monthly bandwidth) is
plenty for a participatory-sensing pilot. The swap is small:

1. Add `cloudinary` (or `@aws-sdk/client-s3`) to `server/package.json`.
2. Replace the `fs.writeFileSync` in `server/middleware/upload.js` with
   an upload call to the provider.
3. Store the returned URL in `imageUrl` / `videoUrl` instead of the
   local `/uploads/...` path.

Controllers, models, and the frontend already treat the URL as opaque,
so no other file changes are needed.

---

## 6. Environment variable management

All env vars live in three places:

| Where | What | When you change |
|---|---|---|
| `render.yaml` | non-secret defaults, structure | when adding new vars or changing port/region/disk |
| Render dashboard | secret values (`sync: false`) | when rotating `MONGO_URI`, adding admin emails |
| GitHub Actions secrets/variables | frontend build-time config | when changing the API URL or city config |

### Local-dev vs production

| Variable | Local dev | Production |
|---|---|---|
| `MONGO_URI` | `mongodb://localhost:27017/pathguard` | Atlas URI |
| `JWT_SECRET` | anything | auto-generated by Render |
| `CLIENT_URL` | `http://localhost:5173,http://localhost:8080` | your Pages URL |
| `VITE_API_URL` | empty (Vite dev proxy) | Render URL |
| `MODULE_3_ENABLED` | `true` for testing | `false` until you've completed the M3 checklist |

### Rotating secrets

- **JWT_SECRET** rotation invalidates every issued token; users have to log
  in again. To rotate: change it in the Render dashboard, then redeploy.
- **MONGO_URI** rotation: update the password in Atlas → update the URI in
  Render → redeploy. Zero downtime.

---

## 7. Production-ready API routing

A few things the codebase already does for you:

- **Trust proxy** (`app.set('trust proxy', 1)`) — Express respects the
  `X-Forwarded-For` and `X-Forwarded-Proto` headers Render injects, so
  `req.ip` is the real client IP (rate-limiting works correctly) and
  `req.secure` reports HTTPS.
- **Split liveness / readiness health checks** — `/api/health`
  (liveness, what Render's `healthCheckPath` polls) returns HTTP 200
  whenever the process is up, reporting DB status in the body
  (`db: 'up' | 'down'`). It is intentionally decoupled from MongoDB so a
  transient DB outage (e.g. an Atlas allowlist hiccup) does **not** make
  Render mark the whole service unhealthy and pull it out of rotation —
  the API stays reachable and the frontend banner surfaces "database
  unavailable" instead of a total blackout. `/api/health/ready`
  (readiness) returns HTTP 503 with `db: 'down'` when Mongoose isn't
  connected, for orchestration or monitoring that wants to gate on the
  database. Both are mounted ahead of the rate limiter so frequent polling
  is never throttled to a 429.
- **CORS** is locked to the comma-separated `CLIENT_URL` list. Add your
  custom domain there once you wire it up.
- **Rate limits**: 200 req / 15 min globally, 30 reports / hour per IP
  (Modules 1+2), an extra 10 / hour per IP for Module 3.
- **EXIF stripping**: every uploaded image is re-encoded through `sharp`
  before storage. GPS metadata is dropped by default.
- **PII scrubbing**: Module 3 free text passes through `piiDetection.js`
  before storage, and the model pre-save hook scrubs it again as a
  belt-and-braces guarantee.

---

## 8. Scaling roadmap

The current Render+Atlas+Pages topology comfortably handles a city-scale
pilot (tens of thousands of reports, a few thousand DAU). Here's the
upgrade path when you outgrow it:

### Tier 1 — within the free tiers

- Render free-tier services sleep after 15 min of inactivity (~60 s cold
  start on next request). The fail-fast banner in `BackendStatusBanner`
  shows users when this is happening.
- Atlas M0 caps at 512 MB. ~5 KB/record gives you ~100k reports.

### Tier 2 — first paid upgrades (~$8/mo and up)

| Upgrade | Cost | Why |
|---|---|---|
| Render Free → **Starter** | $7/mo per service | no cold starts, no 750 hr/month cap, supports persistent disks |
| Add a 1 GB Render disk | $0.25/mo | makes media uploads persistent (see §5) |
| Atlas M0 → **M2/M5** burstable | $9–$25/mo | dedicated CPU, daily backups |
| Render **static outbound IPs** | $5/mo | tighten Atlas IP allowlist away from 0.0.0.0/0 |
| Flip analytics to **`type: pserv`** | free with paid plan | take the analytics service off the public internet |

### Tier 3 — multi-region / high traffic

- Add Cloudflare in front of GitHub Pages → faster TTFB globally.
- Swap media to **S3 + CloudFront** (or Backblaze B2 + bunny.net).
- Move analytics to a Render **worker** + Redis queue if heavy stats
  start blocking the request loop.
- Atlas → **sharded cluster** keyed by city / cohort.

### Tier 4 — research consortium scale

- Replace MongoDB with PostgreSQL + PostGIS for first-class GIS queries
  (the model is already 2dsphere-indexed; switch by writing a Prisma
  schema and dual-writing during migration).
- Replace the Render web service with a Kubernetes cluster (GKE/EKS)
  with HPA and a separate analytics autoscaling group.
- Add Kafka between the API and the analytics pipeline for stream
  processing of incoming reports.

The architectural seams that make these swaps cheap:

- The frontend talks only to one URL (`VITE_API_URL`) — swap the host
  without touching the React code.
- The backend's storage layer is encapsulated in `server/models/` —
  swap Mongoose for Prisma in one place.
- The analytics service is a private FastAPI app behind an HTTP
  boundary — swap it for anything that speaks the same JSON contract.

---

## 9. Complete checklist

```
[ ] Repo cloned, tests pass locally
[ ] MongoDB Atlas cluster created
[ ] Atlas user 'pathguard-app' has the connection URI
[ ] Atlas network access allows 0.0.0.0/0 (or Render's static IPs)
[ ] Render Blueprint deployed; both services healthy
[ ] /api/health returns {"status":"ok","db":"up"}
[ ] GitHub Pages: VITE_API_URL secret set to the Render URL
[ ] GitHub Pages: Settings → Pages → source = GitHub Actions
[ ] Deploy workflow ran green
[ ] Frontend loads with no orange/red banner at the top
[ ] Test a real submission: Module 1 report saves and appears on the map
[ ] (Optional) Synthetic data seeded
[ ] (Optional, gated) Module 3 enabled after the M3 checklist
[ ] Custom domain wired (Render dashboard + Pages settings + CORS update)
```

---

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `405 Method Not Allowed` on POST | Frontend is shipping without an API URL, so POSTs hit GitHub Pages itself | Set the `VITE_API_URL` Actions secret and re-deploy (step 4.1), or edit `config.js` on the static host per §4.3.1 |
| Banner: *Backend URL not configured* | Neither `VITE_API_URL` (build time) nor `window.__PATHGUARD_CONFIG__.apiUrl` (runtime) is set | Same as above |
| Banner: *Backend is currently unreachable* | Render free-tier cold start, or wrong URL — the process itself isn't answering | Wait 60 s for cold start; verify URL via `curl /api/health`; check the Render logs / deploy status |
| Banner: *Backend database is temporarily unavailable* | Server up but Mongoose isn't connected — `/api/health` returns 200 with `db: 'down'` | Check Atlas Network Access allowlist (0.0.0.0/0), `MONGO_URI`, and whether the M0 cluster is paused/cold |
| `/api/health/ready` returns 503 (`db: 'down'`) | Mongo URI typo, wrong password, missing IP allowlist | Re-paste the URI from Atlas; reset the user password; allow 0.0.0.0/0 temporarily to confirm |
| Reports submit but never appear on the map | `incidents` collection writes succeeding but read filtered out | Check the Sidebar filters; check Module 3 records (admin-only) |
| `403 module_3_disabled` from `/api/incidents/personal-safety` | `MODULE_3_ENABLED=false` on the server | Set to `true` in Render env vars after completing the M3 checklist |
| CORS error in browser console | Render `CLIENT_URL` doesn't match the page's origin | Update `CLIENT_URL` in Render env vars to your exact Pages origin (no path) |
| GitHub Actions: *VITE_API_URL secret is not set* (warning) | Build proceeded without a baked-in URL | Either set the secret per step 4.1 or commit your URL into `client/public/config.js` per §4.3.1 |
| Uploads disappear after redeploy | Expected on Render Free — no persistent disks | Either upgrade `pathguard-api` to Starter + add the `disk:` stanza (§5), or migrate to Cloudinary / S3 (§5) |

---

## 11. Related docs

- [`docs/REPORTING_WORKFLOWS_V4.md`](REPORTING_WORKFLOWS_V4.md) — the v4.0 reporting ontology
- [`docs/API.md`](API.md) — full endpoint reference
- [`docs/MODULE_3_DEPLOYMENT_CHECKLIST.md`](MODULE_3_DEPLOYMENT_CHECKLIST.md) — required before enabling Module 3
- [`docs/DEPLOY_FOR_YOUR_CITY.md`](DEPLOY_FOR_YOUR_CITY.md) — city-specific customisation
