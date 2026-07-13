# Database migration: v1 → v2 (multi-modal)

AlertCycle v2 expands the cyclist-only schema into a multi-modal road safety
platform. All v1 documents remain readable; new fields are optional and have
sensible defaults so legacy reports continue to render.

## What changed

### `users`
| Field                  | Type      | Default        |
|------------------------|-----------|----------------|
| `mobilityMode`         | string    | `pedestrian`   |
| `preferredTravelMode`  | string    | `pedestrian`   |
| `accessibilityNeeds`   | string[]  | `[]`           |
| `consentForResearch`   | bool      | `false`        |
| `locale`               | string    | `en`           |

### `incidents`
| Field                  | Type     | Default       |
|------------------------|----------|---------------|
| `mobilityMode`         | string   | `cyclist`     |
| `tripPurpose`          | string   | —             |
| `speedCategory`        | string   | —             |
| `roadInteraction`      | string   | —             |
| `weather`              | string   | `unknown`     |
| `lightingCondition`    | string   | `unknown`     |
| `roadType`             | string   | `unknown`     |
| `crossingType`         | string   | —             |
| `signalAvailable`      | bool     | —             |
| `waitingTimeSeconds`   | number   | —             |
| `vehicleYielded`       | bool     | —             |
| `footpathWidthMeters`  | number   | —             |
| `accessibilityRating`  | number   | —             |
| `schoolZone`           | bool     | `false`       |
| `pedestrianDensity`    | string   | `unknown`     |
| `consentForResearch`   | bool     | `true`        |
| `riskScore`            | number   | `null`        |
| `injuryLevel`          | string   | `none`        |

The `severity` enum gains `fatal`. The `type` enum is extended with
`unsafe_crossing`, `vehicle_conflict`, `harassment`, `poor_lighting`,
`footpath_obstruction`, `road_surface`, `speeding_vehicles`,
`accessibility_issue`. Legacy values `hazard` and `theft` remain valid.

### New collection: `infrastructures`
Sidewalks, crossings, bike lanes, intersections, school zones with
condition / safety / accessibility ratings.

## One-shot backfill (optional)

If you want to set defaults explicitly on existing data, run:

```js
// mongo shell or a small node script
db.incidents.updateMany(
  { mobilityMode: { $exists: false } },
  { $set: { mobilityMode: 'cyclist', consentForResearch: true } }
);
db.users.updateMany(
  { mobilityMode: { $exists: false } },
  { $set: { mobilityMode: 'pedestrian', preferredTravelMode: 'pedestrian', accessibilityNeeds: [], consentForResearch: false } }
);
```

New compound indexes are created automatically on the next backend boot:
- `incidents { mobilityMode: 1, incidentDate: -1 }`
- `incidents { type: 1, incidentDate: -1 }`
