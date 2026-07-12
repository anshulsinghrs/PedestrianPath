const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/routeController');
const { optionalAuth } = require('../middleware/auth');

// Route planning is available to guests; optionalAuth attaches the user
// when a token is present so future features (saved routes) can use it.
router.post('/plan', optionalAuth, ctrl.plan);
router.get('/profiles', ctrl.profiles);

module.exports = router;
