# Reporting Workflows v4.0

This document is the canonical specification for the redesigned participatory
urban-mobility reporting workflows. It supersedes the v3.0 form structure
documented in `docs/taxonomy.md` (which is retained for historical decoding of
older records).

The v4.0 design aim is a **research-grade participatory urban mobility sensing
framework** — not a municipal complaint application. Every question doubles
as a research variable; every workflow path is reproducible from the JSON
schema; every Module 3 safeguarding invariant from `MODULE_3_DESIGN.md` is
preserved.

---

## 1. Modules

| Module key                 | Workflow name                                         |
|----------------------------|-------------------------------------------------------|
| `accident_conflict`        | Mobility Conflict & Surrogate Safety Reporting        |
| `hazard_infrastructure`    | Mobility-Relevant Hazard Reporting                    |
| `personal_safety`          | Perceived Urban Safety & Mobility Deterrence          |

All three modules share:

- a **reporter context** step (multimodal — pedestrian → wheelchair → observer)
- an **environmental context** step (weather / lighting / road type)
- an optional shared **demographics** layer (Part 5 of the spec)
- a **map-first** location capture handled outside the form itself

---

## 2. Form engineering model

### 2.1 JSON-driven schema

The single source of truth for the question structure is
`client/src/utils/reportingSchema.js`. Each module is a `{steps:[{fields:[…]}]}`
tree. Fields support:

```
{
  name:            'concernType',                  // dotted path supported
  label:           'Type of safety concern',
  type:            'select' | 'radio' | 'multiselect' | 'scale'
                 | 'boolean' | 'text'  | 'textarea' | 'datetime'
                 | 'image'  | 'video' | 'modeList',
  required:        false,
  optional:        false,
  default:         undefined,
  options:         [{ value, label, emoji? }],     // static
  dynamicOptions:  (form) => [...],                // re-evaluated each render
  condition:       (form) => boolean,              // progressive disclosure
  analytics:       { variable, scale, ontology },  // exposed to the pipeline
  piiScreen:       true,                           // soft inline PII warning
  for:             ['pedestrian','cyclist','…']    // reporter-mode filter
}
```

The renderer (`client/src/components/DynamicReportForm.jsx`) reads this schema
and:

1. Filters **steps** by `step.condition(form)` ⇒ branching workflows.
2. Filters **fields** by `field.condition(form)` ⇒ progressive disclosure.
3. Evaluates `field.dynamicOptions(form)` for cascading selects
   (e.g. hazard subtype list depends on hazard category).
4. Validates only the `required` fields visible in the current step before
   advancing.
5. Inserts a one-tap progress bar.
6. Routes the final state object to a module-specific `onSubmit` callback.

The renderer is **API-unaware** — module wrappers (`Module1Form`,
`Module2Form`, `Module3Form`) serialise the state into the existing endpoints.

### 2.2 Conditional workflow mapping

Each module's branching tree, derived directly from the schema:

#### Module 1 — Mobility Conflict

```
reporter_context  ──►  incident_type  ──►  ⟨one of:⟩
  ├── collision               → collision_details   → environment → when_and_what → demographics?
  ├── near_miss               → near_miss_details   → environment → when_and_what → demographics?
  ├── solo_fall               → solo_fall_details   → environment → when_and_what → demographics?
  ├── forced_evasive          ┐
  ├── aggressive_interaction  ┼─► evasive_aggressive_details → environment → when_and_what → demographics?
  └── mode_conflict           ┘
```

#### Module 2 — Hazard & Infrastructure

```
reporter_context  ──►  hazard_classification (category + dynamic subtype)
                 ──►  hazard_context (severity, affected groups, duration, visibility)
                 ──►  environment_context
                 ──►  behavioral_impact (boolean → multiselect)
                 ──►  media_evidence
                 ──►  demographics?
```

#### Module 3 — Perceived Urban Safety

```
mobility_context ──► concern_type ──► ⟨branch by concernType:⟩
  ├── unsafe_transit_stop                     → transit_environment
  ├── harassment | verbal_abuse | aggressive_behavior
  │     | unsafe_group_presence | drunk_disorderly → harassment_context (env)
  ├── unsafe_crossing_environment             → crossing_context
  └── ⟨everything else⟩                       → environment_universal
↓
temporal_perceived → behavioral_adaptation → intervention_preferences
→ optional_context → consent → demographics?
```

### 2.3 Mobile-first UX

- Every option is a min 44 × 44 px tap target (see `.factor-chip` mobile rule
  in `client/src/index.css`).
- One step per modal screen, with progress bar.
- `<input type="file" capture="environment">` on image/video fields →
  invokes the OS camera on Android/iOS in one tap.
- Map-first reporting: location is already captured before the modal opens
  (existing `MapView` behaviour, unchanged).
- All steps after the required ones are `collapsible: true` or behind a
  branch — fatigue is bounded by relevance, not by total field count.

---

## 3. Analytics-ready data structure

The new fields persist alongside the v3.0 schema in the same `Incident`
collection. Each Mongoose field has a one-to-one mapping to a research
variable. See `server/models/Incident.js` for the authoritative enum list.

### 3.1 Variable dictionary

| Field                              | Module(s) | Scale            | Analytic use                                   |
|------------------------------------|-----------|------------------|------------------------------------------------|
| `reporterMode`                     | 1, 2, 3   | nominal          | Multimodal exposure, mode-conditional risk     |
| `incidentType`                     | 1         | nominal          | Surrogate safety event taxonomy                |
| `collisionType`                    | 1         | nominal          | Surrogate-safety conflict typing               |
| `nearMissType`                     | 1         | nominal          | Near-miss subtype frequency analysis           |
| `evasiveAction`                    | 1         | nominal          | Behavioural adaptation, severity proxy         |
| `soloFallContributors[]`           | 1         | multi-nominal    | Surface-risk attribution                       |
| `perceivedDangerScale`             | 1         | likert-5         | Subjective severity, perceived-risk modelling  |
| `affectsFutureRoute`               | 1         | boolean          | Route avoidance / behavioural adaptation       |
| `repeatLocationHistory`            | 1, 3      | ordinal          | Repeat-exposure / hotspot validation           |
| `interactingModes[]`               | 1         | multi-nominal    | Multi-party interaction analytics              |
| `hazardCategory` / `hazardType`    | 2         | nominal          | Hazard taxonomy, infrastructure-risk coupling  |
| `hazardSeverityPerceived`          | 2         | likert-5         | Subjective severity                            |
| `hazardDuration`                   | 2         | ordinal          | Chronic-vs-acute hazard analysis               |
| `hazardVisibilityConditions[]`     | 2         | multi-nominal    | Risk-condition coupling                        |
| `affectedUserGroups[]`             | 2         | multi-nominal    | Modal equity of infrastructure risk            |
| `behaviorAffected`                 | 2, 3      | boolean          | Mobility deterrence flag                       |
| `behavioralImpactTypes[]`          | 2         | multi-nominal    | Behavioural adaptation taxonomy                |
| `concernType`                      | 3         | nominal          | Perceived safety typology                      |
| `mobilityActivity`                 | 3         | nominal          | Mobility-centred (not crime-centred) framing   |
| `environmentalContext[]`           | 3         | multi-nominal    | Environmental criminology / CPTED proxies      |
| `perceivedRiskLevel`               | 3         | likert-5         | Perceived safety modelling                     |
| `behavioralAdaptations[]`          | 3         | multi-nominal    | Behavioural adaptation analysis                |
| `interventionPreferences[]`        | 3         | multi-nominal    | Community priorities, intervention demand      |
| `repeatExposure`                   | 3         | ordinal          | Chronic-exposure analysis                      |
| `socialContext`                    | 3         | nominal          | Vulnerability stratification                   |
| `timeOfDayContext`                 | 3         | ordinal          | Temporal hotspot analysis                      |
| `location.coordinates`             | all       | spatial          | KDE / Getis-Ord hotspots, GIScience            |
| `demographics.ageGroup`            | all       | ordinal          | Equity stratification                          |
| `demographics.gender`              | all       | nominal          | Equity stratification                          |
| `demographics.modeUsageFrequency`  | all       | ordinal          | Exposure normalisation                         |

### 3.2 Downstream analyses supported

- **Urban analytics**: hotspot detection (KDE, Getis-Ord) on `location` keyed
  by `module × reporterMode × hazardCategory`.
- **GIScience**: every record carries a `2dsphere`-indexed point, plus
  contextual road / crossing typing.
- **Transportation analysis**: `interactingModes × collisionType ×
  roadType × weather` cross-tabulation is now first-class.
- **Surrogate safety**: `incidentType ∈ {near_miss, forced_evasive,
  aggressive_interaction}` plus `evasiveAction` enables event-based SSAM
  proxies without requiring video conflict observation.
- **Perceived safety modelling**: ordinal `perceivedRiskLevel` paired with
  `environmentalContext[]` and `lightingCondition` is directly usable for
  ordinal logistic regression / ML models.
- **Behavioural adaptation analysis**: `behaviorAffected → behavioralAdaptations`
  cascade in Module 3 (and `behavioralImpactTypes` in Module 2) supports
  mobility-deterrence research without requiring linked panel data.

---

## 4. Validation logic

Server-side validation lives in `server/routes/incidents.js`. Enum values are
the sole source of truth — there are no parallel allow-lists. The new
`listIn(field, allowed)` helper validates comma-separated **and** array
multi-value inputs.

Privacy and safeguarding rules from `MODULE_3_DESIGN.md` are unchanged:

- Module 3 free text passes through `piiDetection.js` → optional redaction.
- Module 3 records are forced `isAnonymous: true`, `reporter: null`,
  `imageUrl/videoUrl: undefined` in the pre-save hook.
- Module 3 reads are k-anonymised (`MODULE_3_MIN_K = 10`) and spatially
  aggregated to ≥ 500 m cells.

The 21 existing safeguard tests (`server/test/safeguards.test.js`) continue
to pass.

---

## 5. Backwards compatibility

- Every v3.0 enum value is retained (the legacy reporter set is the first 4
  values; new modes are appended).
- v3.0 hazard / concern types remain in the `M2_HAZARD_TYPES` /
  `M3_CONCERN_TYPES` enums so old records still parse.
- `M1_INCIDENT_TYPES` adds `forced_evasive`, `aggressive_interaction`,
  `other` and retains `mode_conflict`.
- Map and detail rendering use the existing `recordPrimaryLabel` /
  `recordPrimaryColor` helpers, which transparently extend to the new
  taxonomies.
- A new `schemaVersion: '4.0'` field stamps every new record so downstream
  pipelines can opt into the richer ontology incrementally.

---

## 6. Frontend implementation map

| File                                                | Purpose                                                          |
|-----------------------------------------------------|------------------------------------------------------------------|
| `client/src/utils/incidentTypes.js`                 | Expanded enums + labels + colours (single source of truth)       |
| `client/src/utils/reportingSchema.js`               | JSON-driven form schema for all three modules                    |
| `client/src/components/DynamicReportForm.jsx`       | Schema renderer with conditional / progressive / multimodal UX   |
| `client/src/components/Module1Form.jsx`             | Thin wrapper → multipart payload for `/accident-conflict`        |
| `client/src/components/Module2Form.jsx`             | Thin wrapper → multipart payload for `/hazard-infrastructure`    |
| `client/src/components/Module3Form.jsx`             | Wrapper + safeguarding chrome (anon banner, quick exit, PII)     |

## 7. Backend implementation map

| File                                                | Purpose                                                          |
|-----------------------------------------------------|------------------------------------------------------------------|
| `server/models/Incident.js`                         | v4.0 schema (enums, demographics sub-doc, schemaVersion)         |
| `server/routes/incidents.js`                        | Per-module validator chains incl. multi-value `listIn` helper    |
| `server/controllers/incidentController.js`          | Persists v4.0 fields, parses demographics JSON, tri-state bools  |
| `server/middleware/piiDetection.js` *(unchanged)*   | Module 3 PII redaction round-trip                                |
| `server/services/privacy.js` *(unchanged)*          | Module 3 k-anonymity + spatial aggregation                       |

---

## 8. Worked JSON payload examples

### Module 1 — Near miss between a cyclist and a car (left hook)

```json
{
  "module": "accident_conflict",
  "reporterMode": "cyclist",
  "incidentType": "near_miss",
  "nearMissType": "left_hook",
  "interactingModes": ["car_driver"],
  "evasiveAction": "hard_braking",
  "perceivedDangerScale": 4,
  "affectsFutureRoute": true,
  "repeatLocationHistory": "a_few_times",
  "severity": "moderate",
  "weather": "clear",
  "lightingCondition": "daylight",
  "roadType": "arterial",
  "infrastructureContributingFactors": ["obstructed_view", "unsafe_geometry"],
  "incidentDate": "2026-05-17T18:42:00.000Z",
  "location": { "type": "Point", "coordinates": [77.5946, 12.9716] }
}
```

### Module 2 — Cycling-category hazard with behavioural impact

```json
{
  "module": "hazard_infrastructure",
  "reporterMode": "cyclist",
  "hazardCategory": "cycling_micromobility",
  "hazardType": "bike_lane_obstruction",
  "hazardSeverityPerceived": 5,
  "hazardDuration": "months",
  "hazardVisibilityConditions": ["always_visible"],
  "affectedUserGroups": ["cyclist", "ebike_scooter"],
  "behaviorAffected": true,
  "behavioralImpactTypes": ["near_misses", "route_avoidance"],
  "severity": "major",
  "weather": "clear",
  "lightingCondition": "daylight",
  "roadType": "bike_lane"
}
```

### Module 3 — Perceived-unsafety at a poorly-lit transit stop

```json
{
  "module": "personal_safety",
  "mobilityActivity": "waiting_for_transit",
  "concernType": "unsafe_transit_stop",
  "transitStopLit": false,
  "transitWaitMinutes": 20,
  "transitOthersWaiting": "empty",
  "environmentalContext": ["poor_lighting", "isolated_area"],
  "timeOfDayContext": "late_night",
  "perceivedRiskLevel": 5,
  "crowdLevel": "empty",
  "lightingCondition": "dark_unlit",
  "behaviorAffected": true,
  "behavioralAdaptations": ["avoid_nighttime", "use_alternative_transport"],
  "interventionPreferences": ["better_lighting", "security_presence"],
  "repeatExposure": "often",
  "socialContext": "alone",
  "consentForResearch": true,
  "exportSuppressed": false
}
```

---

## 9. Recommended next steps

1. Run `server/scripts/migrate-to-v3-modules.js`-equivalent for v4.0 only if
   you intend to backfill `schemaVersion` on historical records (optional —
   pipelines should treat the absence of `schemaVersion` as `<= 3.0`).
2. Update `analytics/` notebooks to opt into the new variables via
   `schemaVersion >= '4.0'` filters.
3. Extend `Sidebar.jsx` filter UI to expose `hazardCategory` and
   `mobilityActivity` facets (the underlying data is already there).
4. When activating Module 3 in a new deployment, follow
   `docs/MODULE_3_DEPLOYMENT_CHECKLIST.md` unchanged — the v4.0 redesign
   does **not** weaken any safeguarding invariant.
