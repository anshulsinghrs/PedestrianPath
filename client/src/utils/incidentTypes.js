// v4.0 — Reporting taxonomy aligned with the dynamic reporting workflows.
//
// Sources:
//   - docs/REPORTING_WORKFLOWS_V4.md (canonical workflow + analytics ontology)
//   - docs/taxonomy.md               (historical v3.0 enums, still supported)
//   - server/models/Incident.js      (server-side enum mirror — keep in sync)
//
// Design intent: every label/option here is also a research variable. New
// fields are deliberately additive — v3.0 records continue to render via the
// LEGACY_* maps at the bottom.

// ---------- Modules ----------
export const MODULES = [
  'accident_conflict',
  'hazard_infrastructure',
  'personal_safety',
];

export const moduleLabels = {
  accident_conflict: 'Mobility conflict',
  hazard_infrastructure: 'Hazard & infrastructure',
  personal_safety: 'Perceived urban safety',
};

export const moduleShortLabels = {
  accident_conflict: 'Conflict',
  hazard_infrastructure: 'Hazard',
  personal_safety: 'Perceived safety',
};

export const moduleEmoji = {
  accident_conflict: '🚲',
  hazard_infrastructure: '🚧',
  personal_safety: '🛟',
};

// ---------- Reporter modes (now multimodal) ----------
// v4.0 expands the closed four-value set to capture e-mobility, public
// transport users, assistive-mobility users, and observers.
export const REPORTER_MODES = [
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

export const reporterModeLabels = {
  pedestrian: 'Pedestrian',
  cyclist: 'Cyclist',
  ebike_scooter: 'E-bike / scooter rider',
  two_wheeler: 'Two-wheeler rider',
  car_driver: 'Car driver',
  public_transport: 'Public transport user',
  wheelchair: 'Wheelchair / assistive mobility',
  observer: 'Observer / witness',
  other: 'Other',
};

export const reporterModeEmoji = {
  pedestrian: '🚶',
  cyclist: '🚴',
  ebike_scooter: '🛴',
  two_wheeler: '🛵',
  car_driver: '🚗',
  public_transport: '🚌',
  wheelchair: '♿',
  observer: '👀',
  other: '🛟',
};

export const reporterModeColors = {
  pedestrian: '#22c55e',
  cyclist: '#0ea5e9',
  ebike_scooter: '#10b981',
  two_wheeler: '#a855f7',
  car_driver: '#6b7280',
  public_transport: '#f59e0b',
  wheelchair: '#06b6d4',
  observer: '#94a3b8',
  other: '#94a3b8',
};

// Interacting modes — every reporter mode plus motorised non-VRU traffic.
export const INTERACTING_MODES = [
  ...REPORTER_MODES.filter((m) => m !== 'observer'),
  'bus',
  'truck',
  'auto_rickshaw',
  'heavy_vehicle',
  'animal',
  'none',
];

export const interactingModeLabels = {
  ...reporterModeLabels,
  bus: 'Bus',
  truck: 'Truck',
  auto_rickshaw: 'Auto-rickshaw',
  heavy_vehicle: 'Heavy vehicle',
  animal: 'Animal',
  none: 'No other party (solo)',
};

// ---------- Incident type (Module 1) ----------
export const M1_INCIDENT_TYPES = [
  'collision',
  'near_miss',
  'solo_fall',
  'forced_evasive',
  'aggressive_interaction',
  'mode_conflict',
  'other',
];

export const m1IncidentLabels = {
  collision: 'Collision',
  near_miss: 'Near miss',
  solo_fall: 'Solo fall / loss of control',
  forced_evasive: 'Forced evasive action',
  aggressive_interaction: 'Aggressive / unsafe interaction',
  mode_conflict: 'Mode conflict',
  other: 'Other',
};

export const m1IncidentEmoji = {
  collision: '💥',
  near_miss: '⚠',
  solo_fall: '🤕',
  forced_evasive: '↩',
  aggressive_interaction: '😠',
  mode_conflict: '🚗',
  other: '❓',
};

export const m1IncidentColors = {
  collision: '#dc2626',
  near_miss: '#f59e0b',
  solo_fall: '#0ea5e9',
  forced_evasive: '#f97316',
  aggressive_interaction: '#b91c1c',
  mode_conflict: '#ef4444',
  other: '#94a3b8',
};

// ---------- Collision sub-types (surrogate safety taxonomy) ----------
export const COLLISION_TYPES = [
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

export const collisionTypeLabels = {
  rear_end: 'Rear-end collision',
  side_swipe: 'Side-swipe',
  turning_conflict: 'Turning conflict',
  left_turn_conflict: 'Left-turn conflict',
  right_turn_conflict: 'Right-turn conflict',
  overtaking_collision: 'Overtaking collision',
  lane_merge: 'Lane merge',
  dooring: 'Dooring',
  signal_violation: 'Signal violation',
  crossing_conflict: 'Crossing conflict',
  parking_conflict: 'Parking conflict',
  wrong_way: 'Wrong-way interaction',
  head_on: 'Head-on',
  other: 'Other',
};

// ---------- Near-miss sub-types ----------
export const NEAR_MISS_TYPES = [
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

export const nearMissTypeLabels = {
  forced_to_brake: 'Forced to brake hard',
  forced_to_swerve: 'Forced to swerve',
  close_pass: 'Close pass / overtaking',
  left_hook: 'Left hook',
  right_hook: 'Right hook',
  door_opened: 'Door opened into path',
  pulled_out_in_front: 'Pulled out in front',
  reversed_into_path: 'Reversed into path',
  crossing_conflict: 'Crossing conflict',
  other: 'Other',
};

// ---------- Evasive action taken ----------
export const EVASIVE_ACTIONS = [
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

export const evasiveActionLabels = {
  hard_braking: 'Hard braking',
  swerving: 'Swerving',
  sudden_acceleration: 'Sudden acceleration',
  dismount: 'Dismounted / stepped off vehicle',
  jumped_aside: 'Jumped aside',
  verbal_warning: 'Verbal warning',
  horn_bell: 'Horn / bell',
  no_action_possible: 'No action possible',
  other: 'Other',
};

// ---------- Solo-fall contributors ----------
export const SOLO_FALL_CONTRIBUTORS = [
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

export const soloFallContributorLabels = {
  surface_defect: 'Surface defect',
  wet_slippery: 'Wet / slippery surface',
  loose_debris: 'Loose gravel / debris',
  pothole: 'Pothole',
  tram_track: 'Tram / rail track',
  curb_edge: 'Curb edge / drop',
  avoiding_other_user: 'Avoiding another road user',
  mechanical_failure: 'Vehicle mechanical failure',
  visibility: 'Poor visibility',
  speed_too_high_for_conditions: 'Speed too high for conditions',
  unknown: 'Unknown',
  other: 'Other',
};

// ---------- Interaction types (kept for backwards compat) ----------
export const INTERACTION_TYPES = [
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

export const interactionTypeLabels = {
  overtaking: 'Overtaking',
  turning_conflict: 'Turning conflict',
  crossing_conflict: 'Crossing conflict',
  right_of_way: 'Right-of-way',
  dooring: 'Dooring',
  head_on: 'Head-on',
  rear_end: 'Rear-end',
  merging: 'Merging',
  none: 'None / solo',
};

// ---------- Module 2 — hazard taxonomy ----------
// Five categorical groupings reflect the v4.0 mobility-relevant hazard
// ontology. Each grouping is rendered as its own progressive-disclosure
// branch in the form schema.

export const HAZARD_CATEGORIES = [
  'surface_structural',
  'accessibility_pathway',
  'cycling_micromobility',
  'visibility_environmental',
  'traffic_environment',
];

export const hazardCategoryLabels = {
  surface_structural: 'Surface & structural hazards',
  accessibility_pathway: 'Accessibility & pathway hazards',
  cycling_micromobility: 'Cycling & micromobility hazards',
  visibility_environmental: 'Visibility & environmental hazards',
  traffic_environment: 'Traffic environment hazards',
};

export const hazardCategoryEmoji = {
  surface_structural: '🛣',
  accessibility_pathway: '♿',
  cycling_micromobility: '🚴',
  visibility_environmental: '💡',
  traffic_environment: '🚦',
};

export const HAZARD_TYPES_BY_CATEGORY = {
  surface_structural: [
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
    'other',
  ],
  accessibility_pathway: [
    'blocked_sidewalk',
    'encroachment',
    'illegal_parking',
    'vendor_obstruction',
    'missing_footpath',
    'broken_curb_ramp',
    'accessibility_barrier',
    'narrow_walking_space',
    'unsafe_shared_path',
    'other',
  ],
  cycling_micromobility: [
    'missing_bike_lane',
    'bike_lane_obstruction',
    'unsafe_lane_merge',
    'sudden_lane_termination',
    'shared_lane_conflict',
    'unsafe_overtaking_space',
    'other',
  ],
  visibility_environmental: [
    'poor_lighting',
    'blind_corner',
    'vegetation_obstruction',
    'visibility_obstruction',
    'flooding',
    'poor_drainage',
    'fog_smoke',
    'glare',
    'other',
  ],
  traffic_environment: [
    'high_speed_traffic',
    'aggressive_traffic_environment',
    'unsafe_crossing',
    'signal_timing_problem',
    'missing_traffic_control',
    'construction_activity',
    'congestion',
    'unsafe_intersection_design',
    'other',
  ],
};

// Flat list (server enum mirror).
export const M2_HAZARD_TYPES = Array.from(
  new Set(Object.values(HAZARD_TYPES_BY_CATEGORY).flat())
);

export const m2HazardLabels = {
  // Surface & structural
  pothole: 'Pothole',
  uneven_surface: 'Uneven surface',
  slippery_surface: 'Slippery surface',
  cracked_pavement: 'Cracked pavement',
  loose_gravel: 'Loose gravel',
  broken_road_edge: 'Broken road edge',
  damaged_sidewalk: 'Damaged sidewalk',
  open_drain_gap: 'Open drain / gap',
  surface_debris: 'Surface debris',
  waterlogging: 'Waterlogging',

  // Accessibility & pathway
  blocked_sidewalk: 'Blocked sidewalk',
  encroachment: 'Encroachment',
  illegal_parking: 'Illegal parking',
  vendor_obstruction: 'Vendor obstruction',
  missing_footpath: 'Missing footpath',
  broken_curb_ramp: 'Broken curb ramp',
  accessibility_barrier: 'Accessibility barrier',
  narrow_walking_space: 'Narrow walking space',
  unsafe_shared_path: 'Unsafe shared path',

  // Cycling & micromobility
  missing_bike_lane: 'Missing bike lane',
  bike_lane_obstruction: 'Bike-lane obstruction',
  unsafe_lane_merge: 'Unsafe lane merge',
  sudden_lane_termination: 'Sudden lane termination',
  shared_lane_conflict: 'Shared-lane conflict',
  unsafe_overtaking_space: 'Unsafe overtaking space',

  // Visibility & environmental
  poor_lighting: 'Poor lighting',
  blind_corner: 'Blind corner',
  vegetation_obstruction: 'Vegetation obstruction',
  visibility_obstruction: 'Visibility obstruction',
  flooding: 'Flooding',
  poor_drainage: 'Poor drainage',
  fog_smoke: 'Fog / smoke',
  glare: 'Glare',

  // Traffic environment
  high_speed_traffic: 'High-speed traffic',
  aggressive_traffic_environment: 'Aggressive traffic environment',
  unsafe_crossing: 'Unsafe crossing',
  signal_timing_problem: 'Signal timing problem',
  missing_traffic_control: 'Missing traffic control',
  construction_activity: 'Construction activity',
  congestion: 'Congestion',
  unsafe_intersection_design: 'Unsafe intersection design',

  // Generic
  other: 'Other',
};

// Per-category colours (used by MapView so each hazard family is visually
// distinguishable on the map).
const HAZARD_CATEGORY_COLORS = {
  surface_structural: '#3b82f6',
  accessibility_pathway: '#22c55e',
  cycling_micromobility: '#0ea5e9',
  visibility_environmental: '#6366f1',
  traffic_environment: '#f97316',
};

export const m2HazardColors = M2_HAZARD_TYPES.reduce((acc, t) => {
  for (const [cat, list] of Object.entries(HAZARD_TYPES_BY_CATEGORY)) {
    if (list.includes(t)) {
      acc[t] = HAZARD_CATEGORY_COLORS[cat];
      break;
    }
  }
  return acc;
}, {});

export const m2HazardEmoji = {
  pothole: '🕳',
  damaged_sidewalk: '🚧',
  blocked_sidewalk: '⛔',
  flooding: '💧',
  poor_lighting: '💡',
  missing_bike_lane: '🚴',
  unsafe_crossing: '🚸',
  construction_activity: '🏗',
};

// ---------- Hazard duration ----------
export const HAZARD_DURATIONS = [
  'just_appeared',
  'within_week',
  'few_weeks',
  'months',
  'over_year',
  'unknown',
];

export const hazardDurationLabels = {
  just_appeared: 'Just appeared (today/yesterday)',
  within_week: 'Within the past week',
  few_weeks: 'A few weeks',
  months: 'Several months',
  over_year: 'Over a year',
  unknown: 'Unknown',
};

// ---------- Hazard visibility conditions ----------
export const HAZARD_VISIBILITY_CONDITIONS = [
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

export const hazardVisibilityLabels = {
  daytime: 'During the day',
  nighttime: 'After dark',
  rain: 'During rain',
  fog: 'In fog',
  snow_ice: 'Snow / ice',
  glare: 'Low sun / glare',
  crowded: 'When crowded',
  high_speed_traffic: 'With high-speed traffic',
  always_visible: 'Always — independent of conditions',
};

// ---------- Behavioural impact (Module 2 + 3) ----------
export const BEHAVIORAL_IMPACT_TYPES = [
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

export const behavioralImpactLabels = {
  near_misses: 'Near misses',
  falls: 'Falls',
  crashes: 'Crashes',
  route_avoidance: 'Route avoidance',
  time_avoidance: 'Time-of-day avoidance',
  mode_change: 'Changed transport mode',
  perceived_unsafety: 'Perceived unsafety',
  travel_with_others: 'Started travelling with others',
  stopped_travelling_here: 'Stopped travelling through here',
};

// ---------- Module 3 — perceived safety / mobility deterrence ----------

export const M3_CONCERN_TYPES = [
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
  'unsafe_behaviour',
  'unsafe_route_experience',
  'other',
];

export const m3ConcernLabels = {
  harassment: 'Harassment',
  verbal_abuse: 'Verbal abuse',
  aggressive_behavior: 'Aggressive behaviour',
  threatening_environment: 'Threatening environment',
  unsafe_group_presence: 'Unsafe group presence',
  stalking: 'Stalking / following',
  theft_concern: 'Theft concern',
  unsafe_transit_stop: 'Unsafe transit stop',
  drunk_disorderly: 'Drunk / disorderly behaviour',
  isolated_environment: 'Isolated environment',
  poorly_active_street: 'Poorly active street',
  unsafe_crossing_environment: 'Unsafe crossing environment',
  unsafe_behaviour: 'Unsafe behaviour',
  unsafe_route_experience: 'Unsafe-route experience',
  other: 'Other',
};

// What the reporter was doing — mobility-centred (not crime-centred).
export const M3_MOBILITY_ACTIVITIES = [
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

export const m3MobilityActivityLabels = {
  walking: 'Walking',
  cycling: 'Cycling',
  using_escooter: 'Using an e-scooter',
  riding_two_wheeler: 'Riding a two-wheeler',
  waiting_for_transit: 'Waiting for public transport',
  crossing_street: 'Crossing the street',
  using_transit: 'Using public transport',
  traveling_alone: 'Travelling alone',
  traveling_with_others: 'Travelling with others',
  other: 'Other',
};

// Environmental contributors (Module 3 step 4)
export const M3_ENVIRONMENTAL_CONTEXT = [
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

export const m3EnvironmentLabels = {
  poor_lighting: 'Poor lighting',
  isolated_area: 'Isolated area',
  lack_of_pedestrian_activity: 'Lack of pedestrian activity',
  abandoned_street: 'Abandoned street',
  construction_zone: 'Construction zone',
  high_speed_traffic: 'High-speed traffic',
  poor_visibility: 'Poor visibility',
  lack_of_surveillance: 'Lack of surveillance / "eyes on street"',
  unsafe_crossing_design: 'Unsafe crossing design',
  narrow_walking_area: 'Narrow walking area',
  other: 'Other',
};

// Behavioural adaptation flags (Module 3 step 6)
export const BEHAVIORAL_ADAPTATIONS = [
  'avoid_route',
  'avoid_nighttime',
  'stop_walking_cycling_here',
  'change_travel_time',
  'use_alternative_transport',
  'travel_only_with_others',
  'no_change',
];

export const behavioralAdaptationLabels = {
  avoid_route: 'Avoid this route later',
  avoid_nighttime: 'Avoid nighttime travel',
  stop_walking_cycling_here: 'Stop walking / cycling here',
  change_travel_time: 'Change travel time',
  use_alternative_transport: 'Use alternative transport',
  travel_only_with_others: 'Travel only with others',
  no_change: 'No change in behaviour',
};

// Intervention preferences (Module 3 step 7)
export const INTERVENTION_PREFERENCES = [
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

export const interventionPreferenceLabels = {
  better_lighting: 'Better lighting',
  safer_crossing: 'Safer crossing',
  traffic_calming: 'Traffic calming',
  more_pedestrian_activity: 'More pedestrian activity',
  better_visibility: 'Better visibility',
  wider_walkways: 'Wider walkways',
  active_shops_businesses: 'Active shops / businesses',
  security_presence: 'Security presence',
  better_transit_access: 'Better transit access',
  other: 'Other',
};

// Repeat-exposure + social-context (Module 3 step 8)
export const REPEAT_EXPOSURE_LEVELS = [
  'first_time',
  'a_few_times',
  'often',
  'always',
  'unknown',
];

export const repeatExposureLabels = {
  first_time: 'First time',
  a_few_times: 'A few times',
  often: 'Often',
  always: 'Always when I pass through here',
  unknown: 'Unknown',
};

export const SOCIAL_CONTEXTS = [
  'alone',
  'with_one_other',
  'with_group',
  'with_children',
  'with_dependents',
  'other',
];

export const socialContextLabels = {
  alone: 'Alone',
  with_one_other: 'With one other person',
  with_group: 'With a group',
  with_children: 'With children',
  with_dependents: 'With other dependents',
  other: 'Other',
};

// ---------- Shared: time / crowd / severity ----------
export const TIME_OF_DAY = [
  'early_morning',
  'morning',
  'midday',
  'afternoon',
  'evening',
  'night',
  'late_night',
];
export const timeOfDayLabels = {
  early_morning: 'Early morning (05:00–07:00)',
  morning: 'Morning (07:00–11:00)',
  midday: 'Midday (11:00–14:00)',
  afternoon: 'Afternoon (14:00–17:00)',
  evening: 'Evening (17:00–20:00)',
  night: 'Night (20:00–23:00)',
  late_night: 'Late night (23:00–05:00)',
};

export const CROWD_LEVELS = ['empty', 'sparse', 'moderate', 'crowded', 'unknown'];
export const crowdLevelLabels = {
  empty: 'Empty',
  sparse: 'Sparse',
  moderate: 'Moderate',
  crowded: 'Crowded',
  unknown: 'Unknown',
};

export const SEVERITIES = ['minor', 'moderate', 'major', 'fatal'];
export const severityLabels = {
  minor: 'Minor',
  moderate: 'Moderate',
  major: 'Major',
  fatal: 'Fatal',
};

export const INJURY_LEVELS = ['none', 'minor', 'serious', 'severe', 'fatal'];
export const injuryLevelLabels = {
  none: 'No injury',
  minor: 'Minor injury',
  serious: 'Serious injury',
  severe: 'Severe injury',
  fatal: 'Fatal',
};

// ---------- Environmental / shared ----------
export const tripPurposes = [
  'commute',
  'school',
  'leisure',
  'errands',
  'exercise',
  'work_travel',
  'other',
];

export const speedCategories = [
  'stationary',
  'walking',
  'jogging',
  'cycling',
  'fast',
];

export const weatherOptions = [
  'clear',
  'rain',
  'fog',
  'snow',
  'wind',
  'storm',
  'unknown',
];

export const lightingOptions = [
  'daylight',
  'dusk',
  'dawn',
  'dark_lit',
  'dark_unlit',
  'unknown',
];

export const roadTypes = [
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

export const crossingTypes = [
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

export const INFRA_CONTRIBUTING_FACTORS = [
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

export const factorLabels = {
  missing_signal: 'Missing signal',
  damaged_surface: 'Damaged surface',
  obstructed_view: 'Obstructed view',
  inadequate_lighting: 'Inadequate lighting',
  narrow_footpath: 'Narrow footpath',
  no_curb_ramp: 'No kerb ramp',
  surface_flooding: 'Surface flooding',
  missing_crossing: 'Missing crossing',
  unsafe_geometry: 'Unsafe geometry',
  temporary_obstruction: 'Temporary obstruction',
  poor_signage: 'Poor signage',
  other: 'Other',
};

// ---------- Demographics (optional, shared across all modules) ----------
export const AGE_GROUPS = [
  'under_18',
  '18_24',
  '25_34',
  '35_44',
  '45_54',
  '55_64',
  '65_plus',
  'prefer_not_to_say',
];

export const ageGroupLabels = {
  under_18: 'Under 18',
  '18_24': '18–24',
  '25_34': '25–34',
  '35_44': '35–44',
  '45_54': '45–54',
  '55_64': '55–64',
  '65_plus': '65 +',
  prefer_not_to_say: 'Prefer not to say',
};

export const GENDERS = [
  'woman',
  'man',
  'non_binary',
  'self_describe',
  'prefer_not_to_say',
];

export const genderLabels = {
  woman: 'Woman',
  man: 'Man',
  non_binary: 'Non-binary',
  self_describe: 'Prefer to self-describe',
  prefer_not_to_say: 'Prefer not to say',
};

export const MODE_USAGE_FREQUENCY = [
  'daily',
  'few_times_week',
  'weekly',
  'occasionally',
  'rarely',
  'never',
];

export const modeUsageFrequencyLabels = {
  daily: 'Daily',
  few_times_week: 'A few times a week',
  weekly: 'Weekly',
  occasionally: 'Occasionally',
  rarely: 'Rarely',
  never: 'Never',
};

// ---------- Legacy compatibility ----------
export const LEGACY_TYPES = [
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
];

export const legacyTypeLabels = {
  collision: 'Collision',
  near_miss: 'Near miss',
  unsafe_crossing: 'Unsafe crossing',
  vehicle_conflict: 'Vehicle conflict',
  harassment: 'Harassment',
  poor_lighting: 'Poor lighting',
  footpath_obstruction: 'Footpath obstruction',
  road_surface: 'Road surface',
  speeding_vehicles: 'Speeding vehicles',
  accessibility_issue: 'Accessibility issue',
  hazard: 'Hazard (legacy)',
};

export const legacyTypeColors = {
  collision: '#dc2626',
  near_miss: '#f59e0b',
  unsafe_crossing: '#ec4899',
  vehicle_conflict: '#ef4444',
  harassment: '#a855f7',
  poor_lighting: '#0ea5e9',
  footpath_obstruction: '#14b8a6',
  road_surface: '#3b82f6',
  speeding_vehicles: '#f97316',
  accessibility_issue: '#22c55e',
  hazard: '#3b82f6',
};

// Backwards-compat aliases used by Sidebar/MapView/etc.
export const ALL_TYPES = [
  ...M1_INCIDENT_TYPES,
  ...M2_HAZARD_TYPES,
  ...M3_CONCERN_TYPES,
];
export const typeLabels = { ...m1IncidentLabels, ...legacyTypeLabels };
export const typeColors = { ...m1IncidentColors, ...legacyTypeColors };
export const typeEmoji = { ...m1IncidentEmoji };

export const ALL_MODES = REPORTER_MODES;
export const modeLabels = reporterModeLabels;
export const modeEmoji = reporterModeEmoji;
export const modeColors = reporterModeColors;

// Older code path that imported `roadInteractions` from this module.
export const roadInteractions = [
  'sharing_lane',
  'protected_lane',
  'crossing',
  'merging',
  'parking',
  'pulling_out',
  'other',
];

// ---------- Helpers ----------
const titleCase = (s) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const labelize = (value) => titleCase(value || '');

export function recordPrimaryLabel(incident) {
  if (!incident) return '';
  if (incident.module === 'accident_conflict') {
    return m1IncidentLabels[incident.incidentType] || labelize(incident.incidentType);
  }
  if (incident.module === 'hazard_infrastructure') {
    return m2HazardLabels[incident.hazardType] || labelize(incident.hazardType);
  }
  if (incident.module === 'personal_safety') {
    return m3ConcernLabels[incident.concernType] || labelize(incident.concernType);
  }
  return legacyTypeLabels[incident.type] || labelize(incident.type);
}

export function recordPrimaryColor(incident) {
  if (!incident) return '#94a3b8';
  if (incident.module === 'accident_conflict') {
    return m1IncidentColors[incident.incidentType] || '#94a3b8';
  }
  if (incident.module === 'hazard_infrastructure') {
    return m2HazardColors[incident.hazardType] || '#3b82f6';
  }
  if (incident.module === 'personal_safety') {
    return '#a855f7';
  }
  return legacyTypeColors[incident.type] || '#94a3b8';
}
