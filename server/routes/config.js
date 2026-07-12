const express = require('express');
const router = express.Router();

// Deployment capability advertisement consumed by the client at boot.
router.get('/', (_req, res) => {
  res.json({
    version: '5.0.0',
    platform: 'PedestrianPath',
    module3Enabled: process.env.MODULE_3_ENABLED !== 'false',
    features: {
      // Unified Pedestrian Mobility Platform capabilities.
      routePlanner: true,
      walkabilityEngine: true,
      incidentReporting: true,
      analytics: true,
    },
  });
});

module.exports = router;
