// v4.0 — JSON-driven schema for the three reporting workflows.
//
// Each module is expressed as an ordered list of `steps`. Each step has
// `fields`, and each field may have:
//   - `type`        ('select' | 'multiselect' | 'radio' | 'scale' | 'text'
//                    | 'textarea' | 'datetime' | 'image' | 'video'
//                    | 'boolean' | 'modeList' | 'group')
//   - `condition`   (function(formState) => boolean) — progressive disclosure
//   - `analytics`   ({variable, scale, ontology}) — for downstream pipelines
//   - `optional`    (bool, defaults false)
//   - `for`         (subset of reporter modes the field applies to)
//
// The schema is consumed by `DynamicReportForm` and by the analytics
// pipeline's variable dictionary. See docs/REPORTING_WORKFLOWS_V4.md.

import {
  REPORTER_MODES,
  reporterModeLabels,
  reporterModeEmoji,
  INTERACTING_MODES,
  interactingModeLabels,
  M1_INCIDENT_TYPES,
  m1IncidentLabels,
  m1IncidentEmoji,
  COLLISION_TYPES,
  collisionTypeLabels,
  NEAR_MISS_TYPES,
  nearMissTypeLabels,
  EVASIVE_ACTIONS,
  evasiveActionLabels,
  SOLO_FALL_CONTRIBUTORS,
  soloFallContributorLabels,
  SEVERITIES,
  severityLabels,
  INJURY_LEVELS,
  injuryLevelLabels,
  weatherOptions,
  lightingOptions,
  roadTypes,
  crossingTypes,
  INFRA_CONTRIBUTING_FACTORS,
  factorLabels,
  HAZARD_CATEGORIES,
  hazardCategoryLabels,
  hazardCategoryEmoji,
  HAZARD_TYPES_BY_CATEGORY,
  m2HazardLabels,
  HAZARD_DURATIONS,
  hazardDurationLabels,
  HAZARD_VISIBILITY_CONDITIONS,
  hazardVisibilityLabels,
  BEHAVIORAL_IMPACT_TYPES,
  behavioralImpactLabels,
  M3_CONCERN_TYPES,
  m3ConcernLabels,
  M3_MOBILITY_ACTIVITIES,
  m3MobilityActivityLabels,
  M3_ENVIRONMENTAL_CONTEXT,
  m3EnvironmentLabels,
  TIME_OF_DAY,
  timeOfDayLabels,
  CROWD_LEVELS,
  crowdLevelLabels,
  BEHAVIORAL_ADAPTATIONS,
  behavioralAdaptationLabels,
  INTERVENTION_PREFERENCES,
  interventionPreferenceLabels,
  REPEAT_EXPOSURE_LEVELS,
  repeatExposureLabels,
  SOCIAL_CONTEXTS,
  socialContextLabels,
  AGE_GROUPS,
  ageGroupLabels,
  GENDERS,
  genderLabels,
  MODE_USAGE_FREQUENCY,
  modeUsageFrequencyLabels,
  labelize,
} from './incidentTypes.js';

// ---------------------------------------------------------------------------
//  Field-construction helpers
// ---------------------------------------------------------------------------

const toOptions = (values, labels = {}, emoji = {}) =>
  values.map((v) => ({
    value: v,
    label: labels[v] || labelize(v),
    emoji: emoji[v] || null,
  }));

// ---------------------------------------------------------------------------
//  Shared demographic step (Part 5)
// ---------------------------------------------------------------------------

const demographicsStep = {
  id: 'demographics',
  title: 'About you',
  optional: true,
  collapsible: true,
  hint:
    'These help researchers understand who experiences urban mobility risk. ' +
    'Everything here is optional and stored anonymously.',
  fields: [
    {
      name: 'demographics.ageGroup',
      label: 'Age group',
      type: 'select',
      optional: true,
      options: toOptions(AGE_GROUPS, ageGroupLabels),
      analytics: { variable: 'age_group', scale: 'ordinal' },
    },
    {
      name: 'demographics.gender',
      label: 'Gender',
      type: 'select',
      optional: true,
      options: toOptions(GENDERS, genderLabels),
      analytics: { variable: 'gender', scale: 'nominal' },
    },
    {
      name: 'demographics.modeUsageFrequency',
      label: 'How often do you use your primary mode in this city?',
      type: 'select',
      optional: true,
      options: toOptions(MODE_USAGE_FREQUENCY, modeUsageFrequencyLabels),
      analytics: { variable: 'mode_usage_frequency', scale: 'ordinal' },
    },
  ],
};

// ---------------------------------------------------------------------------
//  Module 1 — Mobility conflict & surrogate safety
// ---------------------------------------------------------------------------

const module1Schema = {
  module: 'accident_conflict',
  title: 'Report a mobility conflict',
  subtitle: 'Collision, near-miss, fall, or unsafe interaction',
  fastPathSeconds: 30,
  steps: [
    {
      id: 'reporter_context',
      title: 'Reporting as',
      fields: [
        {
          name: 'reporterMode',
          label: 'You were',
          type: 'radio',
          required: true,
          options: toOptions(REPORTER_MODES, reporterModeLabels, reporterModeEmoji),
          analytics: { variable: 'reporter_mode', scale: 'nominal' },
        },
      ],
    },
    {
      id: 'incident_type',
      title: 'What happened?',
      fields: [
        {
          name: 'incidentType',
          label: 'Incident type',
          type: 'radio',
          required: true,
          options: toOptions(M1_INCIDENT_TYPES, m1IncidentLabels, m1IncidentEmoji),
          analytics: { variable: 'incident_type', scale: 'nominal' },
        },
      ],
    },

    // ---------- Collision branch ----------
    {
      id: 'collision_details',
      title: 'Collision details',
      condition: (f) => f.incidentType === 'collision',
      fields: [
        {
          name: 'interactingModes',
          label: 'Interaction between (add every mode involved)',
          type: 'modeList',
          required: true,
          options: toOptions(INTERACTING_MODES, interactingModeLabels),
          analytics: {
            variable: 'interacting_modes',
            scale: 'multi-nominal',
          },
        },
        {
          name: 'collisionType',
          label: 'Type of collision',
          type: 'select',
          required: true,
          options: toOptions(COLLISION_TYPES, collisionTypeLabels),
          analytics: { variable: 'collision_type', scale: 'nominal' },
        },
        {
          name: 'severity',
          label: 'Severity',
          type: 'select',
          required: true,
          options: toOptions(SEVERITIES, severityLabels),
          analytics: { variable: 'severity', scale: 'ordinal' },
        },
        {
          name: 'injuryLevel',
          label: 'Injury level',
          type: 'select',
          optional: true,
          options: toOptions(INJURY_LEVELS, injuryLevelLabels),
          analytics: { variable: 'injury_level', scale: 'ordinal' },
        },
        {
          name: 'perceivedDangerScale',
          label: 'Perceived danger (1 = low, 5 = extreme)',
          type: 'scale',
          min: 1,
          max: 5,
          required: true,
          analytics: { variable: 'perceived_danger', scale: 'likert-5' },
        },
      ],
    },

    // ---------- Near-miss branch ----------
    {
      id: 'near_miss_details',
      title: 'Near-miss details',
      condition: (f) => f.incidentType === 'near_miss',
      fields: [
        {
          name: 'nearMissType',
          label: 'Type of near miss',
          type: 'select',
          required: true,
          options: toOptions(NEAR_MISS_TYPES, nearMissTypeLabels),
          analytics: { variable: 'near_miss_type', scale: 'nominal' },
        },
        {
          name: 'interactingModes',
          label: 'Other party (mode)',
          type: 'modeList',
          required: true,
          options: toOptions(INTERACTING_MODES, interactingModeLabels),
        },
        {
          name: 'evasiveAction',
          label: 'Evasive action taken',
          type: 'select',
          required: true,
          options: toOptions(EVASIVE_ACTIONS, evasiveActionLabels),
          analytics: { variable: 'evasive_action', scale: 'nominal' },
        },
        {
          name: 'perceivedDangerScale',
          label: 'Perceived unsafety (1–5)',
          type: 'scale',
          min: 1,
          max: 5,
          required: true,
          analytics: { variable: 'perceived_unsafety', scale: 'likert-5' },
        },
        {
          name: 'affectsFutureRoute',
          label: 'Did this affect your future route choice?',
          type: 'boolean',
          optional: true,
          analytics: {
            variable: 'route_choice_impact',
            scale: 'boolean',
          },
        },
        {
          name: 'repeatLocationHistory',
          label: 'Has this happened here before?',
          type: 'select',
          optional: true,
          options: toOptions(REPEAT_EXPOSURE_LEVELS, repeatExposureLabels),
          analytics: { variable: 'repeat_exposure', scale: 'ordinal' },
        },
      ],
    },

    // ---------- Solo fall branch ----------
    {
      id: 'solo_fall_details',
      title: 'Solo fall details',
      condition: (f) => f.incidentType === 'solo_fall',
      fields: [
        {
          name: 'soloFallContributors',
          label: 'What contributed to the fall?',
          type: 'multiselect',
          required: true,
          options: toOptions(SOLO_FALL_CONTRIBUTORS, soloFallContributorLabels),
          analytics: {
            variable: 'solo_fall_contributors',
            scale: 'multi-nominal',
          },
        },
        {
          name: 'indirectContribution',
          label: 'Did another road user contribute indirectly?',
          type: 'boolean',
          optional: true,
          analytics: {
            variable: 'indirect_third_party',
            scale: 'boolean',
          },
        },
        {
          name: 'roadType',
          label: 'Location type',
          type: 'select',
          required: true,
          options: toOptions(roadTypes),
          analytics: { variable: 'road_type', scale: 'nominal' },
        },
        {
          name: 'injuryLevel',
          label: 'Injury severity',
          type: 'select',
          required: true,
          options: toOptions(INJURY_LEVELS, injuryLevelLabels),
          analytics: { variable: 'injury_level', scale: 'ordinal' },
        },
      ],
    },

    // ---------- Forced-evasive / aggressive branches share these prompts ----------
    {
      id: 'evasive_aggressive_details',
      title: 'Conflict details',
      condition: (f) =>
        f.incidentType === 'forced_evasive' ||
        f.incidentType === 'aggressive_interaction' ||
        f.incidentType === 'mode_conflict',
      fields: [
        {
          name: 'interactingModes',
          label: 'Other party (mode)',
          type: 'modeList',
          required: true,
          options: toOptions(INTERACTING_MODES, interactingModeLabels),
        },
        {
          name: 'evasiveAction',
          label: 'Evasive action taken',
          type: 'select',
          optional: true,
          options: toOptions(EVASIVE_ACTIONS, evasiveActionLabels),
        },
        {
          name: 'perceivedDangerScale',
          label: 'Perceived danger (1–5)',
          type: 'scale',
          min: 1,
          max: 5,
          required: true,
          analytics: { variable: 'perceived_danger', scale: 'likert-5' },
        },
      ],
    },

    // ---------- Shared environmental context ----------
    //
    // Weather, road type, and lighting are auto-detected from the picked
    // location (Open-Meteo + OSM Overpass). Only infrastructure factors
    // are asked of the user here.
    {
      id: 'environment',
      title: 'Environmental context',
      collapsible: true,
      fields: [
        {
          name: 'infrastructureContributingFactors',
          label: 'Infrastructure factors that contributed',
          type: 'multiselect',
          optional: true,
          options: toOptions(INFRA_CONTRIBUTING_FACTORS, factorLabels),
          analytics: {
            variable: 'infrastructure_factors',
            scale: 'multi-nominal',
          },
        },
      ],
    },

    // ---------- Time + narrative + media ----------
    {
      id: 'when_and_what',
      title: 'When & what',
      fields: [
        {
          name: 'incidentDate',
          label: 'Date & time',
          type: 'datetime',
          required: true,
          analytics: { variable: 'incident_datetime', scale: 'temporal' },
        },
        {
          name: 'description',
          label: 'Narrative (what happened?)',
          type: 'textarea',
          maxLength: 2000,
          optional: true,
          analytics: { variable: 'description_text', scale: 'free-text' },
        },
        {
          name: 'image',
          label: 'Photo (optional)',
          type: 'image',
          optional: true,
        },
        {
          name: 'video',
          label: 'Short video clip (optional)',
          type: 'video',
          optional: true,
        },
      ],
    },

    demographicsStep,
  ],
};

// ---------------------------------------------------------------------------
//  Module 2 — Hazard & infrastructure
// ---------------------------------------------------------------------------

const hazardSubtypeOptions = (form) => {
  const cat = form?.hazardCategory;
  if (!cat) return [];
  return (HAZARD_TYPES_BY_CATEGORY[cat] || []).map((v) => ({
    value: v,
    label: m2HazardLabels[v] || labelize(v),
  }));
};

const module2Schema = {
  module: 'hazard_infrastructure',
  title: 'Report a mobility-relevant hazard',
  subtitle:
    'Infrastructure-linked risk, accessibility, environmental and traffic hazards',
  fastPathSeconds: 25,
  steps: [
    {
      id: 'reporter_context',
      title: 'Reporting as',
      fields: [
        {
          name: 'reporterMode',
          label: 'You usually experience this as',
          type: 'radio',
          required: true,
          options: toOptions(REPORTER_MODES, reporterModeLabels, reporterModeEmoji),
          analytics: { variable: 'reporter_mode', scale: 'nominal' },
        },
      ],
    },
    {
      id: 'hazard_classification',
      title: 'Type of hazard',
      fields: [
        {
          name: 'hazardCategory',
          label: 'Category',
          type: 'radio',
          required: true,
          options: toOptions(
            HAZARD_CATEGORIES,
            hazardCategoryLabels,
            hazardCategoryEmoji
          ),
          analytics: { variable: 'hazard_category', scale: 'nominal' },
        },
        {
          name: 'hazardType',
          label: 'Specific hazard',
          type: 'select',
          required: true,
          dynamicOptions: hazardSubtypeOptions,
          condition: (f) => !!f.hazardCategory,
          analytics: { variable: 'hazard_type', scale: 'nominal' },
        },
      ],
    },
    {
      id: 'hazard_context',
      title: 'Hazard context',
      fields: [
        {
          name: 'hazardSeverityPerceived',
          label: 'Perceived hazard severity (1–5)',
          type: 'scale',
          min: 1,
          max: 5,
          required: true,
          analytics: {
            variable: 'perceived_hazard_severity',
            scale: 'likert-5',
          },
        },
        {
          name: 'affectedUserGroups',
          label: 'Which mobility users are most affected?',
          type: 'multiselect',
          required: true,
          options: toOptions(REPORTER_MODES, reporterModeLabels, reporterModeEmoji),
          analytics: {
            variable: 'affected_user_groups',
            scale: 'multi-nominal',
          },
        },
        {
          name: 'hazardDuration',
          label: 'How long has this issue existed?',
          type: 'select',
          required: true,
          options: toOptions(HAZARD_DURATIONS, hazardDurationLabels),
          analytics: { variable: 'hazard_duration', scale: 'ordinal' },
        },
        {
          name: 'hazardVisibilityConditions',
          label: 'Under what conditions is this hazard most noticeable?',
          type: 'multiselect',
          options: toOptions(
            HAZARD_VISIBILITY_CONDITIONS,
            hazardVisibilityLabels
          ),
          analytics: {
            variable: 'hazard_visibility_conditions',
            scale: 'multi-nominal',
          },
        },
        {
          name: 'incidentDate',
          label: 'Date & time noticed',
          type: 'datetime',
          required: true,
          analytics: { variable: 'incident_datetime', scale: 'temporal' },
        },
      ],
    },
    {
      id: 'environment_context',
      title: 'Environment',
      collapsible: true,
      fields: [
        {
          name: 'infrastructureContributingFactors',
          label: 'Infrastructure factors that compound the hazard',
          type: 'multiselect',
          options: toOptions(INFRA_CONTRIBUTING_FACTORS, factorLabels),
        },
      ],
    },
    {
      id: 'behavioral_impact',
      title: 'Behavioural impact',
      collapsible: true,
      fields: [
        {
          name: 'behaviorAffected',
          label: 'Has this condition affected your mobility behaviour?',
          type: 'boolean',
          analytics: { variable: 'behavior_affected', scale: 'boolean' },
        },
        {
          name: 'behavioralImpactTypes',
          label: 'In what way?',
          type: 'multiselect',
          condition: (f) => f.behaviorAffected === true,
          options: toOptions(BEHAVIORAL_IMPACT_TYPES, behavioralImpactLabels),
          analytics: {
            variable: 'behavioral_impact_types',
            scale: 'multi-nominal',
          },
        },
      ],
    },
    {
      id: 'media_evidence',
      title: 'Photo & description',
      hint: 'A photo is the highest-value piece of evidence for this module.',
      fields: [
        {
          name: 'image',
          label: 'Photo (strongly recommended)',
          type: 'image',
          optional: true,
        },
        {
          name: 'video',
          label: 'Short video (optional)',
          type: 'video',
          optional: true,
        },
        {
          name: 'description',
          label: 'Narrative',
          type: 'textarea',
          optional: true,
          maxLength: 2000,
        },
      ],
    },
    demographicsStep,
  ],
};

// ---------------------------------------------------------------------------
//  Module 3 — Perceived urban safety & mobility deterrence
// ---------------------------------------------------------------------------

const module3Schema = {
  module: 'personal_safety',
  title: 'Report a perceived-safety concern',
  subtitle:
    'Captures mobility deterrence, route avoidance, and behavioural adaptation. ' +
    'Mobility-centred, not crime-centred. Anonymised by design.',
  fastPathSeconds: 45,
  safeguarded: true, // triggers DynamicReportForm to render the M3 chrome
  steps: [
    {
      id: 'mobility_context',
      title: 'What were you doing?',
      fields: [
        {
          name: 'mobilityActivity',
          label: 'Activity',
          type: 'radio',
          required: true,
          options: toOptions(M3_MOBILITY_ACTIVITIES, m3MobilityActivityLabels),
          analytics: { variable: 'mobility_activity', scale: 'nominal' },
        },
      ],
    },
    {
      id: 'concern_type',
      title: 'Type of safety concern',
      fields: [
        {
          name: 'concernType',
          label: 'Concern',
          type: 'radio',
          required: true,
          options: toOptions(M3_CONCERN_TYPES, m3ConcernLabels),
          analytics: { variable: 'concern_type', scale: 'nominal' },
        },
      ],
    },

    // -------- Conditional sub-branches (Step 3 in spec) --------
    {
      id: 'transit_environment',
      title: 'About this transit stop',
      condition: (f) => f.concernType === 'unsafe_transit_stop',
      fields: [
        {
          name: 'transitStopLit',
          label: 'Was the stop adequately lit?',
          type: 'boolean',
          optional: true,
        },
        {
          name: 'transitWaitMinutes',
          label: 'Roughly how long were you waiting? (minutes)',
          type: 'scale',
          min: 0,
          max: 60,
          step: 5,
          optional: true,
          analytics: { variable: 'transit_wait_minutes', scale: 'ratio' },
        },
        {
          name: 'transitOthersWaiting',
          label: 'Were other people waiting nearby?',
          type: 'select',
          optional: true,
          options: toOptions(CROWD_LEVELS, crowdLevelLabels),
        },
      ],
    },
    {
      id: 'harassment_context',
      title: 'Environmental contributors',
      condition: (f) =>
        f.concernType === 'harassment' ||
        f.concernType === 'verbal_abuse' ||
        f.concernType === 'aggressive_behavior' ||
        f.concernType === 'unsafe_group_presence' ||
        f.concernType === 'drunk_disorderly',
      fields: [
        {
          name: 'environmentalContext',
          label: 'Which environmental factors made this feel worse?',
          type: 'multiselect',
          required: true,
          options: toOptions(M3_ENVIRONMENTAL_CONTEXT, m3EnvironmentLabels),
          analytics: {
            variable: 'environmental_context',
            scale: 'multi-nominal',
          },
        },
      ],
    },
    {
      id: 'crossing_context',
      title: 'About this crossing',
      condition: (f) => f.concernType === 'unsafe_crossing_environment',
      fields: [
        {
          name: 'crossingType',
          label: 'Crossing type',
          type: 'select',
          options: toOptions(crossingTypes),
        },
        {
          name: 'crossingSignal',
          label: 'Was there a working pedestrian signal?',
          type: 'boolean',
          optional: true,
        },
        {
          name: 'crossingVehicleYielded',
          label: 'Did vehicles yield?',
          type: 'boolean',
          optional: true,
        },
        {
          name: 'infrastructureContributingFactors',
          label: 'Contributing infrastructure factors',
          type: 'multiselect',
          options: toOptions(INFRA_CONTRIBUTING_FACTORS, factorLabels),
        },
      ],
    },

    {
      id: 'environment_universal',
      title: 'Environment (Step 4)',
      collapsible: true,
      condition: (f) =>
        // already shown to harassment-class branches; show here for the others
        !(
          f.concernType === 'harassment' ||
          f.concernType === 'verbal_abuse' ||
          f.concernType === 'aggressive_behavior' ||
          f.concernType === 'unsafe_group_presence' ||
          f.concernType === 'drunk_disorderly'
        ),
      fields: [
        {
          name: 'environmentalContext',
          label: 'Environmental factors present',
          type: 'multiselect',
          options: toOptions(M3_ENVIRONMENTAL_CONTEXT, m3EnvironmentLabels),
        },
      ],
    },

    {
      id: 'temporal_perceived',
      title: 'When & how unsafe did it feel?',
      fields: [
        {
          name: 'timeOfDayContext',
          label: 'When did this occur?',
          type: 'select',
          required: true,
          options: toOptions(TIME_OF_DAY, timeOfDayLabels),
          analytics: { variable: 'time_of_day', scale: 'ordinal' },
        },
        {
          name: 'perceivedRiskLevel',
          label: 'How unsafe did the environment feel? (1 = slightly, 5 = very)',
          type: 'scale',
          min: 1,
          max: 5,
          required: true,
          analytics: {
            variable: 'perceived_unsafety',
            scale: 'likert-5',
          },
        },
        {
          name: 'crowdLevel',
          label: 'How crowded was it?',
          type: 'select',
          options: toOptions(CROWD_LEVELS, crowdLevelLabels),
        },
        {
          name: 'lightingCondition',
          label: 'Lighting',
          type: 'select',
          options: toOptions(lightingOptions),
        },
      ],
    },

    {
      id: 'behavioral_adaptation',
      title: 'Behavioural adaptation',
      hint:
        'These questions support the behavioural adaptation analysis that ' +
        'underpins mobility-deterrence and route-avoidance research.',
      fields: [
        {
          name: 'behaviorAffected',
          label: 'Did this affect your mobility behaviour?',
          type: 'boolean',
          required: true,
          analytics: { variable: 'behavior_affected', scale: 'boolean' },
        },
        {
          name: 'behavioralAdaptations',
          label: 'Which adaptations did you make?',
          type: 'multiselect',
          condition: (f) => f.behaviorAffected === true,
          options: toOptions(
            BEHAVIORAL_ADAPTATIONS,
            behavioralAdaptationLabels
          ),
          analytics: {
            variable: 'behavioral_adaptations',
            scale: 'multi-nominal',
          },
        },
      ],
    },

    {
      id: 'intervention_preferences',
      title: 'What would help?',
      collapsible: true,
      fields: [
        {
          name: 'interventionPreferences',
          label: 'What improvements would increase your feeling of safety?',
          type: 'multiselect',
          options: toOptions(
            INTERVENTION_PREFERENCES,
            interventionPreferenceLabels
          ),
          analytics: {
            variable: 'intervention_preferences',
            scale: 'multi-nominal',
          },
        },
      ],
    },

    {
      id: 'optional_context',
      title: 'Optional context',
      collapsible: true,
      fields: [
        {
          name: 'repeatExposure',
          label: 'How often does this happen here?',
          type: 'select',
          optional: true,
          options: toOptions(REPEAT_EXPOSURE_LEVELS, repeatExposureLabels),
          analytics: { variable: 'repeat_exposure', scale: 'ordinal' },
        },
        {
          name: 'socialContext',
          label: 'Social context',
          type: 'select',
          optional: true,
          options: toOptions(SOCIAL_CONTEXTS, socialContextLabels),
          analytics: { variable: 'social_context', scale: 'nominal' },
        },
        {
          name: 'description',
          label: 'Brief description',
          type: 'textarea',
          optional: true,
          maxLength: 2000,
        },
      ],
    },

    {
      id: 'consent',
      title: 'How your report is used',
      fields: [
        {
          name: 'consentForResearch',
          label:
            'Include this anonymised report in aggregated safety research',
          type: 'boolean',
          default: true,
        },
        {
          name: 'exportSuppressed',
          label:
            'Do NOT include this report in any research dataset, even aggregated',
          type: 'boolean',
          default: false,
        },
      ],
    },

    demographicsStep,
  ],
};

// ---------------------------------------------------------------------------
//  Public API
// ---------------------------------------------------------------------------

export const REPORTING_SCHEMAS = {
  accident_conflict: module1Schema,
  hazard_infrastructure: module2Schema,
  personal_safety: module3Schema,
};

export function getSchema(moduleKey) {
  return REPORTING_SCHEMAS[moduleKey];
}

/**
 * Resolve which steps should be shown given the current form state. Each
 * returned step is guaranteed to have `condition` satisfied (or no
 * condition at all).
 */
export function visibleSteps(schema, form) {
  return schema.steps.filter((step) =>
    typeof step.condition === 'function' ? step.condition(form) : true
  );
}

/**
 * For a given step, resolve which fields should be rendered (running each
 * field's `condition`, if any, against the current form).
 */
export function visibleFields(step, form) {
  return step.fields
    .filter((f) =>
      typeof f.condition === 'function' ? f.condition(form) : true
    )
    .map((f) =>
      typeof f.dynamicOptions === 'function'
        ? { ...f, options: f.dynamicOptions(form) }
        : f
    );
}

/**
 * Default form-state seed for a module. Uses `default` on fields when
 * provided, otherwise leaves the field undefined.
 */
export function seedFormState(schema) {
  const seed = {};
  for (const step of schema.steps) {
    for (const field of step.fields) {
      if ('default' in field) {
        setDeep(seed, field.name, field.default);
      }
    }
  }
  return seed;
}

function setDeep(obj, dottedKey, value) {
  const keys = dottedKey.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    cur[keys[i]] = cur[keys[i]] || {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

export function getDeep(obj, dottedKey) {
  if (!obj) return undefined;
  return dottedKey.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function updateDeep(obj, dottedKey, value) {
  const next = structuredClone(obj || {});
  setDeep(next, dottedKey, value);
  return next;
}
