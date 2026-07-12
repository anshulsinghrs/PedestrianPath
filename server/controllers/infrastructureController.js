const Infrastructure = require('../models/Infrastructure');

/**
 * GET /api/infrastructure
 * Optional filters: featureType, schoolZone, bbox, near=lat,lng&radius=metres
 */
exports.list = async (req, res, next) => {
  try {
    const { featureType, schoolZone, bbox, near, radius, dataProvenance } =
      req.query;
    const query = {};
    if (featureType) {
      const types = featureType.split(',').map((t) => t.trim()).filter(Boolean);
      if (types.length) query.featureType = { $in: types };
    }
    if (schoolZone === 'true') query.schoolZone = true;
    if (dataProvenance) query.dataProvenance = dataProvenance;
    if (bbox) {
      const parts = bbox.split(',').map(Number);
      if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
        const [minLng, minLat, maxLng, maxLat] = parts;
        query.location = {
          $geoWithin: { $box: [[minLng, minLat], [maxLng, maxLat]] },
        };
      }
    }
    if (near) {
      const [lat, lng] = near.split(',').map(Number);
      const r = Math.min(Math.max(Number(radius) || 200, 10), 10000);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        query.location = {
          $near: {
            $geometry: { type: 'Point', coordinates: [lng, lat] },
            $maxDistance: r,
          },
        };
      }
    }
    const items = await Infrastructure.find(query).limit(2000);
    res.json({ count: items.length, items });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/infrastructure
 */
exports.create = async (req, res, next) => {
  try {
    const { lat, lng, ...rest } = req.body;
    const item = await Infrastructure.create({
      ...rest,
      location: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
      reporter: req.user?.id || null,
    });
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/infrastructure/import-osm
 *
 * Accepts a list of OSM features (typed loosely so an external puller
 * can post Overpass API output directly) and upserts them into the
 * Infrastructure collection with `dataProvenance: 'osm_import'`. The
 * mapping from OSM tags to PathGuard feature types follows
 * docs/taxonomy.md §8.
 *
 * Body shape:
 *   { features: [ { id, lat, lng, tags: {...} }, ... ] }
 */
exports.importOsm = async (req, res, next) => {
  try {
    const { features } = req.body || {};
    if (!Array.isArray(features)) {
      return res.status(400).json({ error: 'features must be an array' });
    }

    const ops = [];
    let mapped = 0;
    for (const f of features) {
      const lat = Number(f.lat);
      const lng = Number(f.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const tags = f.tags || {};
      const featureType = osmTagsToFeatureType(tags);
      if (!featureType) continue;
      mapped += 1;
      const osmId = String(f.id);
      ops.push({
        updateOne: {
          filter: { osmId },
          update: {
            $set: {
              featureType,
              name: tags.name || tags.ref || undefined,
              osmId,
              osmTags: tags,
              dataProvenance: 'osm_import',
              location: { type: 'Point', coordinates: [lng, lat] },
            },
          },
          upsert: true,
        },
      });
    }

    if (ops.length === 0) {
      return res.json({ inserted: 0, mapped: 0, received: features.length });
    }
    const result = await Infrastructure.bulkWrite(ops, { ordered: false });
    res.json({
      received: features.length,
      mapped,
      upserted: result.upsertedCount || 0,
      modified: result.modifiedCount || 0,
    });
  } catch (err) {
    next(err);
  }
};

function osmTagsToFeatureType(tags) {
  if (!tags || typeof tags !== 'object') return null;
  if (tags.highway === 'crossing' || tags.crossing) return 'crossing';
  if (tags.highway === 'footway' || tags.footway === 'sidewalk')
    return 'sidewalk';
  if (tags.highway === 'cycleway' || (tags.cycleway && tags.cycleway !== 'no'))
    return 'bike_lane';
  if (tags.highway === 'bus_stop') return 'bus_stop';
  if (tags.amenity === 'school') return 'school_zone';
  if (
    tags.highway === 'path' &&
    tags.bicycle === 'designated' &&
    tags.foot === 'designated'
  )
    return 'shared_path';
  if (tags.junction === 'roundabout' || tags.highway === 'motorway_junction')
    return 'intersection';
  return null;
}

module.exports.osmTagsToFeatureType = osmTagsToFeatureType;
