const mongoose = require('mongoose');

/**
 * Infrastructure schema — describes a built-environment feature
 * (sidewalk segment, crossing, bike lane, intersection) along with
 * its safety / accessibility attributes. Used for hotspot ranking,
 * unsafe-route detection and academic GIS exports.
 */

const SIDEWALK_CONDITIONS = ['good', 'fair', 'poor', 'absent', 'unknown'];
const CROSSING_SAFETY = ['safe', 'moderate', 'unsafe', 'dangerous', 'unknown'];
const BIKE_LANE_AVAILABILITY = ['protected', 'painted', 'shared', 'none', 'unknown'];
const ACCESSIBILITY_BARRIERS = [
  'none',
  'no_curb_ramp',
  'narrow_path',
  'steep_slope',
  'broken_surface',
  'obstruction',
  'missing_tactile_paving',
  'high_kerb',
];

const FEATURE_TYPES = [
  'sidewalk',
  'crossing',
  'bike_lane',
  'intersection',
  'school_zone',
  'bus_stop',
  'shared_path',
  // OSM-import additions
  'traffic_signal',
  'street_lamp',
  'transit_stop',
  'bike_parking',
  'cycle_lane',
  'footpath',
  'kerb',
  'other',
];

// Provenance — Infrastructure adds `osm_import` over the Incident enum.
const INFRA_DATA_PROVENANCE = [
  'synthetic_seed',
  'pilot',
  'production',
  'imported',
  'osm_import',
];

const infrastructureSchema = new mongoose.Schema(
  {
    featureType: {
      type: String,
      enum: FEATURE_TYPES,
      required: true,
      index: true,
    },
    name: { type: String, trim: true },
    description: { type: String, trim: true, maxlength: 1000 },

    sidewalkCondition: { type: String, enum: SIDEWALK_CONDITIONS, default: 'unknown' },
    crossingSafety: { type: String, enum: CROSSING_SAFETY, default: 'unknown' },
    bikeLaneAvailability: {
      type: String,
      enum: BIKE_LANE_AVAILABILITY,
      default: 'unknown',
    },
    accessibilityBarrier: {
      type: String,
      enum: ACCESSIBILITY_BARRIERS,
      default: 'none',
    },

    schoolZone: { type: Boolean, default: false },
    speedLimitKph: { type: Number, min: 0, max: 200 },

    location: {
      type: { type: String, enum: ['Point'], default: 'Point', required: true },
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

    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // ----- v3.0: OSM integration -----
    osmId: { type: String, index: true, sparse: true },
    osmTags: { type: mongoose.Schema.Types.Mixed },
    lastSyncedAt: { type: Date, default: null },
    dataProvenance: {
      type: String,
      enum: INFRA_DATA_PROVENANCE,
      default: 'production',
      index: true,
    },

    // ----- v3.0: imagery & condition tracking -----
    imageUrls: { type: [String], default: [] },
    thumbnailUrls: { type: [String], default: [] },
    condition: {
      rating: { type: Number, min: 0, max: 5, default: null },
      lastAssessed: { type: Date, default: null },
      assessmentSource: { type: String, trim: true, default: null },
    },
    verifiedBy: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    ],
  },
  { timestamps: true }
);

infrastructureSchema.index({ location: '2dsphere' });

infrastructureSchema.virtual('lat').get(function () {
  return this.location?.coordinates?.[1];
});
infrastructureSchema.virtual('lng').get(function () {
  return this.location?.coordinates?.[0];
});

infrastructureSchema.set('toJSON', { virtuals: true });
infrastructureSchema.set('toObject', { virtuals: true });

const Infrastructure = mongoose.model('Infrastructure', infrastructureSchema);
module.exports = Infrastructure;
module.exports.FEATURE_TYPES = FEATURE_TYPES;
module.exports.SIDEWALK_CONDITIONS = SIDEWALK_CONDITIONS;
module.exports.CROSSING_SAFETY = CROSSING_SAFETY;
module.exports.BIKE_LANE_AVAILABILITY = BIKE_LANE_AVAILABILITY;
module.exports.ACCESSIBILITY_BARRIERS = ACCESSIBILITY_BARRIERS;
module.exports.INFRA_DATA_PROVENANCE = INFRA_DATA_PROVENANCE;
