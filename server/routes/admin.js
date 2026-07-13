const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const ctrl = require('../controllers/adminController');

// All admin routes require admin JWT.
router.use(adminAuth);

router.get('/stats', ctrl.stats);
router.get('/incidents', ctrl.listIncidents);
router.patch('/incidents/:id/flag', ctrl.flagIncident);
router.patch('/incidents/:id/approve', ctrl.approveIncident);
router.delete('/incidents/:id', ctrl.deleteIncident);
router.get('/audit', ctrl.auditLog);
router.get('/privacy/cell-sizes', ctrl.cellSizes);

module.exports = router;
