# Seeding PathGuard

The seed script (`server/seed.js`) generates a synthetic, multi-modal
dataset of incidents and infrastructure features. Every seeded record is
tagged with `dataProvenance: 'synthetic_seed'` so research exports can
exclude it by default.

## Quick start

```bash
cd server
npm run seed
```

This loads ~120 incidents and 25 infrastructure features around Mumbai.

## Targeting a different city

The seeder accepts CLI arguments to relocate the synthetic data:

```bash
node seed.js --city kharagpur
node seed.js --city london --count 250
node seed.js --lat 52.5200 --lng 13.4050 --count 80
```

| Flag       | Default                       | Notes                                  |
|------------|-------------------------------|----------------------------------------|
| `--city`   | `mumbai`                      | One of the presets below. Ignored if `--lat`/`--lng` are given. |
| `--lat`    | (preset)                      | Decimal degrees, overrides `--city`.   |
| `--lng`    | (preset)                      | Decimal degrees, overrides `--city`.   |
| `--count`  | `120`                         | Number of incidents to generate.       |

City presets currently shipped: `mumbai`, `bengaluru`, `delhi`,
`kharagpur`, `london`, `amsterdam`. Add new presets in
`server/seed.js` if you deploy elsewhere.

## What gets seeded

1. **Infrastructure features (25)** — sidewalks, crossings, bike lanes,
   school zones, intersections, bus stops, each with a synthetic
   `condition.rating` and `dataProvenance: 'synthetic_seed'`.
2. **Incidents** — `--count` incidents (default 120), randomly placed
   within ~15 km of the city centre. About 40 % are linked to the
   nearest seeded infrastructure feature with a sampled
   `infrastructureContributingFactors` value.

The seed script runs the Incident pre-save hook so the derived fields
(`nearMissOnly`, `reportingLatencyMinutes`) are populated correctly.

## Removing seeded data

Seeded records can be wiped with:

```bash
mongo  # or mongosh
> use alertcycle
> db.incidents.deleteMany({ dataProvenance: 'synthetic_seed' })
> db.infrastructures.deleteMany({ dataProvenance: 'synthetic_seed' })
```

## Production deployments

Do **not** run `npm run seed` against a production database — it calls
`deleteMany({})` on both collections. Use the script only against
development and pilot databases.
