const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const ctrl = require('../controllers/incidentController');
const upload = require('../middleware/upload');
const { processUploadedImage, mediaUpload } = require('../middleware/upload');
const { protect, optionalAuth } = require('../middleware/auth');
const {
  REPORTER_MODES,
  INTERACTING_MODES,
  INTERACTION_TYPES,
  M1_INCIDENT_TYPES,
  COLLISION_TYPES,
  NEAR_MISS_TYPES,
  EVASIVE_ACTIONS,
  SOLO_FALL_CONTRIBUTORS,
  HAZARD_CATEGORIES,
  M2_HAZARD_TYPES,
  HAZARD_DURATIONS,
  HAZARD_VISIBILITY_CONDITIONS,
  BEHAVIORAL_IMPACT_TYPES,
  M3_CONCERN_TYPES,
  M3_MOBILITY_ACTIVITIES,
  M3_ENVIRONMENTAL_CONTEXT,
  BEHAVIORAL_ADAPTATIONS,
  INTERVENTION_PREFERENCES,
  REPEAT_EXPOSURE_LEVELS,
  SOCIAL_CONTEXTS,
  TIME_OF_DAY,
  SEVERITIES,
  INFRA_CONTRIBUTING_FACTORS,
} = require('../models/Incident');

/**
 * Build an express-validator chain that accepts a comma-separated string
 * or a real array and confirms every member is in `allowed`.
 */
function listIn(field, allowed, optional = true) {
  let chain = body(field);
  if (optional) chain = chain.optional();
  return chain.custom((value) => {
    const list = Array.isArray(value)
      ? value
      : String(value)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
    const bad = list.filter((v) => !allowed.includes(v));
    if (bad.length) {
      throw new Error(`${field}: unknown value(s) ${bad.join(', ')}`);
    }
    return true;
  });
}

/* ----------------------------------------------------------------------- */
/*  Validators                                                             */
/* ----------------------------------------------------------------------- */

const locationValidators = [
  body('lat').isFloat({ min: -90, max: 90 }),
  body('lng').isFloat({ min: -180, max: 180 }),
];

const sharedOptionalValidators = [
  body('description').optional().isLength({ max: 2000 }),
  body('severity').optional().isIn(SEVERITIES),
  body('infrastructureContributingFactors')
    .optional()
    .custom((value) => {
      const list = Array.isArray(value)
        ? value
        : String(value)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
      const bad = list.filter((v) => !INFRA_CONTRIBUTING_FACTORS.includes(v));
      if (bad.length)
        throw new Error(`unknown contributing factor(s): ${bad.join(', ')}`);
      return true;
    }),
];

const module1Validators = [
  body('reporterMode').isIn(REPORTER_MODES),
  body('incidentType').isIn(M1_INCIDENT_TYPES),
  body('interactingMode').optional().isIn(INTERACTING_MODES),
  body('interactionType').optional().isIn(INTERACTION_TYPES),
  body('collisionType').optional().isIn(COLLISION_TYPES),
  body('nearMissType').optional().isIn(NEAR_MISS_TYPES),
  body('evasiveAction').optional().isIn(EVASIVE_ACTIONS),
  body('perceivedDangerScale').optional().isInt({ min: 1, max: 5 }),
  body('repeatLocationHistory').optional().isIn(REPEAT_EXPOSURE_LEVELS),
  listIn('interactingModes', INTERACTING_MODES),
  listIn('soloFallContributors', SOLO_FALL_CONTRIBUTORS),
  ...locationValidators,
  ...sharedOptionalValidators,
];

const module2Validators = [
  body('hazardType').isIn(M2_HAZARD_TYPES),
  body('hazardCategory').optional().isIn(HAZARD_CATEGORIES),
  body('reporterMode').optional().isIn(REPORTER_MODES),
  body('hazardSeverityPerceived').optional().isInt({ min: 1, max: 5 }),
  body('hazardDuration').optional().isIn(HAZARD_DURATIONS),
  listIn('hazardVisibilityConditions', HAZARD_VISIBILITY_CONDITIONS),
  listIn('affectedUserGroups', REPORTER_MODES),
  listIn('behavioralImpactTypes', BEHAVIORAL_IMPACT_TYPES),
  ...locationValidators,
  ...sharedOptionalValidators,
];

const module3Validators = [
  body('concernType').isIn(M3_CONCERN_TYPES),
  body('mobilityActivity').optional().isIn(M3_MOBILITY_ACTIVITIES),
  body('timeOfDayContext').optional().isIn(TIME_OF_DAY),
  body('perceivedRiskLevel').optional().isInt({ min: 1, max: 5 }),
  body('repeatExposure').optional().isIn(REPEAT_EXPOSURE_LEVELS),
  body('socialContext').optional().isIn(SOCIAL_CONTEXTS),
  listIn('environmentalContext', M3_ENVIRONMENTAL_CONTEXT),
  listIn('behavioralAdaptations', BEHAVIORAL_ADAPTATIONS),
  listIn('interventionPreferences', INTERVENTION_PREFERENCES),
  ...locationValidators,
  ...sharedOptionalValidators,
];

/* ----------------------------------------------------------------------- */
/*  Rate limiters                                                          */
/* ----------------------------------------------------------------------- */

// 30 reports / hour across all modules (per IP).
const createIncidentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many reports from this IP, please try again later.' },
});

// 10 exports / hour per IP — tighter than the general API limit so an
// attacker cannot reconstruct raw records through overlapping small-bbox exports.
const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Export rate limit exceeded, please try again later.' },
});

/* ----------------------------------------------------------------------- */
/*  Reads                                                                  */
/* ----------------------------------------------------------------------- */

router.get('/', optionalAuth, ctrl.getIncidents);
router.get('/stats/summary', optionalAuth, ctrl.getStats);
router.get('/analytics', ctrl.getAnalytics);
router.get('/analytics/hotspots/kde', ctrl.kdeHotspots);
router.get('/analytics/hotspots/getis-ord', ctrl.getisOrdHotspots);
router.get('/analytics/interactions', ctrl.interactionAnalytics);
router.get(
  '/analytics/infrastructure-conditions',
  ctrl.infrastructureConditionAnalytics
);
router.get('/analytics/personal-safety-context', ctrl.personalSafetyContext);
// v4.0 analytics
router.get('/analytics/surrogate-safety', ctrl.surrogateSafetyAnalytics);
router.get('/analytics/hazard-categories', ctrl.hazardCategoryAnalytics);
router.get(
  '/analytics/behavioral-adaptation',
  optionalAuth,
  ctrl.behavioralAdaptationAnalytics
);
router.get('/analytics/demographics', optionalAuth, ctrl.demographicsAnalytics);
router.get('/analytics/pilot/:cohort', ctrl.pilotMetrics);
router.get('/export', exportLimiter, ctrl.exportIncidents);

router.get('/:id', optionalAuth, ctrl.getIncident);

/* ----------------------------------------------------------------------- */
/*  Creates (module-specific)                                              */
/* ----------------------------------------------------------------------- */

// Module 1 — accepts an optional image AND an optional short video clip.
router.post(
  '/accident-conflict',
  createIncidentLimiter,
  optionalAuth,
  mediaUpload,
  processUploadedImage,
  module1Validators,
  ctrl.createAccidentConflict
);

// Module 2 — accepts an optional image AND an optional short video clip.
router.post(
  '/hazard-infrastructure',
  createIncidentLimiter,
  optionalAuth,
  mediaUpload,
  processUploadedImage,
  module2Validators,
  ctrl.createHazardInfrastructure
);

router.post(
  '/personal-safety',
  createIncidentLimiter,
  optionalAuth,
  module3Validators,
  ctrl.createPersonalSafety
);

// Backwards-compatible legacy POST.
router.post(
  '/',
  createIncidentLimiter,
  optionalAuth,
  upload.single('image'),
  processUploadedImage,
  ctrl.createIncident
);

router.delete('/:id', protect, ctrl.deleteIncident);

module.exports = router;
// Exported for unit-testing — not used by the HTTP surface.
module.exports.listIn = listIn;
