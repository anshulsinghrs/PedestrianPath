const mongoose = require('mongoose');

/**
 * v4.0 Incident schema.
 *
 * Three reporting modules share one collection, distinguished by the
 * required `module` discriminator. Enums are deliberately additive over
 * the v3.0 taxonomy — historical records continue to parse and render.
 *
 * Canonical companion docs:
 *   - docs/REPORTING_WORKFLOWS_V4.md — workflow + analytics ontology
 *   - docs/taxonomy.md               — legacy v3.0 reference
 *   - docs/MODULE_3_DESIGN.md        — safeguarding rules for Module 3
 */

// ---- Module discriminator ----
const MODULES = ['accident_conflict', 'hazard_infrastructure', 'personal_safety'];

// ---- Reporter / interaction taxonomy ----
// v4.0 expands the reporter set to capture e-mobility, transit, assistive
// mobility and observer perspectives. Add new values to the END of the
// list — order is part of the public API.
const REPORTER_MODES = [
  'pedestrian',
  'cyclist',
  'ebike_scooter',
  'two_wheeler',
  'car_driver',
  'public_transport',
  'wheelchair',
  'observer',
  'other',
];

const INTERACTING_MODES = [
  ...REPORTER_MODES.filter((m) => m !== 'observer'),
  'bus',
  'truck',
  'auto_rickshaw',
  'heavy_vehicle',
  'animal',
  'none',
];

const INTERACTION_TYPES = [
  'overtaking',
  'turning_conflict',
  'crossing_conflict',
  'right_of_way',
  'dooring',
  'head_on',
  'rear_end',
  'merging',
  'none',
];

// ---- Module 1 ----
const M1_INCIDENT_TYPES = [
  'collision',
  'near_miss',
  'solo_fall',
  'forced_evasive',
  'aggressive_interaction',
  'mode_conflict',
  'other',
];

const COLLISION_TYPES = [
  'rear_end',
  'side_swipe',
  'turning_conflict',
  'left_turn_conflict',
  'right_turn_conflict',
  'overtaking_collision',
  'lane_merge',
  'dooring',
  'signal_violation',
  'crossing_conflict',
  'parking_conflict',
  'wrong_way',
  'head_on',
  'other',
];

const NEAR_MISS_TYPES = [
  'forced_to_brake',
  'forced_to_swerve',
  'close_pass',
  'left_hook',
  'right_hook',
  'door_opened',
  'pulled_out_in_front',
  'reversed_into_path',
  'crossing_conflict',
  'other',
];

const EVASIVE_ACTIONS = [
  'hard_braking',
  'swerving',
  'sudden_acceleration',
  'dismount',
  'jumped_aside',
  'verbal_warning',
  'horn_bell',
  'no_action_possible',
  'other',
];

const SOLO_FALL_CONTRIBUTORS = [
  'surface_defect',
  'wet_slippery',
  'loose_debris',
  'pothole',
  'tram_track',
  'curb_edge',
  'avoiding_other_user',
  'mechanical_failure',
  'visibility',
  'speed_too_high_for_conditions',
  'unknown',
  'other',
];

// ---- Module 2 ----
const HAZARD_CATEGORIES = [
  'surface_structural',
  'accessibility_pathway',
  'cycling_micromobility',
  'visibility_environmental',
  'traffic_environment',
];

const M2_HAZARD_TYPES = [
  // Surface & structural
  'pothole',
  'uneven_surface',
  'slippery_surface',
  'cracked_pavement',
  'loose_gravel',
  'broken_road_edge',
  'damaged_sidewalk',
  'open_drain_gap',
  'surface_debris',
  'waterlogging',
  // Accessibility & pathway
  'blocked_sidewalk',
  'encroachment',
  'illegal_parking',
  'vendor_obstruction',
  'missing_footpath',
  'broken_curb_ramp',
  'accessibility_barrier',
  'narrow_walking_space',
  'unsafe_shared_path',
  // Cycling & micromobility
  'missing_bike_lane',
  'bike_lane_obstruction',
  'unsafe_lane_merge',
  'sudden_lane_termination',
  'shared_lane_conflict',
  'unsafe_overtaking_space',
  // Visibility & environmental
  'poor_lighting',
  'blind_corner',
  'vegetation_obstruction',
  'visibility_obstruction',
  'flooding',
  'poor_drainage',
  'fog_smoke',
  'glare',
  // Traffic environment
  'high_speed_traffic',
  'aggressive_traffic_environment',
  'unsafe_crossing',
  'signal_timing_problem',
  'missing_traffic_control',
  'construction_activity',
  'congestion',
  'unsafe_intersection_design',
  // Legacy v3.0 values still in production data
  'blocked_path',
  'faded_markings',
  'construction_hazard',
  'missing_crossing',
  'visibility_problem',
  'unsafe_geometry',
  'temporary_obstruction',
  // Generic
  'other',
];

const HAZARD_DURATIONS = [
  'just_appeared',
  'within_week',
  'few_weeks',
  'months',
  'over_year',
  'unknown',
];

const HAZARD_VISIBILITY_CONDITIONS = [
  'daytime',
  'nighttime',
  'rain',
  'fog',
  'snow_ice',
  'glare',
  'crowded',
  'high_speed_traffic',
  'always_visible',
];

const BEHAVIORAL_IMPACT_TYPES = [
  'near_misses',
  'falls',
  'crashes',
  'route_avoidance',
  'time_avoidance',
  'mode_change',
  'perceived_unsafety',
  'travel_with_others',
  'stopped_travelling_here',
];

// ---- Module 3 ----
const M3_CONCERN_TYPES = [
  'harassment',
  'verbal_abuse',
  'aggressive_behavior',
  'threatening_environment',
  'unsafe_group_presence',
  'stalking',
  'theft_concern',
  'unsafe_transit_stop',
  'drunk_disorderly',
  'isolated_environment',
  'poorly_active_street',
  'unsafe_crossing_environment',
  // Legacy v3.0 values still in production data
  'unsafe_behaviour',
  'theft',
  'unsafe_route_experience',
  'other',
];

const M3_MOBILITY_ACTIVITIES = [
  'walking',
  'cycling',
  'using_escooter',
  'riding_two_wheeler',
  'waiting_for_transit',
  'crossing_street',
  'using_transit',
  'traveling_alone',
  'traveling_with_others',
  'other',
];

const M3_ENVIRONMENTAL_CONTEXT = [
  'poor_lighting',
  'isolated_area',
  'lack_of_pedestrian_activity',
  'abandoned_street',
  'construction_zone',
  'high_speed_traffic',
  'poor_visibility',
  'lack_of_surveillance',
  'unsafe_crossing_design',
  'narrow_walking_area',
  'other',
];

const BEHAVIORAL_ADAPTATIONS = [
  'avoid_route',
  'avoid_nighttime',
  'stop_walking_cycling_here',
  'change_travel_time',
  'use_alternative_transport',
  'travel_only_with_others',
  'no_change',
];

const INTERVENTION_PREFERENCES = [
  'better_lighting',
  'safer_crossing',
  'traffic_calming',
  'more_pedestrian_activity',
  'better_visibility',
  'wider_walkways',
  'active_shops_businesses',
  'security_presence',
  'better_transit_access',
  'other',
];

const REPEAT_EXPOSURE_LEVELS = [
  'first_time',
  'a_few_times',
  'often',
  'always',
  'unknown',
];

const SOCIAL_CONTEXTS = [
  'alone',
  'with_one_other',
  'with_group',
  'with_children',
  'with_dependents',
  'other',
];

const TIME_OF_DAY = [
  'early_morning',
  'morning',
  'midday',
  'afternoon',
  'evening',
  'night',
  'late_night',
];

const CROWD_LEVELS = ['empty', 'sparse', 'moderate', 'crowded', 'unknown'];

// ---- Shared ----
const SEVERITIES = ['minor', 'moderate', 'major', 'fatal'];
const INJURY_LEVELS = ['none', 'minor', 'serious', 'severe', 'fatal'];
const WEATHER = ['clear', 'rain', 'fog', 'snow', 'wind', 'storm', 'unknown'];
const LIGHTING = ['daylight', 'dusk', 'dawn', 'dark_lit', 'dark_unlit', 'unknown'];

const ROAD_TYPES = [
  'highway',
  'arterial',
  'residential',
  'shared_path',
  'bike_lane',
  'footpath',
  'pedestrian_zone',
  'intersection',
  'roundabout',
  'transit_stop',
  'unknown',
];

const CROSSING_TYPES = [
  'none',
  'zebra',
  'signalized',
  'pelican',
  'overpass',
  'underpass',
  'mid_block',
  'school_crossing',
  'unmarked',
];

const TRIP_PURPOSES = [
  'commute',
  'school',
  'leisure',
  'errands',
  'exercise',
  'work_travel',
  'other',
];

const SPEED_CATEGORIES = ['stationary', 'walking', 'jogging', 'cycling', 'fast'];

const INFRA_CONTRIBUTING_FACTORS = [
  'missing_signal',
  'damaged_surface',
  'obstructed_view',
  'inadequate_lighting',
  'narrow_footpath',
  'no_curb_ramp',
  'surface_flooding',
  'missing_crossing',
  'unsafe_geometry',
  'temporary_obstruction',
  'poor_signage',
  'other',
];

// ---- Demographics ----
const AGE_GROUPS = [
  'under_18',
  '18_24',
  '25_34',
  '35_44',
  '45_54',
  '55_64',
  '65_plus',
  'prefer_not_to_say',
];

const GENDERS = [
  'woman',
  'man',
  'non_binary',
  'self_describe',
  'prefer_not_to_say',
];

const MODE_USAGE_FREQUENCY = [
  'daily',
  'few_times_week',
  'weekly',
  'occasionally',
  'rarely',
  'never',
];

const DATA_PROVENANCE = ['synthetic_seed', 'pilot', 'production', 'imported'];

const LEGACY_TYPES = [
  'collision',
  'near_miss',
  'unsafe_crossing',
  'vehicle_conflict',
  'harassment',
  'poor_lighting',
  'footpath_obstruction',
  'road_surface',
  'speeding_vehicles',
  'accessibility_issue',
  'hazard',
  'theft',
];

// PII patterns mirrored from docs/MODULE_3_DESIGN.md §4.
const PII_PATTERNS = [
  { name: 'email', re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, sub: '[redacted-email]' },
  { name: 'phone_intl', re: /\+\d{1,4}[\s\-.]?\(?\d{1,4}\)?[\s\-.]?\d{3,4}[\s\-.]?\d{3,4}/g, sub: '[redacted-phone]' },
  { name: 'phone_in', re: /(?:\+?91[\s\-]?)?[6-9]\d{9}\b/g, sub: '[redacted-phone]' },
  { name: 'phone_generic', re: /\b\d{7,15}\b/g, sub: '[redacted-number]' },
  { name: 'name_pattern', re: /\b(?:named|called|name is)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g, sub: '[redacted-name]' },
];

function scrubPII(text) {
  if (!text || typeof text !== 'string') return text;
  let out = text;
  for (const p of PII_PATTERNS) out = out.replace(p.re, p.sub);
  return out;
}

// Demographics sub-document — all fields optional, no PII permitted.
const demographicsSchema = new mongoose.Schema(
  {
    ageGroup: { type: String, enum: AGE_GROUPS, default: undefined },
    gender: { type: String, enum: GENDERS, default: undefined },
    modeUsageFrequency: {
      type: String,
      enum: MODE_USAGE_FREQUENCY,
      default: undefined,
    },
  },
  { _id: false }
);

const incidentSchema = new mongoose.Schema(
  {
    // ----- v4.0 module discriminator -----
    module: { type: String, enum: MODULES, required: true, index: true },

    // Legacy top-level type (read-only since v3.0)
    type: { type: String, enum: LEGACY_TYPES, index: true },

    // ----- Module 1 fields -----
    reporterMode: { type: String, enum: REPORTER_MODES, index: true },
    interactingMode: { type: String, enum: INTERACTING_MODES, default: 'none' },
    interactionType: { type: String, enum: INTERACTION_TYPES, default: 'none' },
    interactingModes: {
      type: [String],
      enum: INTERACTING_MODES,
      default: [],
    },
    incidentType: { type: String, enum: M1_INCIDENT_TYPES },
    collisionType: { type: String, enum: COLLISION_TYPES, default: undefined },
    nearMissType: { type: String, enum: NEAR_MISS_TYPES, default: undefined },
    evasiveAction: { type: String, enum: EVASIVE_ACTIONS, default: undefined },
    soloFallContributors: {
      type: [String],
      enum: SOLO_FALL_CONTRIBUTORS,
      default: [],
    },
    perceivedDangerScale: { type: Number, min: 1, max: 5 },
    affectsFutureRoute: { type: Boolean, default: null },
    repeatLocationHistory: {
      type: String,
      enum: REPEAT_EXPOSURE_LEVELS,
      default: undefined,
    },
    indirectContribution: { type: Boolean, default: null },

    // ----- Module 2 fields -----
    hazardCategory: { type: String, enum: HAZARD_CATEGORIES, index: true },
    hazardType: { type: String, enum: M2_HAZARD_TYPES, index: true },
    hazardSeverityPerceived: { type: Number, min: 1, max: 5 },
    hazardDuration: { type: String, enum: HAZARD_DURATIONS },
    hazardVisibilityConditions: {
      type: [String],
      enum: HAZARD_VISIBILITY_CONDITIONS,
      default: [],
    },
    affectedUserGroups: {
      type: [String],
      enum: REPORTER_MODES,
      default: [],
    },
    behaviorAffected: { type: Boolean, default: null },
    behavioralImpactTypes: {
      type: [String],
      enum: BEHAVIORAL_IMPACT_TYPES,
      default: [],
    },

    // ----- Module 3 fields -----
    concernType: { type: String, enum: M3_CONCERN_TYPES },
    mobilityActivity: { type: String, enum: M3_MOBILITY_ACTIVITIES },
    environmentalContext: {
      type: [String],
      enum: M3_ENVIRONMENTAL_CONTEXT,
      default: [],
    },
    timeOfDayContext: { type: String, enum: TIME_OF_DAY },
    crowdLevel: { type: String, enum: CROWD_LEVELS, default: 'unknown' },
    perceivedRiskLevel: { type: Number, min: 1, max: 5 },
    behavioralAdaptations: {
      type: [String],
      enum: BEHAVIORAL_ADAPTATIONS,
      default: [],
    },
    interventionPreferences: {
      type: [String],
      enum: INTERVENTION_PREFERENCES,
      default: [],
    },
    repeatExposure: { type: String, enum: REPEAT_EXPOSURE_LEVELS },
    socialContext: { type: String, enum: SOCIAL_CONTEXTS },
    // Module 3 conditional-branch fields
    transitStopLit: { type: Boolean, default: null },
    transitWaitMinutes: { type: Number, min: 0, max: 600 },
    transitOthersWaiting: { type: String, enum: CROWD_LEVELS },
    crossingSignal: { type: Boolean, default: null },
    crossingVehicleYielded: { type: Boolean, default: null },

    // ----- Shared core -----
    severity: { type: String, enum: SEVERITIES, default: 'minor', index: true },
    injuryLevel: { type: String, enum: INJURY_LEVELS, default: 'none' },
    description: { type: String, trim: true, maxlength: 2000 },
    incidentDate: { type: Date, required: true, index: true },

    // ----- Reporter context -----
    tripPurpose: { type: String, enum: TRIP_PURPOSES },
    speedCategory: { type: String, enum: SPEED_CATEGORIES },

    // ----- Environmental context -----
    weather: { type: String, enum: WEATHER, default: 'unknown' },
    lightingCondition: { type: String, enum: LIGHTING, default: 'unknown' },
    roadType: { type: String, enum: ROAD_TYPES, default: 'unknown' },

    // ----- Crossing-specific -----
    crossingType: { type: String, enum: CROSSING_TYPES },
    signalAvailable: { type: Boolean, default: null },
    waitingTimeSeconds: { type: Number, min: 0, max: 600 },
    vehicleYielded: { type: Boolean, default: null },
    footpathWidthMeters: { type: Number, min: 0, max: 50 },
    accessibilityRating: { type: Number, min: 1, max: 5 },
    schoolZone: { type: Boolean, default: false },
    pedestrianDensity: {
      type: String,
      enum: ['low', 'medium', 'high', 'unknown'],
      default: 'unknown',
    },

    // ----- Location -----
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (v) =>
            Array.isArray(v) &&
            v.length === 2 &&
            v[0] >= -180 &&
            v[0] <= 180 &&
            v[1] >= -90 &&
            v[1] <= 90,
          message: 'coordinates must be [lng, lat] with valid ranges',
        },
      },
    },
    address: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
    thumbnailUrl: { type: String, trim: true },
    videoUrl: { type: String, trim: true },
    // AI image-analysis predictions (services/vision). Best-effort; never
    // stored for personal-safety reports (no images there — see pre-save).
    aiAnalysis: { type: mongoose.Schema.Types.Mixed, default: null },

    // ----- Infrastructure linkage -----
    linkedInfrastructure: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'Infrastructure' },
    ],
    infrastructureContributingFactors: {
      type: [String],
      enum: INFRA_CONTRIBUTING_FACTORS,
      default: [],
    },

    // ----- Demographics (optional, anonymous) -----
    demographics: { type: demographicsSchema, default: undefined },

    // ----- Provenance & derived fields -----
    dataProvenance: {
      type: String,
      enum: DATA_PROVENANCE,
      default: 'production',
      index: true,
    },
    pilotCohort: { type: String, trim: true, index: true },
    nearMissOnly: { type: Boolean, default: false, index: true },
    reportingLatencyMinutes: { type: Number, default: null },

    // Schema version stamp — helps downstream pipelines reject old records.
    schemaVersion: { type: String, default: '4.0', index: true },

    // ----- Reporter identity & consent -----
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isAnonymous: { type: Boolean, default: true },
    consentForResearch: { type: Boolean, default: true },
    exportSuppressed: { type: Boolean, default: false, index: true },

    // ----- ML / analytics -----
    riskScore: { type: Number, min: 0, max: 100, default: null },

    // ----- Admin moderation -----
    adminFlagged: { type: Boolean, default: false, index: true },
    adminFlagReason: { type: String, default: null },
    adminFlaggedAt: { type: Date, default: null },
    adminFlaggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    adminApprovedAt: { type: Date, default: null },
    adminApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

incidentSchema.pre('save', function (next) {
  if (this.module === 'personal_safety') {
    this.reporter = null;
    this.isAnonymous = true;
    this.imageUrl = undefined;
    this.thumbnailUrl = undefined;
    this.videoUrl = undefined;
    this.aiAnalysis = null;
  }

  this.nearMissOnly =
    this.incidentType === 'near_miss' || this.type === 'near_miss';

  if (this.incidentDate) {
    const created = this.createdAt || new Date();
    this.reportingLatencyMinutes = Math.max(
      0,
      Math.round((created.getTime() - new Date(this.incidentDate).getTime()) / 60000)
    );
  }

  next();
});

incidentSchema.index({ location: '2dsphere' });
incidentSchema.index({ module: 1, incidentDate: -1 });
incidentSchema.index({ reporterMode: 1, incidentDate: -1 });
incidentSchema.index({ hazardCategory: 1, hazardType: 1 });

incidentSchema.virtual('lat').get(function () {
  return this.location?.coordinates?.[1];
});
incidentSchema.virtual('lng').get(function () {
  return this.location?.coordinates?.[0];
});

incidentSchema.set('toJSON', { virtuals: true });
incidentSchema.set('toObject', { virtuals: true });

const Incident = mongoose.model('Incident', incidentSchema);

module.exports = Incident;
module.exports.MODULES = MODULES;
module.exports.REPORTER_MODES = REPORTER_MODES;
module.exports.INTERACTING_MODES = INTERACTING_MODES;
module.exports.INTERACTION_TYPES = INTERACTION_TYPES;
module.exports.M1_INCIDENT_TYPES = M1_INCIDENT_TYPES;
module.exports.COLLISION_TYPES = COLLISION_TYPES;
module.exports.NEAR_MISS_TYPES = NEAR_MISS_TYPES;
module.exports.EVASIVE_ACTIONS = EVASIVE_ACTIONS;
module.exports.SOLO_FALL_CONTRIBUTORS = SOLO_FALL_CONTRIBUTORS;
module.exports.HAZARD_CATEGORIES = HAZARD_CATEGORIES;
module.exports.M2_HAZARD_TYPES = M2_HAZARD_TYPES;
module.exports.HAZARD_DURATIONS = HAZARD_DURATIONS;
module.exports.HAZARD_VISIBILITY_CONDITIONS = HAZARD_VISIBILITY_CONDITIONS;
module.exports.BEHAVIORAL_IMPACT_TYPES = BEHAVIORAL_IMPACT_TYPES;
module.exports.M3_CONCERN_TYPES = M3_CONCERN_TYPES;
module.exports.M3_MOBILITY_ACTIVITIES = M3_MOBILITY_ACTIVITIES;
module.exports.M3_ENVIRONMENTAL_CONTEXT = M3_ENVIRONMENTAL_CONTEXT;
module.exports.BEHAVIORAL_ADAPTATIONS = BEHAVIORAL_ADAPTATIONS;
module.exports.INTERVENTION_PREFERENCES = INTERVENTION_PREFERENCES;
module.exports.REPEAT_EXPOSURE_LEVELS = REPEAT_EXPOSURE_LEVELS;
module.exports.SOCIAL_CONTEXTS = SOCIAL_CONTEXTS;
module.exports.TIME_OF_DAY = TIME_OF_DAY;
module.exports.CROWD_LEVELS = CROWD_LEVELS;
module.exports.SEVERITIES = SEVERITIES;
module.exports.INJURY_LEVELS = INJURY_LEVELS;
module.exports.WEATHER = WEATHER;
module.exports.LIGHTING = LIGHTING;
module.exports.ROAD_TYPES = ROAD_TYPES;
module.exports.CROSSING_TYPES = CROSSING_TYPES;
module.exports.TRIP_PURPOSES = TRIP_PURPOSES;
module.exports.SPEED_CATEGORIES = SPEED_CATEGORIES;
module.exports.INFRA_CONTRIBUTING_FACTORS = INFRA_CONTRIBUTING_FACTORS;
module.exports.AGE_GROUPS = AGE_GROUPS;
module.exports.GENDERS = GENDERS;
module.exports.MODE_USAGE_FREQUENCY = MODE_USAGE_FREQUENCY;
module.exports.DATA_PROVENANCE = DATA_PROVENANCE;
module.exports.LEGACY_TYPES = LEGACY_TYPES;
module.exports.scrubPII = scrubPII;
module.exports.PII_PATTERNS = PII_PATTERNS;
