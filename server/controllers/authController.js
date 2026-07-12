const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const emailService = require('../services/email');

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const newVerificationToken = () => crypto.randomBytes(32).toString('hex');

const publicUser = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  mobilityMode: u.mobilityMode,
  preferredTravelMode: u.preferredTravelMode,
  accessibilityNeeds: u.accessibilityNeeds,
  consentForResearch: u.consentForResearch,
  locale: u.locale,
  pilotCohort: u.pilotCohort,
});

/**
 * POST /api/auth/register
 *
 * Creates an UNVERIFIED account and sends a verification email. The
 * client doesn't receive a JWT here — the user has to click the
 * verification link first, which is what /verify-email returns the
 * JWT on.
 */
exports.register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const {
      name,
      email,
      password,
      mobilityMode,
      preferredTravelMode,
      accessibilityNeeds,
      consentForResearch,
    } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const pilotCohort = req.get('X-Pilot-Cohort') || req.body.pilotCohort;
    const verificationToken = newVerificationToken();
    const user = await User.create({
      name,
      email,
      password,
      mobilityMode: mobilityMode || 'pedestrian',
      preferredTravelMode: preferredTravelMode || mobilityMode || 'pedestrian',
      accessibilityNeeds: accessibilityNeeds || [],
      consentForResearch: !!consentForResearch,
      pilotCohort: pilotCohort || undefined,
      emailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: new Date(Date.now() + VERIFICATION_TTL_MS),
    });

    try {
      await emailService.sendVerificationEmail({
        to: user.email,
        name: user.name,
        token: verificationToken,
      });
    } catch (mailErr) {
      // Don't 500 the registration if the email service is misconfigured
      // or down — surface a soft warning so the client knows to use
      // /resend-verification. The account exists and the token is in
      // the DB; nothing is lost.
      console.error('[auth.register] email send failed:', mailErr.message);
      return res.status(201).json({
        message: 'Account created, but the verification email could not be sent. Please try again.',
        emailSent: false,
        email: user.email,
      });
    }

    res.status(201).json({
      message: 'Account created. Check your email to verify your address.',
      emailSent: true,
      email: user.email,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/verify-email/:token
 * (also accepts POST with { token } in body for flexibility)
 *
 * Looks up the user by token, ensures it hasn't expired, marks
 * verified, returns a JWT so the user is logged in on success.
 */
exports.verifyEmail = async (req, res, next) => {
  try {
    const token = req.params.token || req.body?.token;
    if (!token) return res.status(400).json({ error: 'Missing verification token' });

    const user = await User.findOne({ emailVerificationToken: token }).select(
      '+emailVerificationToken +emailVerificationExpires'
    );
    if (!user) return res.status(400).json({ error: 'Invalid or expired verification link' });
    if (user.emailVerificationExpires && user.emailVerificationExpires < new Date()) {
      return res.status(400).json({ error: 'Verification link has expired' });
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    const jwtToken = signToken(user._id);
    res.json({ token: jwtToken, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/resend-verification
 *
 * Issues a fresh verification token + email for an unverified account.
 * Returns a generic message regardless of whether the email exists, to
 * avoid leaking which addresses are registered.
 */
exports.resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Missing email' });

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    const generic = { message: 'If that account exists and is unverified, a new link has been sent.' };

    if (!user || user.emailVerified) return res.json(generic);

    user.emailVerificationToken = newVerificationToken();
    user.emailVerificationExpires = new Date(Date.now() + VERIFICATION_TTL_MS);
    await user.save();

    try {
      await emailService.sendVerificationEmail({
        to: user.email,
        name: user.name,
        token: user.emailVerificationToken,
      });
    } catch (mailErr) {
      console.error('[auth.resendVerification] email send failed:', mailErr.message);
      return res.status(502).json({ error: 'Could not send email. Please try again later.' });
    }
    res.json(generic);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 */
exports.login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    // password has select:false in the schema, so we need explicit +password
    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    if (!user.emailVerified) {
      return res.status(403).json({
        error: 'Please verify your email before signing in.',
        code: 'email_unverified',
        email: user.email,
      });
    }

    const token = signToken(user._id);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me
 * Returns the currently authenticated user (requires auth middleware)
 */
exports.me = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(publicUser(user));
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/auth/me
 * Updates the current user's mobility profile
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const fields = [
      'name',
      'mobilityMode',
      'preferredTravelMode',
      'accessibilityNeeds',
      'consentForResearch',
      'locale',
    ];
    for (const f of fields) {
      if (req.body[f] !== undefined) user[f] = req.body[f];
    }
    await user.save();
    res.json(publicUser(user));
  } catch (err) {
    next(err);
  }
};
