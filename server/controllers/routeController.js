/**
 * Route-planning controller.
 *
 * POST /api/routes/plan   — multi-objective pedestrian route optimisation.
 * GET  /api/routes/profiles — describe the available routing objectives.
 *
 * Routes are computed by services/routing over the live OSM pedestrian
 * network, scored by the walkability engine, and penalised by nearby
 * crowdsourced incident reports pulled from the database.
 */
'use strict';

const mongoose = require('mongoose');
const routing = require('../services/routing');
const { PROFILES } = require('../services/routing/router');
const { bboxAround } = require('../services/routing/geo');

let Incident;
try {
  Incident = require('../models/Incident');
} catch {
  Incident = null;
}

/** Normalise {lat,lng} | [lng,lat] | "lat,lng" → [lng, lat] or null. */
function toLngLat(input) {
  if (!input) return null;
  if (Array.isArray(input) && input.length === 2) {
    const [lng, lat] = input.map(Number);
    return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
  }
  if (typeof input === 'string') {
    const parts = input.split(',').map((s) => Number(s.trim()));
    if (parts.length === 2 && parts.every(Number.isFinite)) {
      // Geocoders emit "lat,lng"; convert to [lng, lat].
      return [parts[1], parts[0]];
    }
    return null;
  }
  if (typeof input === 'object') {
    const lat = Number(input.lat ?? input.latitude);
    const lng = Number(input.lng ?? input.lon ?? input.longitude);
    return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
  }
  return null;
}

/** Load incidents inside the routing bbox for penalty scoring. */
async function loadIncidents(bbox, limit = 500) {
  if (!Incident || mongoose.connection.readyState !== 1) return [];
  const [minLng, minLat, maxLng, maxLat] = bbox;
  try {
    const docs = await Incident.find({
      location: {
        $geoWithin: { $box: [[minLng, minLat], [maxLng, maxLat]] },
      },
    })
      .select('location severity module')
      .limit(limit)
      .lean();
    return docs;
  } catch {
    return [];
  }
}

exports.plan = async (req, res, next) => {
  try {
    const body = req.body || {};
    const origin = toLngLat(body.origin || body.from || body.start);
    const destination = toLngLat(body.destination || body.to || body.end);
    if (!origin || !destination) {
      return res.status(400).json({
        error:
          'origin and destination are required as {lat,lng}, [lng,lat] or "lat,lng"',
      });
    }

    const considerIncidents = body.considerIncidents !== false;
    const bbox = bboxAround(origin, destination, body.marginMeters ?? 500);
    const incidents = considerIncidents ? await loadIncidents(bbox) : [];

    // Allow a self-hosted / alternative Overpass instance via env, useful
    // for restricted networks or higher rate limits.
    const endpoints = process.env.OVERPASS_URL
      ? process.env.OVERPASS_URL.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;

    const result = await routing.planRoutes(origin, destination, {
      weights: body.weights,
      priorities: body.priorities,
      profiles: Array.isArray(body.profiles) ? body.profiles : undefined,
      incidents,
      elements: body.elements, // optional: cached/offline tiles
      marginMeters: body.marginMeters,
      endpoints,
    });

    res.json(result);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    // Overpass / network failures surface as a 502 rather than a 500 so
    // the client can distinguish "try again" from a real server bug.
    if (/overpass|fetch|network|timeout/i.test(err.message || '')) {
      return res.status(502).json({
        error:
          'Could not reach the OpenStreetMap routing data source. Please try again.',
        detail: err.message,
      });
    }
    next(err);
  }
};

exports.profiles = (_req, res) => {
  const list = Object.entries(PROFILES).map(([key, p]) => ({
    key,
    label: p.label,
    detourTolerance: p.alpha,
    timeBased: !!p.time,
  }));
  res.json({ profiles: list });
};
