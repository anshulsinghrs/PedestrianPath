#!/usr/bin/env node
/**
 * OSM Infrastructure Auto-Import
 *
 * Fetches road infrastructure data from the Overpass API for a given bounding
 * box and upserts it into the Infrastructure collection. Designed to be run
 * as a one-off migration or scheduled cron job, NOT as a hot-path request.
 *
 * Usage:
 *   node scripts/import-osm-infrastructure.js \
 *     --bbox "12.8,77.4,13.2,77.8"            # Bengaluru example
 *     [--dry-run]
 *     [--limit 500]
 *
 * Environment: requires MONGODB_URI (same as the server).
 *
 * OSM feature types mapped:
 *   highway=crossing        → crossing
 *   highway=traffic_signals → traffic_signal
 *   highway=street_lamp     → street_lamp
 *   amenity=bus_stop        → transit_stop
 *   amenity=bicycle_parking → bike_parking
 *   highway=cycleway        → cycle_lane
 *   highway=footway         → footpath
 *   barrier=kerb            → kerb
 */

const https = require('https');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const FEATURE_MAP = {
  crossing: { highway: 'crossing' },
  traffic_signal: { highway: 'traffic_signals' },
  street_lamp: { highway: 'street_lamp' },
  transit_stop: { amenity: 'bus_stop' },
  bike_parking: { amenity: 'bicycle_parking' },
  cycle_lane: { highway: 'cycleway' },
  footpath: { highway: 'footway' },
  kerb: { barrier: 'kerb' },
};

function buildOverpassQuery(bbox) {
  const [south, west, north, east] = bbox.split(',').map(Number);
  const box = `${south},${west},${north},${east}`;

  const parts = [
    `node["highway"="crossing"](${box});`,
    `node["highway"="traffic_signals"](${box});`,
    `node["highway"="street_lamp"](${box});`,
    `node["amenity"="bus_stop"](${box});`,
    `node["amenity"="bicycle_parking"](${box});`,
    `way["highway"="cycleway"](${box});`,
    `way["highway"="footway"](${box});`,
    `node["barrier"="kerb"](${box});`,
  ];

  return `[out:json][timeout:60];\n(\n  ${parts.join('\n  ')}\n);\nout center;`;
}

function httpPost(url, data) {
  return new Promise((resolve, reject) => {
    const body = `data=${encodeURIComponent(data)}`;
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'PathGuard-OSM-Importer/1.0',
      },
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          reject(new Error(`Failed to parse Overpass response: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function osmTagsToFeatureType(tags) {
  if (!tags) return null;
  if (tags.highway === 'crossing') return 'crossing';
  if (tags.highway === 'traffic_signals') return 'traffic_signal';
  if (tags.highway === 'street_lamp') return 'street_lamp';
  if (tags.amenity === 'bus_stop') return 'transit_stop';
  if (tags.amenity === 'bicycle_parking') return 'bike_parking';
  if (tags.highway === 'cycleway') return 'cycle_lane';
  if (tags.highway === 'footway') return 'footpath';
  if (tags.barrier === 'kerb') return 'kerb';
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const bboxArg = args.find((a, i) => args[i - 1] === '--bbox') || args[1];
  const dryRun = args.includes('--dry-run');
  const limit = parseInt(args.find((a, i) => args[i - 1] === '--limit') || '1000', 10);

  if (!bboxArg) {
    console.error('Usage: node import-osm-infrastructure.js --bbox "south,west,north,east"');
    process.exit(1);
  }

  const parts = bboxArg.split(',').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) {
    console.error('--bbox must be four numbers: south,west,north,east');
    process.exit(1);
  }

  console.log(`Fetching OSM data for bbox: ${bboxArg}`);
  const query = buildOverpassQuery(bboxArg);

  let osmData;
  try {
    osmData = await httpPost('https://overpass-api.de/api/interpreter', query);
  } catch (err) {
    console.error('Overpass API error:', err.message);
    process.exit(1);
  }

  const elements = (osmData.elements || []).slice(0, limit);
  console.log(`Received ${elements.length} OSM elements`);

  if (dryRun) {
    const sample = elements.slice(0, 5);
    console.log('Dry run — sample elements:');
    console.log(JSON.stringify(sample, null, 2));
    process.exit(0);
  }

  const mongoose = require('mongoose');
  await mongoose.connect(process.env.MONGODB_URI);
  const Infrastructure = require('../models/Infrastructure');

  let imported = 0;
  let skipped = 0;

  for (const el of elements) {
    const featureType = osmTagsToFeatureType(el.tags);
    if (!featureType) { skipped++; continue; }

    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (!lat || !lon) { skipped++; continue; }

    const name = el.tags?.name || el.tags?.['name:en'] || featureType;

    await Infrastructure.updateOne(
      { osmId: String(el.id) },
      {
        $set: {
          osmId: String(el.id),
          featureType,
          name,
          location: { type: 'Point', coordinates: [lon, lat] },
          osmTags: el.tags || {},
          lastSyncedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );
    imported++;
  }

  console.log(`Import complete: ${imported} upserted, ${skipped} skipped`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
