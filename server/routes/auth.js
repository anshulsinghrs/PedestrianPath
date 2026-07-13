const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const ctrl = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { MOBILITY_MODES } = require('../models/User');

router.post(
  '/register',
  [
    body('name').trim().isLength({ min: 2, max: 60 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('mobilityMode').optional().isIn(MOBILITY_MODES),
    body('preferredTravelMode').optional().isIn(MOBILITY_MODES),
  ],
  ctrl.register
);

router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').exists()],
  ctrl.login
);

// Email verification — link in the email points here. Also exposed as
// POST for callers (the frontend posts the token from a query param).
router.get('/verify-email/:token', ctrl.verifyEmail);
router.post('/verify-email', ctrl.verifyEmail);
router.post(
  '/resend-verification',
  [body('email').isEmail().normalizeEmail()],
  ctrl.resendVerification
);

router.get('/me', protect, ctrl.me);
router.patch('/me', protect, ctrl.updateProfile);

module.exports = router;
