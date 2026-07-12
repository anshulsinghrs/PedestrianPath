# PathGuard API (v4.0)

Base URL: `/api`. Auth-protected routes expect `Authorization: Bearer <token>`.
Optional auth routes accept the same header but never require it.

All POST/GET responses are JSON unless otherwise noted. Errors come back as
`{ "error": "<code>", "message"?: "..." }` plus an HTTP status.

> **v4.0 note.** The v3.0 endpoints continue to work unchanged. v4.0 adds
> new optional request fields (collision/near-miss subtypes, hazard
> categories, behavioural adaptation, intervention preferences,
> demographics, …) and four new analytics endpoints. See
> `docs/REPORTING_WORKFLOWS_V4.md` for the full ontology.

---

## Deployment config

### `GET /api/config`

Read-only deployment flags. The frontend uses this to decide whether to
surface Module 3.

```json
{
  "version": "3.0.0",
  "module3Enabled": false,
  "module3ImagesEnabled": false
}
```

### `GET /api/config/support-services`

Locally-configured support-services registry surfaced in Module 3 UI.

---

## Authentication

| Method | Path | Body | Returns |
|--------|------|------|---------|
| POST   | `/api/auth/register` | `{ name, email, password, mobilityMode?, preferredTravelMode?, accessibilityNeeds? }` | `{ user, token }` |
| POST   | `/api/auth/login`    | `{ email, password }` | `{ user, token }` |
| GET    | `/api/auth/me`       | — (auth) | `{ user }` |
| PATCH  | `/api/auth/me`       | partial user (auth) | `{ user }` |

`mobilityMode` / `preferredTravelMode` are constrained to the four-value
reporter-mode enum (`pedestrian`, `cyclist`, `two_wheeler`, `other`).

---

## Incidents — reads

### `GET /api/incidents`

Returns incidents. Module 3 records are **always excluded** for
unauthenticated and non-admin users, regardless of `module=` filter. If a
non-admin requests `?module=personal_safety` the endpoint returns 403.

Query parameters:

| Name | Type | Notes |
|------|------|-------|
| `module` | `accident_conflict\|hazard_infrastructure\|personal_safety` | Filter. Module 3 is admin-only. |
| `reporterMode` | comma-sep | Module 1/2 reporter mode. |
| `incidentType` | comma-sep | Module 1 incident type. |
| `hazardType` | comma-sep | Module 2 hazard type. |
| `concernType` | comma-sep | Module 3 concern type (admin only). |
| `severity` | comma-sep | |
| `from`, `to` | ISO date | |
| `bbox` | `minLng,minLat,maxLng,maxLat` | |
| `schoolZone` | bool | |
| `nearMissOnly` | bool | |
| `limit` | int | default 500, max 5000 |

### `GET /api/incidents/:id`

Single incident. Module 3 records 403 for non-admin.

### `GET /api/incidents/stats/summary`

Module breakdown, reporter-mode breakdown, severity breakdown, totals. Module
3 is excluded for non-admin.

### `GET /api/incidents/admin/personal-safety` (admin)

Audit-logged admin listing of Module 3 records. Requires `requireAdmin`.

---

## Incidents — module-specific creates

Per-module endpoints with module-appropriate validation. All accept
multipart for the image attachment (Modules 1 and 2) and standard JSON for
Module 3. Optional auth (modules 1 + 2); Module 3 forces anonymous.

### `POST /api/incidents/accident-conflict` (Module 1)

Required fields:

| Field | Notes |
|-------|-------|
| `reporterMode` | v4.0 set: `pedestrian, cyclist, ebike_scooter, two_wheeler, car_driver, public_transport, wheelchair, observer, other` |
| `incidentType` | `collision, near_miss, solo_fall, forced_evasive, aggressive_interaction, mode_conflict, other` |
| `lat`, `lng` | required |

Optional v3.0 fields:

| Field | Notes |
|-------|-------|
| `interactingMode`, `interactionType` | single-valued (legacy) |
| `severity`, `injuryLevel`, `description`, `incidentDate`, `weather`, `lightingCondition`, `roadType`, `crossingType`, `schoolZone`, `tripPurpose`, `speedCategory` | optional |
| `infrastructureContributingFactors` | comma-sep or array |
| `linkedInfrastructure` | comma-sep ObjectIds |
| `image` | multipart file (EXIF-stripped on storage) |

Optional **v4.0** fields:

| Field | Notes |
|-------|-------|
| `interactingModes` | comma-sep or array — multi-party support |
| `collisionType` | when `incidentType=collision`. See `taxonomy.md` §1A. |
| `nearMissType` | when `incidentType=near_miss`. |
| `evasiveAction` | what action the reporter took. |
| `soloFallContributors` | comma-sep when `incidentType=solo_fall`. |
| `perceivedDangerScale` | 1–5 ordinal. |
| `affectsFutureRoute` | boolean (string `"true"`/`"false"` accepted from multipart). |
| `repeatLocationHistory` | `first_time|a_few_times|often|always|unknown`. |
| `indirectContribution` | boolean — third-party indirectly contributed to a solo fall. |
| `video` | multipart file (MP4/MOV/WEBM/MKV, ≤ `MAX_VIDEO_FILE_SIZE_MB` MB). |
| `demographics` | JSON: `{ageGroup,gender,modeUsageFrequency}` — all optional. |

### `POST /api/incidents/hazard-infrastructure` (Module 2)

Required: `hazardType` (see `taxonomy.md` §5), `lat`, `lng`. Image upload
is encouraged.

Optional **v4.0** fields:

| Field | Notes |
|-------|-------|
| `hazardCategory` | `surface_structural|accessibility_pathway|cycling_micromobility|visibility_environmental|traffic_environment` |
| `hazardSeverityPerceived` | 1–5 ordinal. |
| `hazardDuration` | `just_appeared|within_week|few_weeks|months|over_year|unknown`. |
| `hazardVisibilityConditions` | comma-sep — e.g. `nighttime,rain,always_visible`. |
| `affectedUserGroups` | comma-sep reporter modes. |
| `behaviorAffected` | boolean. |
| `behavioralImpactTypes` | comma-sep — `near_misses,falls,crashes,route_avoidance,time_avoidance,mode_change,perceived_unsafety,travel_with_others,stopped_travelling_here`. |
| `video` | multipart file. |
| `demographics` | JSON sub-document. |

### `POST /api/incidents/personal-safety` (Module 3)

Requires `MODULE_3_ENABLED=true` on the server — otherwise returns 403
with `error: 'module_3_disabled'`.

Required: `concernType` (see `taxonomy.md` §6), `lat`, `lng`.
Optional: `timeOfDayContext`, `crowdLevel`, `perceivedRiskLevel` (1–5),
`lightingCondition`, `description`, `exportSuppressed`, `consentForResearch`.

Optional **v4.0** fields:

| Field | Notes |
|-------|-------|
| `mobilityActivity` | what the reporter was doing (walking, cycling, waiting_for_transit, …). |
| `environmentalContext` | comma-sep — `poor_lighting, isolated_area, …`. |
| `behaviorAffected` | boolean. |
| `behavioralAdaptations` | comma-sep — `avoid_route, avoid_nighttime, use_alternative_transport, …`. |
| `interventionPreferences` | comma-sep — `better_lighting, safer_crossing, security_presence, …`. |
| `repeatExposure` | `first_time|a_few_times|often|always|unknown`. |
| `socialContext` | `alone|with_one_other|with_group|with_children|with_dependents|other`. |
| `transitStopLit`, `transitWaitMinutes`, `transitOthersWaiting` | conditional, when `concernType=unsafe_transit_stop`. |
| `crossingSignal`, `crossingVehicleYielded` | conditional, when `concernType=unsafe_crossing_environment`. |
| `demographics` | JSON sub-document. |

All Module 3 v4.0 fields remain subject to the safeguarding invariants
(forced anonymity, PII screening, no images, k=10/500 m aggregation).

Behaviours:

- **PII detection middleware** (`piiDetection.js`) runs before storage. If
  PII is detected, returns 400 with `{ error: 'pii_detected', categories,
  preview, options }`. Resubmit with `confirmRedacted=true` to store the
  redacted version.
- **Forced anonymous.** `reporter=null, isAnonymous=true` regardless of
  authentication.
- **Images disabled** (by default). No multipart accepted.
- **Crisis-pattern detection.** The response includes
  `crisisSignposting: true` if the description contained any of the
  configured indicators, plus the support-services registry.

Response shape (201):

```json
{
  "id": "<ObjectId>",
  "module": "personal_safety",
  "acknowledged": true,
  "crisisSignposting": false,
  "supportServices": [ ... ],
  "privacyNote": "Your report is stored anonymously...",
  "piiRedactedApplied": false
}
```

The description is intentionally **not** echoed in the response.

### `POST /api/incidents` (legacy)

Dispatches to one of the three module endpoints based on the `module`
field in the body. Defaults to `accident_conflict`. Retained for older
clients.

### `DELETE /api/incidents/:id` (auth)

Owner-only deletion. Module 3 records cannot be deleted via API — use
`exportSuppressed` instead. Returns 403 with `error: 'module_3_immutable'`.

---

## Analytics

Module 1 + 2 analytics return raw aggregates. Module 3 analytics return
**only aggregated counts** and k-anonymised cell rows; raw points are
never returned.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/incidents/analytics/hotspots/kde` | KDE density (Modules 1+2). Wraps Python service. |
| GET | `/api/incidents/analytics/hotspots/getis-ord` | Getis-Ord Gi* (Modules 1+2). Wraps Python service. |
| GET | `/api/incidents/analytics/interactions` | Module 1: reporter × interacting × interaction-type matrices; infra-stratified counts. |
| GET | `/api/incidents/analytics/infrastructure-conditions` | Module 2: hazard-type distribution; feature×hazard cross-tab; monthly trend. |
| GET | `/api/incidents/analytics/personal-safety-context` | Module 3: temporal + context aggregates and k=10 cell counts. 403 if Module 3 disabled. |
| GET | `/api/incidents/analytics/pilot/:cohort?modules=1,2` | Pilot summary metrics. |
| GET | `/api/incidents/analytics/surrogate-safety` | **v4.0** Module 1: near-miss/forced-evasive/aggressive event aggregates with evasive-action, perceived-danger, repeat-exposure, and future-route impact. |
| GET | `/api/incidents/analytics/hazard-categories` | **v4.0** Module 2: hazardCategory × type × duration × visibility × affected-user-group cross-tabs; perceived severity by category; behaviour-affected rates. |
| GET | `/api/incidents/analytics/behavioral-adaptation` | **v4.0** Modules 2 + 3: behavioural-adaptation cascade. Module 3 aggregates are admin-only and k=10 suppressed. |
| GET | `/api/incidents/analytics/demographics` | **v4.0** Cross-module demographic stratification (age × module × reporterMode). Module 3 excluded for non-admins. |

#### v4.0 analytics response shapes (abbreviated)

```jsonc
// /api/incidents/analytics/surrogate-safety
{
  "byIncidentType": [{ "_id": "near_miss", "count": 142 }, ...],
  "byNearMissType": [...],
  "byEvasiveAction": [...],
  "byPerceivedDanger": [{ "_id": 1, "count": 12 }, ..., { "_id": 5, "count": 31 }],
  "perceivedDangerByMode": [{ "_id": "cyclist", "mean": 3.6, "n": 78 }, ...],
  "futureRouteImpact": { "true": 64, "false": 21 },
  "repeatExposure": [...],
  "byHourReporterMode": [...]
}
```

```jsonc
// /api/incidents/analytics/hazard-categories
{
  "byCategory": [...],
  "byCategoryAndType": [...],
  "byDuration": [...],
  "byVisibilityCondition": [...],
  "byAffectedUserGroup": [...],
  "perceivedSeverityByCategory": [...],
  "behaviourAffectedRate": [
    { "hazardCategory": "cycling_micromobility", "rate": 0.71, "yes": 22, "no": 9, "n": 31 }
  ],
  "behavioralImpactTypes": [...]
}
```

```jsonc
// /api/incidents/analytics/behavioral-adaptation
{
  "module2": { "affected": { "yes": 41, "no": 12, "total": 53 }, "impacts": [...] },
  "module3": {
    // present only for admin requests; rows below k=10 are suppressed
    "affected": { "yes": 88, "no": 4, "total": 92 },
    "adaptations": [...],
    "adaptationsByActivity": [...],
    "interventionPreferences": [...],
    "repeatExposure": [...],
    "privacyManifest": { "k_applied": 10, "policy": "module_3_k_anonymity" }
  },
  "module3_access": "admin"
}
```

```jsonc
// /api/incidents/analytics/demographics
{
  "byAgeGroup": [...],
  "byGender": [...],
  "byModeUsage": [...],
  "ageByModule": [...],
  "ageByReporterMode": [...]
}
```

Aliases under `/api/analytics/...` delegate to the same handlers.

### Python analytics service

Internal. Receives only points / events; never sees full records.

| Method | Path | Body | Returns |
|--------|------|------|---------|
| POST | `/kde` | `{ points: [{lat,lng,weight}], bandwidth?, resolution_m? }` | GeoJSON FeatureCollection of density cells. |
| POST | `/getis-ord` | `{ points: [{lat,lng,weight,value}], distance_m? }` | Per-point GeoJSON with z-score, p-value, cluster class. |
| POST | `/temporal-pattern` | `{ events: [{timestamp,weight}], include_ci? }` | `{ by_hour, by_dow, metadata }`. Hour-of-day and day-of-week with 95% CIs. |
| GET | `/health` | — | `{ status: "ok" }` |

---

## Export

### `GET /api/incidents/export`

Query:

| Name | Default | Notes |
|------|---------|-------|
| `format` | `geojson` | `geojson` or `csv`. |
| `k` | 5 | Min 1 (Modules 1/2). Locked to ≥ 10 if `module=personal_safety`. |
| `cellSizeM` | 100 | Min 10 (Modules 1/2). Locked to ≥ 500 if `module=personal_safety`. |
| `temporal` | `day` | `day`, `week`, or `month`. |
| `module` | — | If unset, Module 3 is excluded by default. To export Module 3 specifically, pass `module=personal_safety` (server must have Module 3 enabled). |
| `from`, `to`, `mode`, `type` | — | Filters. |
| `incidentType`, `hazardType`, `hazardCategory`, `concernType` | — | Comma-separated module-specific filters. |
| `collisionType`, `nearMissType`, `mobilityActivity` | — | **v4.0** filters. |
| `behaviorAffected` | — | `true`/`false`. |
| `schemaVersion` | — | e.g. `4.0` for v4.0-only data. |
| `ageGroup`, `gender` | — | Demographic filters (apply only to records that carry the optional sub-doc). |
| `includeSynthetic` | `false` | If `true`, include `dataProvenance='synthetic_seed'` records. |

**v4.0 GeoJSON feature properties** (in addition to v3.0):
`n_by_collisionType`, `n_by_nearMissType`, `n_by_evasiveAction`,
`n_by_hazardCategory`, `n_by_hazardDuration`, `mean_perceivedDanger`,
`mean_perceivedHazardSeverity`. Emitted only when the underlying records
carry those fields. Module 3 exports never carry them.

Response includes a `privacyManifest`:

```json
{
  "module": "accident_conflict",
  "k_requested": 5, "k_applied": 5,
  "cellSizeM_requested": 100, "cellSizeM_applied": 100,
  "temporal_requested": "day", "temporal_applied": "day",
  "coercions": [],
  "strip_free_text": false,
  "n_input_records": 120, "n_input_groups": 84,
  "n_suppressed_groups": 41, "n_suppressed_records": 53,
  "n_retained_groups": 43, "n_retained_records": 67,
  "retention_fraction": 0.558333
}
```

For Module 3 exports, `coercions` reports any policy-driven adjustments
to the requested parameters.

CSV mode returns the manifest in the `X-Privacy-Manifest` response header.

---

## Infrastructure

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/infrastructure` | Filter by `bbox`, `near=lat,lng&radius`, `featureType`, `dataProvenance`. |
| POST | `/api/infrastructure` | User-reported feature. |
| GET | `/api/infrastructure/:id` | |
| PATCH | `/api/infrastructure/:id` | Verifies feature; appends `verifiedBy`. |

---

## Rate limiting

- Global: 200 requests / 15 min per IP.
- Incident creation (all modules): 30 / hour per IP.
- Module 3 creation: additional 10 / hour per IP.

---

## Error codes (Module 3 specific)

| Error code | HTTP | Meaning |
|------------|------|---------|
| `module_3_disabled` | 403 | Server flag off; flip after the deployment checklist is complete. |
| `module_3_raw_access_denied` | 403 | Tried to read raw Module 3 record without admin role. |
| `module_3_immutable` | 403 | DELETE attempted on Module 3 record. |
| `pii_detected` | 400 | PII spans found in description; preview returned; client may resubmit with `confirmRedacted=true`. |

---

## PedestrianPath additions — routing & walkability

The unified platform adds a route planner and walkability engine on top of the
reporting API above. These endpoints are also aliased under `/api/v4/*`.

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/routes/plan` | Multi-objective pedestrian route optimisation |
| `GET`  | `/api/routes/profiles` | List available routing objectives |
| `GET`  | `/api/walkability/weights` | Indicator weights + colour scale |
| `POST` | `/api/walkability/score` | Score a segment from OSM tags or indicators |
| `GET`  | `/api/walkability/heatmap` | Walkability heatmap (GeoJSON FeatureCollection) |

Full request/response shapes, the routing cost model, and offline usage are
documented in [`ROUTING.md`](ROUTING.md).
