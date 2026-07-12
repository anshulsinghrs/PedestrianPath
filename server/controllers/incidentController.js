const { validationResult } = require('express-validator');
const Incident = require('../models/Incident');
const analyticsClient = require('../services/analyticsClient');
const { applyKAnonymity } = require('../services/privacy');
const { detectPii } = require('../services/piiDetection');
const { detectCrisis } = require('../services/crisisDetection');

/* ----------------------------------------------------------------------- */
/*  Reads                                                                  */
/* ----------------------------------------------------------------------- */

exports.getIncidents = async (req, res, next) => {
  try {
    const { limit = 500 } = req.query;
    const query = buildIncidentQuery(req.query);

    const incidents = await Incident.find(query)
      .sort({ incidentDate: -1 })
      .limit(Math.min(Number(limit) || 500, 5000))
      .populate('reporter', 'name mobilityMode')
      .populate('linkedInfrastructure', 'featureType name location');

    res.json({ count: incidents.length, incidents });
  } catch (err) {
    next(err);
  }
};

exports.getIncident = async (req, res, next) => {
  try {
    const incident = await Incident.findById(req.params.id)
      .populate('reporter', 'name mobilityMode')
      .populate('linkedInfrastructure');
    if (!incident) return res.status(404).json({ error: 'Incident not found' });

    res.json(incident);
  } catch (err) {
    if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid id' });
    next(err);
  }
};

/* ----------------------------------------------------------------------- */
/*  Creates — module-specific                                              */
/* ----------------------------------------------------------------------- */

function readPilot(req) {
  const pilotCohort = req.get('X-Pilot-Cohort') || req.body.pilotCohort || undefined;
  const dataProvenance = pilotCohort ? 'pilot' : 'production';
  return { pilotCohort, dataProvenance };
}

function readCommonContext(body) {
  return {
    severity: body.severity || 'minor',
    description: body.description,
    incidentDate: body.incidentDate ? new Date(body.incidentDate) : new Date(),
    address: body.address,
    weather: body.weather || 'unknown',
    lightingCondition: body.lightingCondition || 'unknown',
    roadType: body.roadType || 'unknown',
    consentForResearch:
      body.consentForResearch === undefined
        ? true
        : body.consentForResearch === 'true' || body.consentForResearch === true,
    exportSuppressed:
      body.exportSuppressed === 'true' || body.exportSuppressed === true,
    demographics: parseDemographics(body.demographics),
    schemaVersion: '4.0',
  };
}

// Tri-state boolean parser: accepts "true"/"false"/true/false/undefined.
function readBool(v) {
  if (v === undefined || v === null || v === '') return null;
  if (v === 'true' || v === true) return true;
  if (v === 'false' || v === false) return false;
  return null;
}

function parseDemographics(value) {
  if (!value) return undefined;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

/** POST /api/incidents/accident-conflict */
exports.createAccidentConflict = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const piiCheck = detectPii(req.body.description);
    if (piiCheck.detected) {
      return res.status(400).json({
        error: 'Personal information detected in description.',
        piiTypes: piiCheck.types,
        hint: 'Please remove personal details (phone numbers, email addresses, names) before submitting.',
      });
    }

    const { pilotCohort, dataProvenance } = readPilot(req);
    const common = readCommonContext(req.body);

    const interactingModes = parseStringList(req.body.interactingModes);

    const payload = {
      module: 'accident_conflict',
      reporterMode: req.body.reporterMode,
      interactingMode:
        req.body.interactingMode || interactingModes[0] || 'none',
      interactionType: req.body.interactionType || 'none',
      interactingModes,
      incidentType: req.body.incidentType,
      injuryLevel: req.body.injuryLevel || 'none',
      // v4.0 conflict fields
      collisionType: req.body.collisionType,
      nearMissType: req.body.nearMissType,
      evasiveAction: req.body.evasiveAction,
      soloFallContributors: parseStringList(req.body.soloFallContributors),
      perceivedDangerScale: req.body.perceivedDangerScale
        ? Number(req.body.perceivedDangerScale)
        : undefined,
      affectsFutureRoute: readBool(req.body.affectsFutureRoute),
      repeatLocationHistory: req.body.repeatLocationHistory,
      indirectContribution: readBool(req.body.indirectContribution),
      ...common,
      location: {
        type: 'Point',
        coordinates: [Number(req.body.lng), Number(req.body.lat)],
      },
      imageUrl: req.file ? `/uploads/${req.file.filename}` : undefined,
      thumbnailUrl: req.fileThumbnail || undefined,
      videoUrl: req.videoUrl || undefined,
      reporter: req.user?.id || null,
      isAnonymous: !req.user,
      tripPurpose: req.body.tripPurpose,
      speedCategory: req.body.speedCategory,
      crossingType: req.body.crossingType,
      schoolZone: req.body.schoolZone === 'true' || req.body.schoolZone === true,
      pedestrianDensity: req.body.pedestrianDensity || 'unknown',
      dataProvenance,
      pilotCohort,
      linkedInfrastructure: parseIdList(req.body.linkedInfrastructure),
      infrastructureContributingFactors: parseStringList(
        req.body.infrastructureContributingFactors
      ),
    };
    payload.riskScore = await computeRiskScoreAsync(payload);

    const incident = await Incident.create(payload);
    req.app.get('io')?.emit('incident:new', { module: 'accident_conflict', id: incident._id });
    res.status(201).json(incident);
  } catch (err) {
    next(err);
  }
};

/** POST /api/incidents/hazard-infrastructure */
exports.createHazardInfrastructure = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const piiCheck = detectPii(req.body.description);
    if (piiCheck.detected) {
      return res.status(400).json({
        error: 'Personal information detected in description.',
        piiTypes: piiCheck.types,
        hint: 'Please remove personal details (phone numbers, email addresses, names) before submitting.',
      });
    }

    const { pilotCohort, dataProvenance } = readPilot(req);
    const common = readCommonContext(req.body);

    const payload = {
      module: 'hazard_infrastructure',
      hazardType: req.body.hazardType,
      hazardCategory: req.body.hazardCategory,
      hazardSeverityPerceived: req.body.hazardSeverityPerceived
        ? Number(req.body.hazardSeverityPerceived)
        : undefined,
      hazardDuration: req.body.hazardDuration,
      hazardVisibilityConditions: parseStringList(
        req.body.hazardVisibilityConditions
      ),
      affectedUserGroups: parseStringList(req.body.affectedUserGroups),
      behaviorAffected: readBool(req.body.behaviorAffected),
      behavioralImpactTypes: parseStringList(req.body.behavioralImpactTypes),
      ...common,
      location: {
        type: 'Point',
        coordinates: [Number(req.body.lng), Number(req.body.lat)],
      },
      imageUrl: req.file ? `/uploads/${req.file.filename}` : undefined,
      thumbnailUrl: req.fileThumbnail || undefined,
      videoUrl: req.videoUrl || undefined,
      reporter: req.user?.id || null,
      isAnonymous: !req.user,
      reporterMode: req.body.reporterMode,
      crossingType: req.body.crossingType,
      schoolZone: req.body.schoolZone === 'true' || req.body.schoolZone === true,
      dataProvenance,
      pilotCohort,
      linkedInfrastructure: parseIdList(req.body.linkedInfrastructure),
      infrastructureContributingFactors: parseStringList(
        req.body.infrastructureContributingFactors
      ),
    };
    payload.riskScore = await computeRiskScoreAsync(payload);

    const incident = await Incident.create(payload);
    req.app.get('io')?.emit('incident:new', { module: 'hazard_infrastructure', id: incident._id });
    res.status(201).json(incident);
  } catch (err) {
    next(err);
  }
};

/** POST /api/incidents/personal-safety */
exports.createPersonalSafety = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const piiCheck = detectPii(req.body.description);
    if (piiCheck.detected) {
      return res.status(400).json({
        error: 'Personal information detected in description.',
        piiTypes: piiCheck.types,
        hint: 'Please remove personal details before submitting.',
      });
    }

    const crisisCheck = detectCrisis(req.body.description);

    const { pilotCohort, dataProvenance } = readPilot(req);
    const common = readCommonContext(req.body);

    const payload = {
      module: 'personal_safety',
      concernType: req.body.concernType,
      mobilityActivity: req.body.mobilityActivity,
      environmentalContext: parseStringList(req.body.environmentalContext),
      timeOfDayContext: req.body.timeOfDayContext,
      crowdLevel: req.body.crowdLevel || 'unknown',
      perceivedRiskLevel: req.body.perceivedRiskLevel
        ? Number(req.body.perceivedRiskLevel)
        : undefined,
      behavioralAdaptations: parseStringList(req.body.behavioralAdaptations),
      interventionPreferences: parseStringList(req.body.interventionPreferences),
      repeatExposure: req.body.repeatExposure,
      socialContext: req.body.socialContext,
      transitStopLit: readBool(req.body.transitStopLit),
      transitWaitMinutes: req.body.transitWaitMinutes
        ? Number(req.body.transitWaitMinutes)
        : undefined,
      transitOthersWaiting: req.body.transitOthersWaiting,
      crossingType: req.body.crossingType,
      crossingSignal: readBool(req.body.crossingSignal),
      crossingVehicleYielded: readBool(req.body.crossingVehicleYielded),
      infrastructureContributingFactors: parseStringList(
        req.body.infrastructureContributingFactors
      ),
      reporterMode: req.body.reporterMode || 'pedestrian',
      ...common,
      location: {
        type: 'Point',
        coordinates: [Number(req.body.lng), Number(req.body.lat)],
      },
      reporter: null,
      isAnonymous: true,
      dataProvenance,
      pilotCohort,
    };

    const incident = await Incident.create(payload);
    req.app.get('io')?.emit('incident:new', { module: 'personal_safety', id: incident._id });

    const response = { ...incident.toObject() };
    if (crisisCheck.crisis) {
      response.crisisAlert = {
        message: 'If you are in immediate danger, please call emergency services (112 in India).',
        resources: ['Police: 100', 'Women helpline: 1091', 'Emergency: 112'],
      };
    }

    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
};

/**
 * Backwards-compatible POST /api/incidents — assumes accident_conflict
 * unless the body has a `module` field. Maintained for older clients;
 * new code should use the per-module endpoints.
 */
exports.createIncident = async (req, res, next) => {
  if (req.body.module === 'hazard_infrastructure') {
    return exports.createHazardInfrastructure(req, res, next);
  }
  if (req.body.module === 'personal_safety') {
    return exports.createPersonalSafety(req, res, next);
  }
  return exports.createAccidentConflict(req, res, next);
};

/* ----------------------------------------------------------------------- */
/*  Delete                                                                 */
/* ----------------------------------------------------------------------- */

exports.deleteIncident = async (req, res, next) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ error: 'Incident not found' });

    if (incident.module === 'personal_safety') {
      return res.status(403).json({
        error: 'module_3_immutable',
        message:
          'Module 3 reports cannot be deleted via API. Use the per-record exportSuppressed flag instead.',
      });
    }

    if (!incident.reporter || incident.reporter.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this incident' });
    }

    await incident.deleteOne();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

/* ----------------------------------------------------------------------- */
/*  Stats & analytics                                                      */
/* ----------------------------------------------------------------------- */

exports.getStats = async (req, res, next) => {
  try {
    const baseMatch = {};

    const [byModule, byReporterMode, bySeverity, total] = await Promise.all([
      Incident.aggregate([
        { $match: baseMatch },
        { $group: { _id: '$module', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Incident.aggregate([
        { $match: baseMatch },
        { $group: { _id: '$reporterMode', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Incident.aggregate([
        { $match: baseMatch },
        { $group: { _id: '$severity', count: { $sum: 1 } } },
      ]),
      Incident.countDocuments(baseMatch),
    ]);

    res.json({ total, byModule, byReporterMode, bySeverity });
  } catch (err) {
    next(err);
  }
};

exports.getAnalytics = async (req, res, next) => {
  try {
    const { from, to, mode, type } = req.query;
    const match = buildIncidentQuery({ mode, type, from, to });

    const [trend, byHour, byDow, hotspots] = await Promise.all([
      Incident.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$incidentDate' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Incident.aggregate([
        { $match: match },
        { $group: { _id: { $hour: '$incidentDate' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Incident.aggregate([
        { $match: match },
        { $group: { _id: { $dayOfWeek: '$incidentDate' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Incident.aggregate([
        { $match: match },
        {
          $project: {
            cellLng: { $round: [{ $arrayElemAt: ['$location.coordinates', 0] }, 3] },
            cellLat: { $round: [{ $arrayElemAt: ['$location.coordinates', 1] }, 3] },
            severity: 1,
          },
        },
        {
          $group: {
            _id: { lng: '$cellLng', lat: '$cellLat' },
            count: { $sum: 1 },
            majorCount: {
              $sum: { $cond: [{ $in: ['$severity', ['major', 'fatal']] }, 1, 0] },
            },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
    ]);

    res.json({
      filters: { from, to, mode, type },
      deprecated: {
        hotspots:
          'coordinate-rounding aggregation; use /analytics/hotspots/kde for v3.0',
      },
      trend,
      byHour,
      byDayOfWeek: byDow,
      hotspots: hotspots.map((h) => ({
        lat: h._id.lat,
        lng: h._id.lng,
        count: h.count,
        majorCount: h.majorCount,
      })),
    });
  } catch (err) {
    next(err);
  }
};

async function fetchPointsForAnalytics(query) {
  return Incident.find(query, { location: 1, severity: 1, module: 1, _id: 0 })
    .limit(20000)
    .lean();
}

exports.kdeHotspots = async (req, res, next) => {
  try {
    const filterQuery = buildIncidentQuery(req.query);
    const incidents = await fetchPointsForAnalytics(filterQuery);

    if (incidents.length < 3) {
      return res.json({
        type: 'FeatureCollection',
        features: [],
        metadata: { n_points: incidents.length, note: 'insufficient data' },
      });
    }

    const sevWeight = { minor: 1, moderate: 1.5, major: 3, fatal: 5 };
    const points = incidents
      .filter((i) => i.location?.coordinates?.length === 2)
      .map((i) => ({
        lat: i.location.coordinates[1],
        lng: i.location.coordinates[0],
        weight: sevWeight[i.severity] || 1,
      }));

    const out = await analyticsClient.kde({
      points,
      bandwidth: req.query.bandwidth ? Number(req.query.bandwidth) : null,
      resolution_m: req.query.resolution ? Number(req.query.resolution) : 50,
    });
    res.json(out);
  } catch (err) {
    if (err.status) {
      return res
        .status(502)
        .json({ error: 'analytics service failed', detail: err.message });
    }
    next(err);
  }
};

exports.getisOrdHotspots = async (req, res, next) => {
  try {
    const filterQuery = buildIncidentQuery(req.query);
    const incidents = await fetchPointsForAnalytics(filterQuery);

    if (incidents.length < 5) {
      return res.json({
        type: 'FeatureCollection',
        features: [],
        metadata: { n_points: incidents.length, note: 'insufficient data' },
      });
    }

    const sevValue = { minor: 1, moderate: 2, major: 4, fatal: 8 };
    const points = incidents
      .filter((i) => i.location?.coordinates?.length === 2)
      .map((i) => ({
        lat: i.location.coordinates[1],
        lng: i.location.coordinates[0],
        weight: 1,
        value: sevValue[i.severity] || 1,
      }));

    const out = await analyticsClient.getisOrd({
      points,
      distance_m: req.query.distance ? Number(req.query.distance) : 200,
    });
    res.json(out);
  } catch (err) {
    if (err.status) {
      return res
        .status(502)
        .json({ error: 'analytics service failed', detail: err.message });
    }
    next(err);
  }
};

/**
 * GET /api/analytics/interactions  — Module 1-specific
 * Mode-by-mode interaction matrix, interaction-type frequency,
 * infrastructure-stratified interaction patterns.
 */
exports.interactionAnalytics = async (req, res, next) => {
  try {
    const filterQuery = buildIncidentQuery(req.query);
    const match = { ...filterQuery, module: 'accident_conflict' };

    const [
      matrix,
      byInteraction,
      byInfraFeature,
      multiPartyMatrix,
      byCollisionType,
    ] = await Promise.all([
      Incident.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              reporter: '$reporterMode',
              other: '$interactingMode',
            },
            count: { $sum: 1 },
          },
        },
      ]),
      Incident.aggregate([
        { $match: match },
        { $group: { _id: '$interactionType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Incident.aggregate([
        { $match: { ...match, 'linkedInfrastructure.0': { $exists: true } } },
        { $unwind: '$linkedInfrastructure' },
        {
          $lookup: {
            from: 'infrastructures',
            localField: 'linkedInfrastructure',
            foreignField: '_id',
            as: 'infra',
          },
        },
        { $unwind: '$infra' },
        {
          $group: {
            _id: {
              featureType: '$infra.featureType',
              interactionType: '$interactionType',
            },
            count: { $sum: 1 },
          },
        },
      ]),
      // v4.0: multi-party matrix from the `interactingModes` array. This
      // co-exists with the legacy single-valued `interactingMode` matrix
      // above so dashboards can switch without breaking.
      Incident.aggregate([
        { $match: { ...match, interactingModes: { $exists: true, $ne: [] } } },
        { $unwind: '$interactingModes' },
        {
          $group: {
            _id: {
              reporter: '$reporterMode',
              other: '$interactingModes',
            },
            count: { $sum: 1 },
          },
        },
      ]),
      Incident.aggregate([
        { $match: { ...match, collisionType: { $exists: true, $ne: null } } },
        { $group: { _id: '$collisionType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    res.json({
      filters: req.query,
      matrix,
      byInteractionType: byInteraction,
      byInfrastructureFeature: byInfraFeature,
      multiPartyMatrix,
      byCollisionType,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/analytics/infrastructure-conditions  — Module 2-specific
 * Hazard-type distribution, infrastructure-feature-stratified counts,
 * crude condition-degradation-over-time series.
 */
exports.infrastructureConditionAnalytics = async (req, res, next) => {
  try {
    const filterQuery = buildIncidentQuery(req.query);
    const match = { ...filterQuery, module: 'hazard_infrastructure' };

    const [byHazardType, byFeatureType, monthlyTrend] = await Promise.all([
      Incident.aggregate([
        { $match: match },
        { $group: { _id: '$hazardType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Incident.aggregate([
        { $match: { ...match, 'linkedInfrastructure.0': { $exists: true } } },
        { $unwind: '$linkedInfrastructure' },
        {
          $lookup: {
            from: 'infrastructures',
            localField: 'linkedInfrastructure',
            foreignField: '_id',
            as: 'infra',
          },
        },
        { $unwind: '$infra' },
        {
          $group: {
            _id: {
              featureType: '$infra.featureType',
              hazardType: '$hazardType',
            },
            count: { $sum: 1 },
          },
        },
      ]),
      Incident.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              ym: { $dateToString: { format: '%Y-%m', date: '$incidentDate' } },
              hazardType: '$hazardType',
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.ym': 1 } },
      ]),
    ]);

    res.json({
      filters: req.query,
      byHazardType,
      byFeatureTypeXHazardType: byFeatureType,
      monthlyTrend,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/analytics/surrogate-safety  — Module 1 (v4.0)
 *
 * Aggregates near-miss / forced-evasive / aggressive-interaction events
 * with their evasive-action and perceived-danger context. Designed as a
 * data source for surrogate safety analysis (SSAM-equivalent without
 * requiring video conflict observation).
 */
exports.surrogateSafetyAnalytics = async (req, res, next) => {
  try {
    const filterQuery = buildIncidentQuery(req.query);
    const surrogateTypes = [
      'near_miss',
      'forced_evasive',
      'aggressive_interaction',
    ];
    const match = {
      ...filterQuery,
      module: 'accident_conflict',
      incidentType: { $in: surrogateTypes },
    };

    const [
      byIncidentType,
      byNearMissType,
      byEvasiveAction,
      byPerceivedDanger,
      perceivedDangerByMode,
      futureRouteImpact,
      repeatExposure,
      byHourReporterMode,
    ] = await Promise.all([
      Incident.aggregate([
        { $match: match },
        { $group: { _id: '$incidentType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Incident.aggregate([
        { $match: { ...match, nearMissType: { $exists: true, $ne: null } } },
        { $group: { _id: '$nearMissType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Incident.aggregate([
        { $match: { ...match, evasiveAction: { $exists: true, $ne: null } } },
        { $group: { _id: '$evasiveAction', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Incident.aggregate([
        { $match: { ...match, perceivedDangerScale: { $ne: null } } },
        { $group: { _id: '$perceivedDangerScale', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Incident.aggregate([
        { $match: { ...match, perceivedDangerScale: { $ne: null } } },
        {
          $group: {
            _id: '$reporterMode',
            mean: { $avg: '$perceivedDangerScale' },
            n: { $sum: 1 },
          },
        },
        { $sort: { mean: -1 } },
      ]),
      Incident.aggregate([
        { $match: { ...match, affectsFutureRoute: { $ne: null } } },
        { $group: { _id: '$affectsFutureRoute', count: { $sum: 1 } } },
      ]),
      Incident.aggregate([
        { $match: { ...match, repeatLocationHistory: { $exists: true } } },
        { $group: { _id: '$repeatLocationHistory', count: { $sum: 1 } } },
      ]),
      Incident.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              hour: { $hour: '$incidentDate' },
              reporterMode: '$reporterMode',
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.hour': 1 } },
      ]),
    ]);

    res.json({
      filters: req.query,
      byIncidentType,
      byNearMissType,
      byEvasiveAction,
      byPerceivedDanger,
      perceivedDangerByMode,
      futureRouteImpact: futureRouteImpact.reduce(
        (acc, r) => ({ ...acc, [String(r._id)]: r.count }),
        {}
      ),
      repeatExposure,
      byHourReporterMode,
      meta: {
        surrogateIncidentTypes: surrogateTypes,
        note:
          'Records are filtered to surrogate-safety event types only. ' +
          'Use /analytics/interactions for the broader Module 1 interaction matrix.',
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/analytics/hazard-categories  — Module 2 (v4.0)
 *
 * Aggregates the v4.0 hazardCategory taxonomy with duration, visibility,
 * affected user groups, and behavioural impact.
 */
exports.hazardCategoryAnalytics = async (req, res, next) => {
  try {
    const filterQuery = buildIncidentQuery(req.query);
    const match = { ...filterQuery, module: 'hazard_infrastructure' };

    const [
      byCategory,
      byCategoryAndType,
      byDuration,
      byVisibilityCondition,
      byAffectedUserGroup,
      perceivedSeverity,
      behaviourAffectedRate,
      behavioralImpactTypes,
    ] = await Promise.all([
      Incident.aggregate([
        { $match: { ...match, hazardCategory: { $exists: true, $ne: null } } },
        { $group: { _id: '$hazardCategory', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Incident.aggregate([
        { $match: { ...match, hazardCategory: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: {
              category: '$hazardCategory',
              hazardType: '$hazardType',
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
      Incident.aggregate([
        { $match: { ...match, hazardDuration: { $exists: true, $ne: null } } },
        { $group: { _id: '$hazardDuration', count: { $sum: 1 } } },
      ]),
      Incident.aggregate([
        { $match: { ...match, hazardVisibilityConditions: { $exists: true, $ne: [] } } },
        { $unwind: '$hazardVisibilityConditions' },
        { $group: { _id: '$hazardVisibilityConditions', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Incident.aggregate([
        { $match: { ...match, affectedUserGroups: { $exists: true, $ne: [] } } },
        { $unwind: '$affectedUserGroups' },
        {
          $group: {
            _id: {
              category: '$hazardCategory',
              userGroup: '$affectedUserGroups',
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
      Incident.aggregate([
        { $match: { ...match, hazardSeverityPerceived: { $ne: null } } },
        {
          $group: {
            _id: '$hazardCategory',
            mean: { $avg: '$hazardSeverityPerceived' },
            n: { $sum: 1 },
          },
        },
        { $sort: { mean: -1 } },
      ]),
      Incident.aggregate([
        { $match: { ...match, behaviorAffected: { $ne: null } } },
        {
          $group: {
            _id: '$hazardCategory',
            yes: { $sum: { $cond: ['$behaviorAffected', 1, 0] } },
            no: { $sum: { $cond: ['$behaviorAffected', 0, 1] } },
            total: { $sum: 1 },
          },
        },
      ]),
      Incident.aggregate([
        { $match: { ...match, behavioralImpactTypes: { $exists: true, $ne: [] } } },
        { $unwind: '$behavioralImpactTypes' },
        { $group: { _id: '$behavioralImpactTypes', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    res.json({
      filters: req.query,
      byCategory,
      byCategoryAndType,
      byDuration,
      byVisibilityCondition,
      byAffectedUserGroup,
      perceivedSeverityByCategory: perceivedSeverity,
      behaviourAffectedRate: behaviourAffectedRate.map((r) => ({
        hazardCategory: r._id,
        rate: r.total > 0 ? r.yes / r.total : null,
        yes: r.yes,
        no: r.no,
        n: r.total,
      })),
      behavioralImpactTypes,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/analytics/behavioral-adaptation  — Modules 2 + 3 (v4.0)
 *
 * Surfaces the behavioural adaptation cascade common to both modules,
 * which is the central research output of the participatory framework.
 *
 * Module 3 outputs are aggregated under the standard k-anonymity policy
 * (no raw points, no free text). The endpoint never echoes descriptions.
 */
exports.behavioralAdaptationAnalytics = async (req, res, next) => {
  try {
    const filterQuery = buildIncidentQuery(req.query);

    // Module 2: behavioural impact triggered by hazard exposure
    const m2Match = { ...filterQuery, module: 'hazard_infrastructure' };
    const [m2Affected, m2Impacts] = await Promise.all([
      Incident.aggregate([
        { $match: { ...m2Match, behaviorAffected: { $ne: null } } },
        {
          $group: {
            _id: null,
            yes: { $sum: { $cond: ['$behaviorAffected', 1, 0] } },
            no: { $sum: { $cond: ['$behaviorAffected', 0, 1] } },
            total: { $sum: 1 },
          },
        },
      ]),
      Incident.aggregate([
        {
          $match: {
            ...m2Match,
            behavioralImpactTypes: { $exists: true, $ne: [] },
          },
        },
        { $unwind: '$behavioralImpactTypes' },
        {
          $group: {
            _id: {
              impact: '$behavioralImpactTypes',
              hazardCategory: '$hazardCategory',
              reporterMode: '$reporterMode',
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
    ]);

    // Module 3 — non-admin requests are denied; admins get aggregates only.
    let m3 = null;
    {
      const m3Match = {
        ...filterQuery,
        module: 'personal_safety',
        consentForResearch: true,
        exportSuppressed: { $ne: true },
      };
      const [
        m3Affected,
        m3Adaptations,
        m3AdaptByActivity,
        m3InterventionPrefs,
        m3RepeatExposure,
      ] = await Promise.all([
        Incident.aggregate([
          { $match: { ...m3Match, behaviorAffected: { $ne: null } } },
          {
            $group: {
              _id: null,
              yes: { $sum: { $cond: ['$behaviorAffected', 1, 0] } },
              no: { $sum: { $cond: ['$behaviorAffected', 0, 1] } },
              total: { $sum: 1 },
            },
          },
        ]),
        Incident.aggregate([
          {
            $match: {
              ...m3Match,
              behavioralAdaptations: { $exists: true, $ne: [] },
            },
          },
          { $unwind: '$behavioralAdaptations' },
          { $group: { _id: '$behavioralAdaptations', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Incident.aggregate([
          {
            $match: {
              ...m3Match,
              behavioralAdaptations: { $exists: true, $ne: [] },
              mobilityActivity: { $exists: true, $ne: null },
            },
          },
          { $unwind: '$behavioralAdaptations' },
          {
            $group: {
              _id: {
                adaptation: '$behavioralAdaptations',
                activity: '$mobilityActivity',
              },
              count: { $sum: 1 },
            },
          },
        ]),
        Incident.aggregate([
          {
            $match: {
              ...m3Match,
              interventionPreferences: { $exists: true, $ne: [] },
            },
          },
          { $unwind: '$interventionPreferences' },
          { $group: { _id: '$interventionPreferences', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Incident.aggregate([
          { $match: { ...m3Match, repeatExposure: { $exists: true, $ne: null } } },
          { $group: { _id: '$repeatExposure', count: { $sum: 1 } } },
        ]),
      ]);

      m3 = {
        affected: m3Affected[0] || null,
        adaptations: m3Adaptations,
        adaptationsByActivity: m3AdaptByActivity,
        interventionPreferences: m3InterventionPrefs,
        repeatExposure: m3RepeatExposure,
      };
    }

    res.json({
      filters: req.query,
      module2: {
        affected: m2Affected[0] || null,
        impacts: m2Impacts,
      },
      module3: m3,
    });
  } catch (err) {
    next(err);
  }
};

exports.demographicsAnalytics = async (req, res, next) => {
  try {
    const filterQuery = buildIncidentQuery(req.query);
    const baseMatch = filterQuery;

    const stratifiable = {
      ...baseMatch,
      demographics: { $exists: true, $ne: null },
    };

    const [byAgeGroup, byGender, byModeUsage, ageByModule, ageByReporterMode] =
      await Promise.all([
        Incident.aggregate([
          { $match: { ...stratifiable, 'demographics.ageGroup': { $exists: true } } },
          { $group: { _id: '$demographics.ageGroup', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Incident.aggregate([
          { $match: { ...stratifiable, 'demographics.gender': { $exists: true } } },
          { $group: { _id: '$demographics.gender', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Incident.aggregate([
          {
            $match: {
              ...stratifiable,
              'demographics.modeUsageFrequency': { $exists: true },
            },
          },
          {
            $group: {
              _id: '$demographics.modeUsageFrequency',
              count: { $sum: 1 },
            },
          },
        ]),
        Incident.aggregate([
          { $match: { ...stratifiable, 'demographics.ageGroup': { $exists: true } } },
          {
            $group: {
              _id: {
                module: '$module',
                ageGroup: '$demographics.ageGroup',
              },
              count: { $sum: 1 },
            },
          },
        ]),
        Incident.aggregate([
          { $match: { ...stratifiable, 'demographics.ageGroup': { $exists: true } } },
          {
            $group: {
              _id: {
                reporterMode: '$reporterMode',
                ageGroup: '$demographics.ageGroup',
              },
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

    res.json({
      filters: req.query,
      byAgeGroup,
      byGender,
      byModeUsage,
      ageByModule,
      ageByReporterMode,
    });
  } catch (err) {
    next(err);
  }
};

exports.personalSafetyContext = async (req, res, next) => {
  try {
    const filterQuery = buildIncidentQuery(req.query);
    const match = {
      ...filterQuery,
      module: 'personal_safety',
      consentForResearch: true,
      exportSuppressed: { $ne: true },
    };

    const [
      byTimeOfDay,
      byCrowdLevel,
      byLighting,
      byRisk,
      byConcern,
      byMobilityActivity,
      byEnvironmentalContext,
      bySocialContext,
    ] = await Promise.all([
      Incident.aggregate([
        { $match: match },
        { $group: { _id: '$timeOfDayContext', count: { $sum: 1 } } },
      ]),
      Incident.aggregate([
        { $match: match },
        { $group: { _id: '$crowdLevel', count: { $sum: 1 } } },
      ]),
      Incident.aggregate([
        { $match: match },
        { $group: { _id: '$lightingCondition', count: { $sum: 1 } } },
      ]),
      Incident.aggregate([
        { $match: match },
        { $group: { _id: '$perceivedRiskLevel', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Incident.aggregate([
        { $match: match },
        { $group: { _id: '$concernType', count: { $sum: 1 } } },
      ]),
      Incident.aggregate([
        { $match: { ...match, mobilityActivity: { $exists: true, $ne: null } } },
        { $group: { _id: '$mobilityActivity', count: { $sum: 1 } } },
      ]),
      Incident.aggregate([
        {
          $match: {
            ...match,
            environmentalContext: { $exists: true, $ne: [] },
          },
        },
        { $unwind: '$environmentalContext' },
        { $group: { _id: '$environmentalContext', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Incident.aggregate([
        { $match: { ...match, socialContext: { $exists: true, $ne: null } } },
        { $group: { _id: '$socialContext', count: { $sum: 1 } } },
      ]),
    ]);

    // Aggregated cell counts using Module 3 minima.
    const records = await Incident.find(match, {
      location: 1,
      incidentDate: 1,
      module: 1,
      concernType: 1,
      severity: 1,
      _id: 0,
    })
      .limit(50000)
      .lean();
    const { rows, manifest } = applyKAnonymity(records, {
      k: 1,
      cellSizeM: 100,
      temporal: 'month',
    });

    res.json({
      filters: req.query,
      byTimeOfDay,
      byCrowdLevel,
      byLighting,
      byRisk,
      byConcern,
      byMobilityActivity,
      byEnvironmentalContext,
      bySocialContext,
      aggregatedCells: rows,
      privacyManifest: manifest,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/analytics/pilot/:cohort  — Module 1+2 summary metrics
 */
exports.pilotMetrics = async (req, res, next) => {
  try {
    const cohort = req.params.cohort;
    if (!cohort) return res.status(400).json({ error: 'cohort is required' });
    const modules = (req.query.modules || '1,2')
      .split(',')
      .map((s) => s.trim())
      .map((s) =>
        s === '1' ? 'accident_conflict' : s === '2' ? 'hazard_infrastructure' : null
      )
      .filter(Boolean);

    const match = {
      pilotCohort: cohort,
      module: { $in: modules },
    };

    const [total, byMode, withInfra, withPhoto, latencyAgg, reporters] =
      await Promise.all([
        Incident.countDocuments(match),
        Incident.aggregate([
          { $match: match },
          { $group: { _id: '$reporterMode', count: { $sum: 1 } } },
        ]),
        Incident.countDocuments({ ...match, 'linkedInfrastructure.0': { $exists: true } }),
        Incident.countDocuments({ ...match, imageUrl: { $exists: true, $ne: null } }),
        Incident.aggregate([
          { $match: { ...match, reportingLatencyMinutes: { $ne: null } } },
          { $group: { _id: null, avg: { $avg: '$reportingLatencyMinutes' } } },
        ]),
        Incident.distinct('reporter', match),
      ]);

    res.json({
      cohort,
      modules,
      n_incidents: total,
      n_reporters: reporters.filter(Boolean).length,
      incidents_per_reporter:
        reporters.filter(Boolean).length > 0
          ? total / reporters.filter(Boolean).length
          : null,
      mode_distribution: byMode,
      infrastructure_linkage_rate: total > 0 ? withInfra / total : 0,
      photo_upload_rate: total > 0 ? withPhoto / total : 0,
      mean_reporting_latency_minutes: latencyAgg[0]?.avg ?? null,
    });
  } catch (err) {
    next(err);
  }
};

/* ----------------------------------------------------------------------- */
/*  Export                                                                 */
/* ----------------------------------------------------------------------- */

exports.exportIncidents = async (req, res, next) => {
  try {
    const {
      format = 'geojson',
      from,
      to,
      mode,
      type,
      includeSynthetic,
      module: moduleFilter,
    } = req.query;

    const k = Math.max(1, parseInt(req.query.k, 10) || 5);
    const cellSizeM = Math.max(10, parseInt(req.query.cellSizeM, 10) || 100);
    const temporal = ['day', 'week', 'month'].includes(req.query.temporal)
      ? req.query.temporal
      : 'day';

    const match = {
      ...buildIncidentQuery({ from, to, mode, type, module: moduleFilter }),
      consentForResearch: true,
      exportSuppressed: { $ne: true },
    };

    if (includeSynthetic !== 'true' && includeSynthetic !== true) {
      match.dataProvenance = { $ne: 'synthetic_seed' };
    }

    const incidents = await Incident.find(match).limit(100000).lean();

    const { rows, manifest } = applyKAnonymity(incidents, {
      k,
      cellSizeM,
      temporal,
    });

    if (format === 'csv') {
      const header = [
        'cellId',
        'temporalBucket',
        'group',
        'lat',
        'lng',
        'n_incidents',
        'n_by_type_json',
        'n_by_severity_json',
      ];
      const csvRows = rows.map((r) =>
        [
          r.cellId,
          r.temporalBucket,
          r.mode,
          r.lat.toFixed(6),
          r.lng.toFixed(6),
          r.n_incidents,
          JSON.stringify(r.n_by_type),
          JSON.stringify(r.n_by_severity),
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      );
      res.setHeader('X-Privacy-Manifest', JSON.stringify(manifest));
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="pathguard_incidents_k.csv"'
      );
      return res.send([header.join(','), ...csvRows].join('\n'));
    }

    const features = rows.map((r) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        cellId: r.cellId,
        temporalBucket: r.temporalBucket,
        group: r.mode,
        n_incidents: r.n_incidents,
        n_by_type: r.n_by_type,
        n_by_severity: r.n_by_severity,
        ...(r.n_by_lighting ? { n_by_lighting: r.n_by_lighting } : {}),
        ...(r.n_by_weather ? { n_by_weather: r.n_by_weather } : {}),
        ...(r.n_by_collisionType
          ? { n_by_collisionType: r.n_by_collisionType }
          : {}),
        ...(r.n_by_nearMissType
          ? { n_by_nearMissType: r.n_by_nearMissType }
          : {}),
        ...(r.n_by_evasiveAction
          ? { n_by_evasiveAction: r.n_by_evasiveAction }
          : {}),
        ...(r.n_by_hazardCategory
          ? { n_by_hazardCategory: r.n_by_hazardCategory }
          : {}),
        ...(r.n_by_hazardDuration
          ? { n_by_hazardDuration: r.n_by_hazardDuration }
          : {}),
        ...(typeof r.mean_perceivedDanger === 'number'
          ? { mean_perceivedDanger: r.mean_perceivedDanger }
          : {}),
        ...(typeof r.mean_perceivedHazardSeverity === 'number'
          ? { mean_perceivedHazardSeverity: r.mean_perceivedHazardSeverity }
          : {}),
      },
    }));

    res.setHeader('Content-Type', 'application/geo+json');
    res.json({
      type: 'FeatureCollection',
      features,
      privacyManifest: manifest,
    });
  } catch (err) {
    next(err);
  }
};

/* ----------------------------------------------------------------------- */
/*  Helpers                                                                */
/* ----------------------------------------------------------------------- */

function buildIncidentQuery(params = {}) {
  const query = {};
  const {
    type,
    mode,
    severity,
    from,
    to,
    bbox,
    schoolZone,
    nearMissOnly,
    module: moduleFilter,
    reporterMode,
    incidentType,
    hazardType,
    hazardCategory,
    collisionType,
    nearMissType,
    concernType,
    mobilityActivity,
    behaviorAffected,
    schemaVersion,
    ageGroup,
    gender,
  } = params;

  if (moduleFilter) query.module = moduleFilter;

  if (type) {
    const types = type.split(',').map((t) => t.trim()).filter(Boolean);
    if (types.length) {
      // Legacy `type` field used by old documents.
      query.type = { $in: types };
    }
  }
  if (incidentType) {
    const v = incidentType.split(',').map((s) => s.trim()).filter(Boolean);
    if (v.length) query.incidentType = { $in: v };
  }
  if (hazardType) {
    const v = hazardType.split(',').map((s) => s.trim()).filter(Boolean);
    if (v.length) query.hazardType = { $in: v };
  }
  if (hazardCategory) {
    const v = hazardCategory.split(',').map((s) => s.trim()).filter(Boolean);
    if (v.length) query.hazardCategory = { $in: v };
  }
  if (collisionType) {
    const v = collisionType.split(',').map((s) => s.trim()).filter(Boolean);
    if (v.length) query.collisionType = { $in: v };
  }
  if (nearMissType) {
    const v = nearMissType.split(',').map((s) => s.trim()).filter(Boolean);
    if (v.length) query.nearMissType = { $in: v };
  }
  if (concernType) {
    const v = concernType.split(',').map((s) => s.trim()).filter(Boolean);
    if (v.length) query.concernType = { $in: v };
  }
  if (mobilityActivity) {
    const v = mobilityActivity.split(',').map((s) => s.trim()).filter(Boolean);
    if (v.length) query.mobilityActivity = { $in: v };
  }
  if (mode || reporterMode) {
    const v = (mode || reporterMode).split(',').map((m) => m.trim()).filter(Boolean);
    if (v.length) query.reporterMode = { $in: v };
  }
  if (severity) {
    const sev = severity.split(',').map((s) => s.trim()).filter(Boolean);
    if (sev.length) query.severity = { $in: sev };
  }
  if (behaviorAffected === 'true' || behaviorAffected === true) {
    query.behaviorAffected = true;
  } else if (behaviorAffected === 'false' || behaviorAffected === false) {
    query.behaviorAffected = false;
  }
  if (schemaVersion) query.schemaVersion = schemaVersion;
  if (ageGroup) {
    const v = ageGroup.split(',').map((s) => s.trim()).filter(Boolean);
    if (v.length) query['demographics.ageGroup'] = { $in: v };
  }
  if (gender) {
    const v = gender.split(',').map((s) => s.trim()).filter(Boolean);
    if (v.length) query['demographics.gender'] = { $in: v };
  }
  if (from || to) {
    query.incidentDate = {};
    if (from) query.incidentDate.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      query.incidentDate.$lte = end;
    }
  }
  if (bbox) {
    const parts = bbox.split(',').map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      const [minLng, minLat, maxLng, maxLat] = parts;
      query.location = {
        $geoWithin: {
          $box: [
            [minLng, minLat],
            [maxLng, maxLat],
          ],
        },
      };
    }
  }
  if (schoolZone === 'true' || schoolZone === true) query.schoolZone = true;
  if (nearMissOnly === 'true' || nearMissOnly === true) query.nearMissOnly = true;
  return query;
}

function parseIdList(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      } catch {
        /* fall through */
      }
    }
    return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function parseStringList(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      } catch {
        /* fall through */
      }
    }
    return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/**
 * Synchronous fallback risk scorer — used when the analytics microservice
 * is unreachable. Mirrors the feature weights in analytics/main.py but at
 * lower precision so there is no hard dependency on the Python service.
 */
function computeRiskScore(p) {
  const sevWeight = { minor: 10, moderate: 30, major: 60, fatal: 90 };
  const injWeight = { none: 0, minor: 5, serious: 12, severe: 20, fatal: 30 };
  const weatherPenalty = { fog: 8, rain: 6, snow: 10, storm: 12 };
  const lightingPenalty = { dark_unlit: 10, dusk: 4, dawn: 3, dark_lit: 5 };
  const modePenalty = { pedestrian: 5, wheelchair: 7, cyclist: 3, ebike_scooter: 3 };
  const collisionBonus = { head_on: 15, run_over: 20, t_bone: 12 };

  let score = sevWeight[p.severity] ?? 10;
  score += injWeight[p.injuryLevel] ?? 0;
  score += weatherPenalty[p.weather] ?? 0;
  score += lightingPenalty[p.lightingCondition] ?? 0;
  score += modePenalty[p.reporterMode] ?? 0;
  score += collisionBonus[p.collisionType] ?? 0;
  if (p.schoolZone) score += 5;
  if (p.perceivedDangerScale) score += (p.perceivedDangerScale - 1) * 3;
  if (p.hazardSeverityPerceived) score += (p.hazardSeverityPerceived - 1) * 2;
  if (p.perceivedRiskLevel) score += (p.perceivedRiskLevel - 1) * 2;
  if (p.affectsFutureRoute) score += 4;

  return Math.min(100, Math.round(score));
}

/**
 * Compute risk score via the analytics microservice; falls back to the
 * synchronous implementation if the service is unreachable.
 */
async function computeRiskScoreAsync(p) {
  try {
    const result = await analyticsClient.riskScore({
      module: p.module,
      severity: p.severity,
      injury_level: p.injuryLevel || 'none',
      weather: p.weather || 'clear',
      lighting_condition: p.lightingCondition || 'daylight',
      school_zone: p.schoolZone || false,
      reporter_mode: p.reporterMode || 'pedestrian',
      incident_type: p.incidentType || p.concernType || null,
      collision_type: p.collisionType || null,
      perceived_danger_scale: p.perceivedDangerScale || null,
      hazard_severity_perceived: p.hazardSeverityPerceived || null,
      perceived_risk_level: p.perceivedRiskLevel || null,
      affect_future_route: p.affectsFutureRoute || null,
      repeat_exposure: p.repeatLocationHistory || p.repeatExposure || null,
      concern_type: p.concernType || null,
    });
    return Math.round(result.risk_score);
  } catch {
    return computeRiskScore(p);
  }
}

