/**
 * Walkability controller.
 *
 * GET  /api/walkability/weights        — default indicator weights + scale.
 * POST /api/walkability/score          — score a segment from tags/indicators.
 * GET  /api/walkability/heatmap        — walkability heatmap for the map,
 *                                        built from scored infrastructure
 *                                        features + incident penalties.
 *
 * All scoring goes through services/walkability — the same engine the
 * routing cost function uses — so map colours and route scores agree.
 */
'use strict';

const mongoose = require('mongoose');
const walkability = require('../services/walkability');
const { makeIncidentPenalty } = require('../services/routing');

let Infrastructure;
let Incident;
try {
  Infrastructure = require('../models/Infrastructure');
} catch {
  Infrastructure = null;
}
try {
  Incident = require('../models/Incident');
} catch {
  Incident = null;
}

// Map an Infrastructure document's own condition fields to walkability
// indicators when it carries no raw OSM tags.
const SIDEWALK_COND = { good: 90, fair: 60, poor: 30, absent: 10, unknown: 50 };
const CROSSING_COND = { safe: 90, moderate: 60, unsafe: 30, dangerous: 10, unknown: 50 };

function indicatorsFromInfra(f) {
  return {
    sidewalk: SIDEWALK_COND[f.sidewalkCondition] ?? 50,
    greenery: 50,
    lighting: f.featureType === 'street_lamp' || f.featureType === 'traffic_signal' ? 85 : 50,
    crowdedness: 50,
    crossing_safety: CROSSING_COND[f.crossingSafety] ?? 55,
  };
}

exports.weights = (_req, res) => {
  res.json({
    indicators: walkability.INDICATOR_KEYS,
    defaultWeights: walkability.DEFAULT_WEIGHTS,
    scoreStops: walkability.SCORE_STOPS,
  });
};

exports.score = (req, res) => {
  const { indicators, tags, weights, incidentPenalty } = req.body || {};
  if (!indicators && !tags) {
    return res.status(400).json({ error: 'Provide either `indicators` or OSM `tags`' });
  }
  const result = walkability.scoreSegment({
    indicators: indicators || undefined,
    tags: tags || {},
    weights,
    incidentPenalty: Number(incidentPenalty) || 0,
  });
  res.json(result);
};

exports.heatmap = async (req, res, next) => {
  try {
    if (!Infrastructure || mongoose.connection.readyState !== 1) {
      return res.json({ type: 'FeatureCollection', features: [], note: 'database unavailable' });
    }
    const { bbox, near, radius } = req.query;
    const query = {};
    if (bbox) {
      const parts = bbox.split(',').map(Number);
      if (parts.length === 4 && parts.every(Number.isFinite)) {
        const [minLng, minLat, maxLng, maxLat] = parts;
        query.location = { $geoWithin: { $box: [[minLng, minLat], [maxLng, maxLat]] } };
      }
    } else if (near) {
      const [lat, lng] = near.split(',').map(Number);
      const r = Math.min(Math.max(Number(radius) || 2000, 50), 20000);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        query.location = {
          $near: { $geometry: { type: 'Point', coordinates: [lng, lat] }, $maxDistance: r },
        };
      }
    }

    const features = await Infrastructure.find(query).limit(3000).lean();

    // Pull incidents in view to penalise nearby walkability.
    let incidents = [];
    if (Incident) {
      try {
        incidents = await Incident.find(query.location ? { location: query.location } : {})
          .select('location severity module')
          .limit(2000)
          .lean();
      } catch {
        incidents = [];
      }
    }
    const penaltyAt = makeIncidentPenalty(incidents);

    const out = features
      .map((f) => {
        const coords = f.location?.coordinates;
        if (!coords) return null;
        const [lng, lat] = coords;
        const scored = walkability.scoreSegment({
          tags: f.osmTags || {},
          indicators: f.osmTags ? undefined : indicatorsFromInfra(f),
          incidentPenalty: penaltyAt(lng, lat),
        });
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lng, lat] },
          properties: {
            id: String(f._id),
            featureType: f.featureType,
            walkability: scored.walkabilityIndex,
            safety: scored.safetyIndex,
            comfort: scored.comfortIndex,
            accessibility: scored.accessibilityIndex,
            rating: scored.rating,
            color: scored.color,
          },
        };
      })
      .filter(Boolean);

    res.json({ type: 'FeatureCollection', count: out.length, features: out });
  } catch (err) {
    next(err);
  }
};
