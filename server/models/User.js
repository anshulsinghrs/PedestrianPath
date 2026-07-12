const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// v3.0 reporter modes — the closed four-value set. Cars/buses/trucks/auto-rickshaws
// are not reporter modes; see docs/taxonomy.md §1.
const REPORTER_MODES = ['pedestrian', 'cyclist', 'two_wheeler', 'other'];

const ACCESSIBILITY_NEEDS = [
  'none',
  'wheelchair',
  'low_vision',
  'mobility_aid',
  'stroller',
  'service_animal',
  'other',
];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 60,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please use a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false,
    },

    // Mode profile — constrained to the reporter-mode enum.
    mobilityMode: {
      type: String,
      enum: REPORTER_MODES,
      default: 'pedestrian',
    },
    preferredTravelMode: {
      type: String,
      enum: REPORTER_MODES,
      default: 'pedestrian',
    },
    accessibilityNeeds: {
      type: [String],
      enum: ACCESSIBILITY_NEEDS,
      default: [],
    },

    // Research / privacy
    consentForResearch: { type: Boolean, default: false },
    locale: { type: String, default: 'en' },

    // Pilot deployment tagging.
    pilotCohort: { type: String, trim: true, index: true },

    // Module 3 visibility: users may want Module 3 hidden in their UI even
    // when the deployment has it enabled. Default false (Module 3 visible
    // when deployment flag allows).
    module3OptOut: { type: Boolean, default: false },

    // Admin flag — used by Module 3 raw-record reads (see middleware/auth.js).
    // Off by default; promoted manually in the database or via ADMIN_EMAILS.
    isAdmin: { type: Boolean, default: false },

    // Email verification — accounts can be created but cannot log in
    // until the user proves they control the email address. Avoids
    // throw-away signups.
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, index: true, select: false },
    emailVerificationExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

const User = mongoose.model('User', userSchema);
module.exports = User;
module.exports.REPORTER_MODES = REPORTER_MODES;
module.exports.MOBILITY_MODES = REPORTER_MODES; // backwards-compat alias
module.exports.ACCESSIBILITY_NEEDS = ACCESSIBILITY_NEEDS;
