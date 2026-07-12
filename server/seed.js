/**
 * Seed script — populates the DB with v3.0 module-aware sample data.
 *
 * Module 3 (personal_safety) is NEVER seeded by default. To include it in
 * a synthetic seed for analytics dev only, pass --modules 1,2,3 (the
 * MODULE_3_ENABLED feature flag must also be on in the deployment).
 *
 * Every seeded record carries `dataProvenance: 'synthetic_seed'`.
 *
 * Usage:
 *   node seed.js
 *   node seed.js --city kharagpur --lat 22.345 --lng 87.231 --count 200
 *   node seed.js --modules 1,2
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Incident = require('./models/Incident');
const Infrastructure = require('./models/Infrastructure');

// v4.0 — expanded reporter set; the legacy 4-value set is preserved as
// `LEGACY_REPORTER_MODES` for backward-compat behaviour in fold-down code.
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
const M1_TYPES = [
  'collision',
  'near_miss',
  'solo_fall',
  'forced_evasive',
  'aggressive_interaction',
  'mode_conflict',
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
];

const NEAR_MISS_TYPES = [
  'forced_to_brake',
  'forced_to_swerve',
  'close_pass',
  'left_hook',
  'right_hook',
  'door_opened',
  'pulled_out_in_front',
];

const EVASIVE_ACTIONS = [
  'hard_braking',
  'swerving',
  'sudden_acceleration',
  'dismount',
  'jumped_aside',
];

const SOLO_FALL_CONTRIBUTORS = [
  'surface_defect',
  'wet_slippery',
  'pothole',
  'curb_edge',
  'avoiding_other_user',
];

const HAZARD_CATEGORIES = [
  'surface_structural',
  'accessibility_pathway',
  'cycling_micromobility',
  'visibility_environmental',
  'traffic_environment',
];

const HAZARD_TYPES_BY_CATEGORY = {
  surface_structural: ['pothole', 'uneven_surface', 'damaged_sidewalk', 'waterlogging'],
  accessibility_pathway: [
    'blocked_sidewalk',
    'encroachment',
    'illegal_parking',
    'broken_curb_ramp',
  ],
  cycling_micromobility: [
    'missing_bike_lane',
    'bike_lane_obstruction',
    'shared_lane_conflict',
  ],
  visibility_environmental: ['poor_lighting', 'blind_corner', 'flooding', 'glare'],
  traffic_environment: [
    'high_speed_traffic',
    'aggressive_traffic_environment',
    'unsafe_crossing',
    'congestion',
  ],
};

const HAZARD_DURATIONS = [
  'just_appeared',
  'within_week',
  'few_weeks',
  'months',
  'over_year',
];

const HAZARD_VISIBILITY_CONDITIONS = [
  'daytime',
  'nighttime',
  'rain',
  'crowded',
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
];

const M3_MOBILITY_ACTIVITIES = [
  'walking',
  'cycling',
  'using_escooter',
  'waiting_for_transit',
  'crossing_street',
  'using_transit',
  'traveling_alone',
  'traveling_with_others',
];

const M3_ENVIRONMENTAL_CONTEXT = [
  'poor_lighting',
  'isolated_area',
  'lack_of_pedestrian_activity',
  'poor_visibility',
  'lack_of_surveillance',
];

const BEHAVIORAL_ADAPTATIONS = [
  'avoid_route',
  'avoid_nighttime',
  'stop_walking_cycling_here',
  'change_travel_time',
  'use_alternative_transport',
  'travel_only_with_others',
];

const INTERVENTION_PREFERENCES = [
  'better_lighting',
  'safer_crossing',
  'traffic_calming',
  'more_pedestrian_activity',
  'wider_walkways',
  'security_presence',
  'better_transit_access',
];

const REPEAT_EXPOSURE_LEVELS = ['first_time', 'a_few_times', 'often', 'always'];
const SOCIAL_CONTEXTS = ['alone', 'with_one_other', 'with_group'];

const AGE_GROUPS = ['18_24', '25_34', '35_44', '45_54', '55_64', '65_plus'];
const GENDERS = ['woman', 'man', 'non_binary', 'prefer_not_to_say'];
const MODE_USAGE_FREQUENCY = ['daily', 'few_times_week', 'weekly', 'occasionally'];
const M2_HAZARDS = Object.values(HAZARD_TYPES_BY_CATEGORY).flat();
const M3_CONCERNS = [
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
  'unsafe_crossing_environment',
];

const SEVERITIES = ['minor', 'moderate', 'major', 'fatal'];
const TRIP_PURPOSES = ['commute', 'school', 'leisure', 'errands', 'exercise'];
const WEATHERS = ['clear', 'rain', 'fog', 'clear', 'clear'];
const LIGHTING = ['daylight', 'daylight', 'dark_lit', 'dark_unlit', 'dusk'];
const ROAD_TYPES = [
  'arterial',
  'residential',
  'shared_path',
  'bike_lane',
  'footpath',
  'intersection',
];
const CROSSINGS = ['zebra', 'signalized', 'unmarked', 'mid_block', 'school_crossing'];
const FACTORS = [
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
];

const FEATURE_TYPES = [
  'crossing',
  'bike_lane',
  'sidewalk',
  'school_zone',
  'intersection',
  'bus_stop',
];

const CITY_PRESETS = {
  mumbai: { lat: 19.076, lng: 72.8777 },
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  delhi: { lat: 28.6139, lng: 77.209 },
  kharagpur: { lat: 22.3149, lng: 87.31 },
  london: { lat: 51.5074, lng: -0.1278 },
  amsterdam: { lat: 52.3676, lng: 4.9041 },
};

const TIME_OF_DAY = [
  'early_morning',
  'morning',
  'midday',
  'afternoon',
  'evening',
  'night',
  'late_night',
];

const sample = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomNear = (lat, lng, radiusKm = 10) => {
  const r = radiusKm / 111;
  return [lng + (Math.random() - 0.5) * 2 * r, lat + (Math.random() - 0.5) * 2 * r];
};

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { city: 'mumbai', count: 120, lat: null, lng: null, modules: '1,2' };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--city') opts.city = args[++i];
    else if (a === '--count') opts.count = parseInt(args[++i], 10);
    else if (a === '--lat') opts.lat = parseFloat(args[++i]);
    else if (a === '--lng') opts.lng = parseFloat(args[++i]);
    else if (a === '--modules') opts.modules = args[++i];
  }
  return opts;
}

function buildModule1(center, infra) {
  const reporterMode = sample(REPORTER_MODES.filter((m) => m !== 'observer'));
  const incidentType = sample(M1_TYPES);
  const interactingMode =
    incidentType === 'solo_fall' ? 'none' : sample(INTERACTING_MODES);
  const interactionType =
    incidentType === 'solo_fall' ? 'none' : sample(INTERACTION_TYPES);
  const [lng, lat] = randomNear(center.lat, center.lng, 15);
  const severity = sample(SEVERITIES);

  // Link ~40% to nearest seeded infrastructure.
  let linked = [];
  let factors = [];
  if (Math.random() < 0.4 && infra.length) {
    const nearest = nearestInfra(infra, lat, lng);
    linked = [nearest._id];
    factors = [sample(FACTORS)];
  }

  // v4.0 conditional sub-fields
  const collisionType = incidentType === 'collision' ? sample(COLLISION_TYPES) : undefined;
  const nearMissType =
    incidentType === 'near_miss' ? sample(NEAR_MISS_TYPES) : undefined;
  const evasiveAction =
    incidentType === 'solo_fall'
      ? undefined
      : Math.random() < 0.75
      ? sample(EVASIVE_ACTIONS)
      : undefined;
  const soloFallContributors =
    incidentType === 'solo_fall' ? [sample(SOLO_FALL_CONTRIBUTORS)] : [];
  const interactingModes =
    incidentType === 'solo_fall'
      ? []
      : [interactingMode].filter((m) => m && m !== 'none');

  return {
    module: 'accident_conflict',
    schemaVersion: '4.0',
    reporterMode,
    interactingMode,
    interactingModes,
    interactionType,
    incidentType,
    collisionType,
    nearMissType,
    evasiveAction,
    soloFallContributors,
    perceivedDangerScale: 1 + Math.floor(Math.random() * 5),
    affectsFutureRoute: Math.random() < 0.4,
    repeatLocationHistory: Math.random() < 0.3 ? sample(REPEAT_EXPOSURE_LEVELS) : undefined,
    severity,
    injuryLevel:
      severity === 'fatal'
        ? 'fatal'
        : severity === 'major'
        ? sample(['serious', 'severe'])
        : severity === 'moderate'
        ? 'minor'
        : 'none',
    description: sampleDescriptionM1(incidentType),
    incidentDate: randomDateInLastYear(),
    location: { type: 'Point', coordinates: [lng, lat] },
    tripPurpose: sample(TRIP_PURPOSES),
    weather: sample(WEATHERS),
    lightingCondition: sample(LIGHTING),
    roadType: sample(ROAD_TYPES),
    schoolZone: Math.random() < 0.15,
    pedestrianDensity: sample(['low', 'medium', 'high']),
    isAnonymous: true,
    consentForResearch: true,
    dataProvenance: 'synthetic_seed',
    linkedInfrastructure: linked,
    infrastructureContributingFactors: factors,
    demographics: maybeDemographics(),
  };
}

function maybeDemographics() {
  if (Math.random() < 0.4) return undefined;
  return {
    ageGroup: sample(AGE_GROUPS),
    gender: sample(GENDERS),
    modeUsageFrequency: sample(MODE_USAGE_FREQUENCY),
  };
}

function buildModule2(center, infra) {
  const hazardCategory = sample(HAZARD_CATEGORIES);
  const hazardType = sample(HAZARD_TYPES_BY_CATEGORY[hazardCategory]);
  const [lng, lat] = randomNear(center.lat, center.lng, 15);
  let linked = [];
  let factors = [];
  if (Math.random() < 0.6 && infra.length) {
    const nearest = nearestInfra(infra, lat, lng);
    linked = [nearest._id];
    factors = [sample(FACTORS)];
  }

  const behaviorAffected = Math.random() < 0.55;
  const impacts = behaviorAffected
    ? Array.from({ length: 1 + Math.floor(Math.random() * 2) }, () =>
        sample(BEHAVIORAL_IMPACT_TYPES)
      )
    : [];

  return {
    module: 'hazard_infrastructure',
    schemaVersion: '4.0',
    hazardCategory,
    hazardType,
    hazardSeverityPerceived: 1 + Math.floor(Math.random() * 5),
    hazardDuration: sample(HAZARD_DURATIONS),
    hazardVisibilityConditions: [sample(HAZARD_VISIBILITY_CONDITIONS)],
    affectedUserGroups: [
      sample(REPORTER_MODES.filter((m) => m !== 'observer' && m !== 'other')),
    ],
    behaviorAffected,
    behavioralImpactTypes: Array.from(new Set(impacts)),
    reporterMode: sample(REPORTER_MODES.filter((m) => m !== 'observer')),
    severity: sample(['minor', 'moderate', 'major']),
    description: sampleDescriptionM2(hazardType),
    incidentDate: randomDateInLastYear(),
    location: { type: 'Point', coordinates: [lng, lat] },
    weather: sample(WEATHERS),
    lightingCondition: sample(LIGHTING),
    roadType: sample(ROAD_TYPES),
    schoolZone: Math.random() < 0.15,
    isAnonymous: true,
    consentForResearch: true,
    dataProvenance: 'synthetic_seed',
    linkedInfrastructure: linked,
    infrastructureContributingFactors: factors,
    demographics: maybeDemographics(),
  };
}

function buildModule3(center) {
  const concernType = sample(M3_CONCERNS);
  const [lng, lat] = randomNear(center.lat, center.lng, 12);

  const behaviorAffected = Math.random() < 0.65;
  const adaptations = behaviorAffected
    ? Array.from({ length: 1 + Math.floor(Math.random() * 2) }, () =>
        sample(BEHAVIORAL_ADAPTATIONS)
      )
    : [];

  return {
    module: 'personal_safety',
    schemaVersion: '4.0',
    concernType,
    mobilityActivity: sample(M3_MOBILITY_ACTIVITIES),
    environmentalContext: Array.from(
      { length: 1 + Math.floor(Math.random() * 2) },
      () => sample(M3_ENVIRONMENTAL_CONTEXT)
    ),
    timeOfDayContext: sample(TIME_OF_DAY),
    crowdLevel: sample(['empty', 'sparse', 'moderate', 'crowded']),
    perceivedRiskLevel: 1 + Math.floor(Math.random() * 5),
    behaviorAffected,
    behavioralAdaptations: Array.from(new Set(adaptations)),
    interventionPreferences: [sample(INTERVENTION_PREFERENCES)],
    repeatExposure: sample(REPEAT_EXPOSURE_LEVELS),
    socialContext: sample(SOCIAL_CONTEXTS),
    severity: sample(['minor', 'moderate', 'major']),
    description: '', // never seed Module 3 narratives
    incidentDate: randomDateInLastYear(),
    location: { type: 'Point', coordinates: [lng, lat] },
    lightingCondition: sample(LIGHTING),
    isAnonymous: true,
    consentForResearch: true,
    dataProvenance: 'synthetic_seed',
    demographics: maybeDemographics(),
  };
}

function nearestInfra(infra, lat, lng) {
  return infra
    .map((f) => {
      const [flng, flat] = f.location.coordinates;
      const dlat = (flat - lat) * 111;
      const dlng = (flng - lng) * 111 * Math.cos((lat * Math.PI) / 180);
      return { ...f.toObject?.() ?? f, _id: f._id, d: dlat * dlat + dlng * dlng };
    })
    .sort((a, b) => a.d - b.d)[0];
}

function randomDateInLastYear() {
  return new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000);
}

function sampleDescriptionM1(t) {
  const opts = {
    collision: [
      'Cyclist hit by car turning right without signalling',
      'Pedestrian struck while crossing at unmarked intersection',
      'Two-wheeler clipped by overtaking truck',
    ],
    near_miss: [
      'Car door opened in front of cyclist — swerved to avoid',
      'Bus passed within inches at high speed',
    ],
    solo_fall: [
      'Cyclist hit large pothole and came off',
      'Pedestrian tripped on broken paver',
    ],
    mode_conflict: [
      'Driver merged into bike lane without checking',
      'Bus pulled away while pedestrian was boarding',
    ],
  };
  return sample(opts[t] || ['Reported via seed script']);
}

function sampleDescriptionM2(t) {
  const opts = {
    pothole: ['Large pothole in bike lane'],
    damaged_sidewalk: ['Cracked footpath — trip hazard for elderly'],
    blocked_path: ['Construction debris blocking sidewalk'],
    flooding: ['Standing water blocks footpath after rain'],
    poor_lighting: ['Footpath unlit between bus stop and flats'],
    faded_markings: ['Zebra crossing markings worn away'],
    construction_hazard: ['Exposed rebar at site edge'],
    unsafe_crossing: ['No pedestrian signal at busy intersection'],
    missing_crossing: ['No crossing where one is clearly needed'],
    poor_drainage: ['Standing water due to blocked drain'],
    visibility_problem: ['Vegetation blocks driver sightlines at junction'],
    unsafe_geometry: ['Junction geometry creates conflict'],
    temporary_obstruction: ['Vendor occupying pedestrian path'],
  };
  return sample(opts[t] || ['Reported via seed script']);
}

async function seed() {
  const opts = parseArgs();
  await connectDB();

  const modules = (opts.modules || '1,2')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  console.log(
    `Clearing existing data (city=${opts.city}, count=${opts.count}, modules=${modules.join(',')})...`
  );
  await Incident.deleteMany({});
  await Infrastructure.deleteMany({});

  const preset = CITY_PRESETS[opts.city] || CITY_PRESETS.mumbai;
  const center = {
    lat: Number.isFinite(opts.lat) ? opts.lat : preset.lat,
    lng: Number.isFinite(opts.lng) ? opts.lng : preset.lng,
  };

  // 1) Infrastructure features first.
  const infraDocs = [];
  for (let i = 0; i < 25; i += 1) {
    const [lng, lat] = randomNear(center.lat, center.lng, 8);
    infraDocs.push({
      featureType: sample(FEATURE_TYPES),
      name: `Seed feature #${i + 1}`,
      sidewalkCondition: sample(['good', 'fair', 'poor']),
      crossingSafety: sample(['safe', 'moderate', 'unsafe']),
      bikeLaneAvailability: sample(['protected', 'painted', 'shared', 'none']),
      accessibilityBarrier: sample([
        'none',
        'no_curb_ramp',
        'narrow_path',
        'broken_surface',
      ]),
      schoolZone: Math.random() < 0.25,
      speedLimitKph: sample([30, 40, 50, 60]),
      location: { type: 'Point', coordinates: [lng, lat] },
      dataProvenance: 'synthetic_seed',
      condition: {
        rating: sample([1, 2, 3, 4, 5]),
        lastAssessed: new Date(),
        assessmentSource: 'seed',
      },
    });
  }
  const insertedInfra = await Infrastructure.insertMany(infraDocs);
  console.log(`Seeded ${insertedInfra.length} infrastructure features.`);

  // 2) Incidents by module mix.
  const docs = [];
  for (let i = 0; i < opts.count; i += 1) {
    const r = Math.random();
    if (modules.includes('1') && (r < 0.55 || modules.length === 1)) {
      docs.push(buildModule1(center, insertedInfra));
    } else if (modules.includes('2') && r < 0.9) {
      docs.push(buildModule2(center, insertedInfra));
    } else if (modules.includes('3')) {
      docs.push(buildModule3(center));
    } else {
      docs.push(
        modules.includes('1')
          ? buildModule1(center, insertedInfra)
          : buildModule2(center, insertedInfra)
      );
    }
  }

  await Incident.create(docs);
  console.log(`Seeded ${docs.length} incidents across modules [${modules.join(',')}].`);

  await mongoose.connection.close();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
