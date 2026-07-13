/**
 * One-shot migration: assign every existing Incident document the v3.0
 * `module` discriminator and the matching per-module fields. Idempotent.
 *
 * Mapping (see docs/taxonomy.md §16 and docs/MIGRATION.md):
 *
 *   legacy type            -> module                  + per-module field(s)
 *   --------------------------------------------------------------------
 *   collision              -> accident_conflict       incidentType=collision
 *   near_miss              -> accident_conflict       incidentType=near_miss
 *   vehicle_conflict       -> accident_conflict       incidentType=mode_conflict
 *   unsafe_crossing        -> hazard_infrastructure   hazardType=unsafe_crossing
 *   poor_lighting          -> hazard_infrastructure   hazardType=poor_lighting
 *   footpath_obstruction   -> hazard_infrastructure   hazardType=blocked_path
 *   road_surface           -> hazard_infrastructure   hazardType=pothole
 *   speeding_vehicles      -> hazard_infrastructure   hazardType=unsafe_geometry
 *   accessibility_issue    -> hazard_infrastructure   hazardType=damaged_sidewalk
 *   hazard                 -> hazard_infrastructure   hazardType=unsafe_geometry (default)
 *   harassment             -> personal_safety         concernType=harassment
 *   theft                  -> personal_safety         concernType=theft
 *
 *   Legacy `mobilityMode` is folded into the reporter-mode four-set:
 *     wheelchair, runner -> pedestrian (+ accessibilityNeeds on user)
 *     escooter           -> other
 *
 * Run:
 *   node server/scripts/migrate-to-v3-modules.js
 *   node server/scripts/migrate-to-v3-modules.js --dry-run
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Incident = require('../models/Incident');

const TYPE_TO_MODULE = {
  collision: { module: 'accident_conflict', incidentType: 'collision' },
  near_miss: { module: 'accident_conflict', incidentType: 'near_miss' },
  vehicle_conflict: { module: 'accident_conflict', incidentType: 'mode_conflict' },
  unsafe_crossing: { module: 'hazard_infrastructure', hazardType: 'unsafe_crossing' },
  poor_lighting: { module: 'hazard_infrastructure', hazardType: 'poor_lighting' },
  footpath_obstruction: { module: 'hazard_infrastructure', hazardType: 'blocked_path' },
  road_surface: { module: 'hazard_infrastructure', hazardType: 'pothole' },
  speeding_vehicles: { module: 'hazard_infrastructure', hazardType: 'unsafe_geometry' },
  accessibility_issue: { module: 'hazard_infrastructure', hazardType: 'damaged_sidewalk' },
  hazard: { module: 'hazard_infrastructure', hazardType: 'unsafe_geometry' },
  harassment: { module: 'personal_safety', concernType: 'harassment' },
  theft: { module: 'personal_safety', concernType: 'theft' },
};

const MODE_FOLD = {
  pedestrian: 'pedestrian',
  cyclist: 'cyclist',
  two_wheeler: 'two_wheeler',
  wheelchair: 'pedestrian',
  runner: 'pedestrian',
  escooter: 'other',
  other: 'other',
};

function inferReporterMode(doc) {
  const m = doc.mobilityMode || doc.reporterMode;
  if (!m) return 'pedestrian';
  return MODE_FOLD[m] || 'other';
}

async function run({ dryRun }) {
  await connectDB();

  const total = await Incident.countDocuments();
  const needs = await Incident.countDocuments({ module: { $exists: false } });
  console.log(`Incidents: ${total} total, ${needs} need module assignment.`);

  const cursor = Incident.find({ module: { $exists: false } }).cursor();
  let migrated = 0;
  let skipped = 0;

  for (let doc = await cursor.next(); doc; doc = await cursor.next()) {
    const legacy = doc.type;
    const mapping = TYPE_TO_MODULE[legacy];

    if (!mapping) {
      skipped += 1;
      console.warn(`Skipping ${doc._id}: unknown legacy type "${legacy}"`);
      continue;
    }

    doc.module = mapping.module;
    if (mapping.incidentType) doc.incidentType = mapping.incidentType;
    if (mapping.hazardType) doc.hazardType = mapping.hazardType;
    if (mapping.concernType) doc.concernType = mapping.concernType;

    // Reporter mode fold-down (Module 1 only)
    if (mapping.module === 'accident_conflict') {
      doc.reporterMode = inferReporterMode(doc);
      // Sensible interaction defaults when legacy data carries nothing.
      if (!doc.interactingMode) {
        doc.interactingMode = mapping.incidentType === 'solo_fall' ? 'none' : 'car';
      }
      if (!doc.interactionType) doc.interactionType = 'none';
    }

    // Module 3 safeguarding — strip any image and force-anonymous, even
    // for migrated rows. The pre-save hook will also handle this but we
    // log it explicitly for the migration report.
    if (mapping.module === 'personal_safety') {
      doc.reporter = null;
      doc.isAnonymous = true;
      doc.imageUrl = undefined;
      doc.thumbnailUrl = undefined;
    }

    if (!dryRun) {
      await doc.save();
    }
    migrated += 1;
    if (migrated % 100 === 0) console.log(`  migrated ${migrated}…`);
  }

  console.log(`Done. migrated=${migrated} skipped=${skipped} dryRun=${!!dryRun}`);
  await mongoose.connection.close();
  process.exit(0);
}

const dryRun = process.argv.includes('--dry-run');
run({ dryRun }).catch((err) => {
  console.error(err);
  process.exit(1);
});
