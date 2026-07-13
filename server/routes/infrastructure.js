const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/infrastructureController');
const { optionalAuth } = require('../middleware/auth');

router.get('/', ctrl.list);
router.post('/', optionalAuth, ctrl.create);
router.post('/import-osm', optionalAuth, ctrl.importOsm);

module.exports = router;
