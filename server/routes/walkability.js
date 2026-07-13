const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/walkabilityController');

router.get('/weights', ctrl.weights);
router.post('/score', ctrl.score);
router.get('/heatmap', ctrl.heatmap);

module.exports = router;
