# PathGuard Taxonomy (v3.0)

Canonical reference for every enum used by the platform. Every value lists a
one-sentence definition, a one-sentence justification, a citation hook, and —
where applicable — the OpenStreetMap tag(s) it maps to.

PathGuard v3.0 separates reports into three **modules**:

- **Module 1 — Accident & Conflict Reporting.** Interaction-centric. Models
  incidents as interactions between mobility modes.
- **Module 2 — Hazard & Infrastructure Condition Reporting.** Infrastructure-
  linked reports about the built environment (potholes, lighting, flooding,
  etc.).
- **Module 3 — Personal Safety Reporting.** Reports about harassment, unsafe
  behaviour, threatening environments. Treated with an elevated privacy and
  safeguarding posture; see `docs/MODULE_3_DESIGN.md`.

The discriminator field is `Incident.module` with values
`accident_conflict | hazard_infrastructure | personal_safety`.

---

## 1. Reporter modes (`Incident.reporterMode`, `User.mobilityMode`)

Reporter modes are the **vulnerable road user** categories that PathGuard
collects reports from. Cars, buses, trucks, and auto-rickshaws are *not*
reporter modes — they only appear as `interactingMode` in Module 1.

| Value         | Definition                                                    | Justification                                                                                       | Citation hook |
|---------------|---------------------------------------------------------------|-----------------------------------------------------------------------------------------------------|---------------|
| `pedestrian`  | Person travelling on foot (incl. wheelchair, mobility aid).   | Largest VRU group in fatality statistics worldwide.                                                  | Retting et al. (2003); WHO Global Status Report on Road Safety |
| `cyclist`     | Person travelling by bicycle (any human-powered two-wheeler). | Densest VRU literature; baseline mode for comparison.                                                | Aldred (2016); Schepers et al. (2014); BikeMaps.org |
| `two_wheeler` | Person on a motorcycle / scooter / moped.                     | In LMIC / South-Asian contexts two-wheeler riders face crash risk and vulnerability comparable to cyclists; under-served by VRU literature that has focused on HIC bicycle commuting. | Mohan & Tiwari (2007); Mohan et al. (2017) on Indian road safety; WHO Global Status Report on Road Safety (two-wheeler chapters) |
| `other`       | Any other non-/micro-/light-motorised user.                   | Catch-all for skateboards, kick-scooters, e-scooters, hand-cycles, mobility scooters etc.            | — |

**Note on `two_wheeler`.** Including motorised two-wheelers as a *reporter*
mode is a deliberate departure from HIC VRU frameworks. Indian road-safety
data shows motorised two-wheeler riders account for a disproportionate share
of road fatalities and bear vulnerability characteristics (lack of crash
protection, exposure on mixed roads) closer to cyclists than to car
occupants. The four-mode list — `pedestrian, cyclist, two_wheeler, other` —
is the **closed set**; cars, buses, trucks, and auto-rickshaws are only
selectable as `interactingMode`.

---

## 2. Interacting modes (`Incident.interactingMode`) — Module 1 only

The party the reporter interacted with. Module 1 incidents are
*interactions between modes*; this is the field that captures the other
mode.

| Value           | Definition                                              |
|-----------------|---------------------------------------------------------|
| `pedestrian`    | The other party was a pedestrian.                       |
| `cyclist`       | The other party was on a bicycle.                       |
| `two_wheeler`   | The other party was on a motorcycle / scooter / moped.  |
| `other`         | The other party was a non-motorised/micro-mobility user.|
| `car`           | The other party was in a private car.                   |
| `bus`           | The other party was a bus.                              |
| `truck`         | The other party was a truck / heavy-goods vehicle.      |
| `auto_rickshaw` | The other party was an auto-rickshaw / tuk-tuk.         |
| `none`          | Solo incident (e.g. fall on surface), no other party.    |

---

## 3. Interaction types (`Incident.interactionType`) — Module 1 only

The manoeuvre / dynamic of the interaction. Replaces the older
`roadInteraction` field for Module 1 and aligns with crash pre-collision
manoeuvre coding in mainstream crash datasets.

| Value                | Definition                                                    | Citation hook |
|----------------------|---------------------------------------------------------------|---------------|
| `overtaking`         | One party was overtaking the other.                           | Walker (2007) close-pass studies |
| `turning_conflict`   | One party turned across the other's path.                     | AASHTO HSM; FARS pre-crash manoeuvre |
| `crossing_conflict`  | One party was crossing the other's line of travel.            | Zegeer & Bushell (2012) |
| `right_of_way`       | Right-of-way was not yielded as required.                     | UK STATS19 "failed to give way" |
| `dooring`            | A door was opened into the reporter's path.                   | Stinson & Cherry (2018) |
| `head_on`            | The two parties collided/were on a head-on trajectory.        | FARS crash type |
| `rear_end`           | One party struck the other from behind.                       | FARS crash type |
| `merging`            | One party merged into the other's lane/space.                 | Crash pre-crash manoeuvre |
| `none`               | Solo incident (e.g. surface fall) or interaction not categorised. | — |

---

## 4. Module 1 incident types (`Incident.incidentType` when `module='accident_conflict'`)

The outcome category for a Module 1 report.

| Value           | Definition                                                          | Citation hook |
|-----------------|---------------------------------------------------------------------|---------------|
| `collision`     | Physical contact occurred.                                          | AASHTO HSM; Mannering & Bhat (2014) |
| `near_miss`     | An interaction that would have been a collision had one party not evaded. Leading indicators outnumber crashes 10–100×. | Aldred & Goodman (2018); Wang et al. (2019) |
| `solo_fall`     | Single-VRU fall with no other party involved (surface, balance, deflection). | Schepers et al. (2014) on single-bicycle crashes |
| `mode_conflict` | Sub-collision conflict between modes (close pass, cut-off, etc.) that doesn't fit the other three. | Walker (2007) |

---

## 5. Module 2 hazard types (`Incident.hazardType` when `module='hazard_infrastructure'`)

Built-environment conditions that VRUs report.

| Value                    | Definition                                                                                | Citation hook |
|--------------------------|-------------------------------------------------------------------------------------------|---------------|
| `pothole`                | Discrete surface defect deep enough to deflect a wheel or trip a foot.                   | Schepers et al. (2014); Indian Roads Congress condition surveys |
| `damaged_sidewalk`       | Cracked, broken, uplifted, or missing footpath surface.                                   | Patel et al. (2022) Indian footpath audits |
| `blocked_path`           | Path blocked by parked vehicles, vendors, debris, or construction.                        | Patel et al. (2022) |
| `flooding`               | Standing water blocking or making unsafe the footway / cycleway.                          | Patel et al. (2022); LMIC monsoon studies |
| `poor_lighting`          | Ambient lighting inadequate or non-functional after dark.                                 | Beyer & Ker (2009) Cochrane review |
| `faded_markings`         | Road / lane / crossing markings worn to the point of being unclear.                       | FHWA Pavement Marking Handbook |
| `construction_hazard`    | Construction site creates hazard for the VRU (no walkway, exposed reinforcement, etc.).   | OSHA / IRC construction zone guidance |
| `unsafe_crossing`        | Designed crossing exists but is unsafe in operation (timing, geometry, visibility).       | Zegeer & Bushell (2012) |
| `missing_crossing`       | No formal crossing exists where one is needed; VRUs cross informally.                     | Zegeer & Bushell (2012) |
| `poor_drainage`          | Drainage causes pooling, slick surface, or grate hazards.                                 | IRC drainage standards |
| `visibility_problem`     | Vegetation, parking, or geometry blocks sightlines.                                       | AASHTO sight-distance literature |
| `unsafe_geometry`        | Path / junction geometry is inherently unsafe.                                            | AASHTO HSM |
| `temporary_obstruction`  | Short-lived blockage (vendor, parked car, debris).                                        | — |

---

## 6. Module 3 personal-safety concern types (`Incident.concernType` when `module='personal_safety'`)

Every Module 3 category requires elevated safeguarding. See
`docs/MODULE_3_DESIGN.md` for the full protocol.

| Value                      | Definition                                                                                              | Sensitivity note                                                                                                                       |
|----------------------------|---------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------|
| `harassment`               | Verbal, gestural, or physical harassment directed at the reporter or another VRU.                       | Reports may name perpetrators or describe identifying contexts; PII screening required, no images, anonymous-by-rule.                  |
| `verbal_abuse`             | Verbal abuse or threats not rising to harassment (e.g. shouted slurs).                                  | Similar PII risk as harassment; narrative may be retaliatory if attributable.                                                          |
| `unsafe_behaviour`         | Aggressive driving / cycling, dangerous overtaking, behaviour that creates fear (not a crash).          | May identify a specific vehicle / rider; PII risk for both reporter and observed party.                                                |
| `theft`                    | Theft, attempted theft, snatch theft, or robbery experienced by the VRU.                                | Crime category; reporters in distress may include identifying details about themselves or perpetrators.                                |
| `stalking`                 | Being followed, repeated unwanted contact, or persistent surveillance.                                  | High-risk category — likely indicator of ongoing danger. Triggers crisis-pattern screening (see MODULE_3_DESIGN §4).                  |
| `threatening_environment`  | Location feels unsafe due to people / activity present (group behaviour, intimidation).                 | Risk of stigmatising areas and the people who live or work in them. Spatial output strictly aggregated.                                |
| `unsafe_route_experience`  | A route as a whole felt unsafe (combination of factors) — most diffuse Module 3 category.               | Useful for participatory mapping; same safeguards apply.                                                                                |

**No more granular categories will be added without participatory-design
input from women's-safety and feminist-HCI researchers** (see Task Group F3).

---

## 7. Severity (`Incident.severity`)

Used by all three modules. Severity describes the **outcome / impact**, not
the physical force of the event. Vision-Zero aligned.

| Value      | Definition                                                                | Citation hook |
|------------|---------------------------------------------------------------------------|---------------|
| `minor`    | No injury, or first-aid-only; the VRU continued the trip.                 | UK STATS19 "slight" |
| `moderate` | Treatment required but no admission; recovery within days.                | UK STATS19 lower band |
| `major`    | Hospital admission or lasting impairment.                                  | UK STATS19 "serious"; AIS 3+ |
| `fatal`    | Death of the VRU.                                                          | KSI; ISO 39001 |

For Module 2, `severity` indicates how dangerous the hazard is judged to be
(minor inconvenience → fatal trap). For Module 3, the analogue is
`perceivedRiskLevel` (1–5), not severity.

---

## 8. Injury level (`Incident.injuryLevel`)

`none`, `minor`, `serious`, `severe`, `fatal`. Finer-grained than severity;
allows e.g. "moderate severity / no injury" (a serious near-miss).

---

## 9. Environmental context

### 9.1 Weather (`Incident.weather`)

`clear`, `rain`, `fog`, `snow`, `wind`, `storm`, `unknown`. WMO-aligned
simplified categories used in FARS / STATS19.

### 9.2 Lighting condition (`Incident.lightingCondition`)

`daylight`, `dusk`, `dawn`, `dark_lit`, `dark_unlit`, `unknown`. Mirrors FARS
lighting codes. Particularly important for Module 3 (`time × lighting`
patterns inform safe-route research).

### 9.3 Road type (`Incident.roadType`)

| PathGuard value     | OSM mapping                              |
|---------------------|------------------------------------------|
| `highway`           | `highway=motorway` / `trunk` / `primary` |
| `arterial`          | `highway=secondary`                       |
| `residential`       | `highway=residential` / `living_street`  |
| `shared_path`       | `highway=path` + `bicycle=designated` + `foot=designated` |
| `bike_lane`         | `cycleway=*` (any non-`no` value)         |
| `footpath`          | `highway=footway`                         |
| `pedestrian_zone`   | `highway=pedestrian`                      |
| `intersection`      | (no direct OSM tag; junction proximity)   |
| `roundabout`        | `junction=roundabout`                     |
| `unknown`           | —                                         |

### 9.4 Crossing type (`Incident.crossingType`)

| Value             | OSM mapping                                       |
|-------------------|---------------------------------------------------|
| `none`            | No crossing nearby                                |
| `zebra`           | `crossing=marked` + `crossing:markings=zebra`     |
| `signalized`      | `crossing=traffic_signals`                        |
| `pelican`         | `crossing=traffic_signals` + button-actuated      |
| `overpass`        | `bridge=yes` + `highway=footway`                  |
| `underpass`       | `tunnel=yes` + `highway=footway`                  |
| `mid_block`       | Crossing not at intersection                      |
| `school_crossing` | `crossing=marked` + `school=yes` proximity        |
| `unmarked`        | `crossing=unmarked`                               |

---

## 10. Module 3 context fields

| Field                  | Values                                                            | Note |
|------------------------|-------------------------------------------------------------------|------|
| `timeOfDayContext`     | `morning`, `afternoon`, `evening`, `night`, `late_night`          | Coarse time bin; preserves utility while reducing pinpointing of incident times. |
| `crowdLevel`           | `empty`, `sparse`, `moderate`, `crowded`, `unknown`               | Density of other people present at the time of the experience. |
| `perceivedRiskLevel`   | 1–5 integer (1 lowest, 5 highest)                                 | Reporter's subjective risk. Replaces "severity" for Module 3. |

---

## 11. Infrastructure feature types (`Infrastructure.featureType`)

Built-environment features. Stored in a single collection alongside
OSM-imported features (`dataProvenance='osm_import'`).

| Value           | OSM tag(s)                                                            |
|-----------------|-----------------------------------------------------------------------|
| `sidewalk`      | `highway=footway` + `footway=sidewalk`                                |
| `crossing`      | `highway=crossing` or any node with `crossing=*`                      |
| `bike_lane`     | `cycleway=lane`/`track`/`opposite_lane`; or `highway=cycleway`        |
| `intersection`  | Node where two or more `highway=*` ways meet                          |
| `school_zone`   | `amenity=school` proximity area                                        |
| `bus_stop`      | `highway=bus_stop`                                                     |
| `shared_path`   | `highway=path` + `bicycle=designated` + `foot=designated`              |
| `other`         | —                                                                      |

### 11.1 Infrastructure quality attributes

| Field                  | Values                                                                       |
|------------------------|------------------------------------------------------------------------------|
| `sidewalkCondition`    | `good`, `fair`, `poor`, `absent`, `unknown`                                  |
| `crossingSafety`       | `safe`, `moderate`, `unsafe`, `dangerous`, `unknown`                         |
| `bikeLaneAvailability` | `protected`, `painted`, `shared`, `none`, `unknown`                          |
| `accessibilityBarrier` | `none`, `no_curb_ramp`, `narrow_path`, `steep_slope`, `broken_surface`, `obstruction`, `missing_tactile_paving`, `high_kerb` |
| `condition.rating`     | 0–5 numeric (0 worst, 5 best)                                                |

---

## 12. Infrastructure contributing factors (`Incident.infrastructureContributingFactors`)

Multi-select; observational, not causal. Applies to Modules 1 and 2.

| Value                    | Definition                                                                       |
|--------------------------|----------------------------------------------------------------------------------|
| `missing_signal`         | A signal that should be present is absent.                                       |
| `damaged_surface`        | Surface in disrepair (potholes, broken tiles).                                   |
| `obstructed_view`        | Sightlines blocked.                                                              |
| `inadequate_lighting`    | Location is dark or lighting is broken.                                          |
| `narrow_footpath`        | Footpath too narrow for users.                                                   |
| `no_curb_ramp`           | Required kerb ramp missing.                                                      |
| `surface_flooding`       | Surface floods.                                                                  |
| `missing_crossing`       | A crossing is needed but absent.                                                 |
| `unsafe_geometry`        | Junction / path geometry inherently unsafe.                                      |
| `temporary_obstruction`  | Short-lived blockage.                                                            |
| `poor_signage`           | Wayfinding / warning signage missing or ambiguous.                               |
| `other`                  | Any other infrastructure-related contributing factor.                            |

---

## 13. Reporter context (Modules 1 and 2)

`tripPurpose` ∈ `commute, school, leisure, errands, exercise, work_travel, other` — aligned with national travel surveys.

`speedCategory` ∈ `stationary, walking, jogging, cycling, fast`.

Pedestrian / crossing-specific (optional): `signalAvailable` (bool),
`waitingTimeSeconds` (0–600), `vehicleYielded` (bool),
`footpathWidthMeters` (0–50), `accessibilityRating` (1–5), `schoolZone` (bool),
`pedestrianDensity` ∈ `low, medium, high, unknown`.

---

## 14. Data provenance (`Incident.dataProvenance`, `Infrastructure.dataProvenance`)

Every record carries a provenance tag.

| Value             | Where it comes from                                                                  |
|-------------------|--------------------------------------------------------------------------------------|
| `synthetic_seed`  | Generated by `server/seed.js` for demo / development.                                |
| `pilot`           | Submitted during a named pilot deployment.                                            |
| `production`      | Submitted by a real user in a deployed instance (default).                            |
| `imported`        | Loaded from a third-party dataset (e.g. CSV from a council).                          |
| `osm_import`      | (Infrastructure only) Imported from OpenStreetMap.                                    |

Research exports default to filtering out `synthetic_seed`. Module 3 records
are *never* included in any export that does not honour the Module 3
deferred-publication policy (see `docs/MODULE_3_DESIGN.md` §6).

---

## 15. Privacy & export controls

| Field                | Type    | Notes                                                                       |
|----------------------|---------|-----------------------------------------------------------------------------|
| `consentForResearch` | bool    | Reporter consent for inclusion in research exports.                          |
| `exportSuppressed`   | bool    | Per-record opt-out — record will never appear in any export.                |
| `isAnonymous`        | bool    | Always `true` for Module 3 regardless of authentication.                     |

---

## 16. Deprecated values

| Field                | Value     | Status      | Migration                                                                                |
|----------------------|-----------|-------------|------------------------------------------------------------------------------------------|
| `Incident.type`      | `theft`   | **Moved**   | Migrated to `module='personal_safety'` with `concernType='theft'`.                       |
| `Incident.type`      | `hazard`  | **Moved**   | Migrated to `module='hazard_infrastructure'` with `hazardType` inferred or `unsafe_geometry` default. |
| `Incident.type` (legacy values like `unsafe_crossing`, `harassment`, `poor_lighting`, etc.) | various | **Replaced** | Mapped onto the per-module enums (`incidentType`, `hazardType`, `concernType`). See `docs/MIGRATION.md`. |
| `Incident.mobilityMode = wheelchair` | — | **Folded** | Becomes `reporterMode='pedestrian'` with `accessibilityNeeds` on the User. |
| `Incident.mobilityMode = runner`     | — | **Folded** | Becomes `reporterMode='pedestrian'`. |
| `Incident.mobilityMode = escooter`   | — | **Folded** | Becomes `reporterMode='other'`. |

---

## 17. Module discriminator

`Incident.module` is required on every Incident document.

| Value                    | Module |
|--------------------------|--------|
| `accident_conflict`      | Module 1 |
| `hazard_infrastructure`  | Module 2 |
| `personal_safety`        | Module 3 |
