/**
 * One-shot migration: stamp `schemaVersion` on every existing Incident
 * document so downstream pipelines can opt into v4.0 ontology without
 * misclassifying v3.0 records.
 *
 * Strategy (see docs/REPORTING_WORKFLOWS_V4.md §5):
 *
 *   - Records that already have v4.0-only fields populated
 *     (collisionType, nearMissType, hazardCategory, mobilityActivity,
 *     behavioralAdaptations, interventionPreferences, demographics) are
 *     stamped `schemaVersion = '4.0'`.
 *   - All other module-tagged records get `schemaVersion = '3.0'`.
 *   - Records that still lack a `module` should be passed through the
 *     v3.0 migration first (`migrate-to-v3-modules.js`).
 *
 * Idempotent: a record that already carries a schemaVersion is left
 * untouched unless `--force` is passed.
 *
 * Run:
 *   node server/scripts/migrate-to-v4-schema.js [--dry-run] [--force]
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Incident = require('../models/Incident');

const V4_FIELDS = [
  'collisionType',
  'nearMissType',
  'evasiveAction',
  'perceivedDangerScale',
  'hazardCategory',
  'hazardSeverityPerceived',
  'hazardDuration',
  'mobilityActivity',
  'environmentalContext',
  'behavioralAdaptations',
  'interventionPreferences',
  'repeatExposure',
  'socialContext',
  'demographics',
];

function isV4(doc) {
  for (const f of V4_FIELDS) {
    const v = doc[f];
    if (v === undefined || v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    return true;
  }
  return false;
}

async function run({ dryRun, force }) {
  await connectDB();

  const total = await Incident.countDocuments();
  const filter = force
    ? { module: { $exists: true } }
    : { module: { $exists: true }, schemaVersion: { $exists: false } };

  const needs = await Incident.countDocuments(filter);
  // eslint-disable-next-line no-console
  console.log(
    `Incidents: ${total} total, ${needs} need a schemaVersion stamp (force=${!!force}).`
  );

  const cursor = Incident.find(filter).cursor();
  let v4 = 0;
  let v3 = 0;
  for (let doc = await cursor.next(); doc; doc = await cursor.next()) {
    const target = isV4(doc) ? '4.0' : '3.0';
    if (doc.schemaVersion === target && !force) continue;
    doc.schemaVersion = target;
    if (!dryRun) {
      await doc.save();
    }
    if (target === '4.0') v4 += 1;
    else v3 += 1;
    if ((v4 + v3) % 250 === 0) {
      // eslint-disable-next-line no-console
      console.log(`  stamped ${v4 + v3}…`);
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Done. v4=${v4} v3=${v3} dryRun=${!!dryRun}`);
  await mongoose.connection.close();
  process.exit(0);
}

const dryRun = process.argv.includes('--dry-run');
const force = process.argv.includes('--force');
run({ dryRun, force }).catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
