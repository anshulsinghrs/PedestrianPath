const Incident = require('../models/Incident');
const User = require('../models/User');

/* ----------------------------------------------------------------------- */
/*  Incident moderation                                                    */
/* ----------------------------------------------------------------------- */

/** GET /api/admin/incidents?status=pending&limit=50&page=1 */
exports.listIncidents = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status === 'flagged') filter.adminFlagged = true;
    if (req.query.module) filter.module = req.query.module;

    const [incidents, total] = await Promise.all([
      Incident.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('reporter', 'name email'),
      Incident.countDocuments(filter),
    ]);

    res.json({ total, page, limit, incidents });
  } catch (err) {
    next(err);
  }
};

/** PATCH /api/admin/incidents/:id/flag */
exports.flagIncident = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const incident = await Incident.findByIdAndUpdate(
      req.params.id,
      {
        adminFlagged: true,
        adminFlagReason: reason || 'No reason given',
        adminFlaggedAt: new Date(),
        adminFlaggedBy: req.user._id,
      },
      { new: true }
    );
    if (!incident) return res.status(404).json({ error: 'Incident not found' });

    req.app.get('io')?.emit('admin:incident:flagged', { id: incident._id, reason });
    res.json(incident);
  } catch (err) {
    next(err);
  }
};

/** PATCH /api/admin/incidents/:id/approve */
exports.approveIncident = async (req, res, next) => {
  try {
    const incident = await Incident.findByIdAndUpdate(
      req.params.id,
      {
        adminFlagged: false,
        adminFlagReason: null,
        adminApprovedAt: new Date(),
        adminApprovedBy: req.user._id,
      },
      { new: true }
    );
    if (!incident) return res.status(404).json({ error: 'Incident not found' });
    res.json(incident);
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/admin/incidents/:id */
exports.deleteIncident = async (req, res, next) => {
  try {
    const incident = await Incident.findByIdAndDelete(req.params.id);
    if (!incident) return res.status(404).json({ error: 'Incident not found' });
    req.app.get('io')?.emit('admin:incident:deleted', { id: req.params.id });
    res.json({ message: 'Incident deleted', id: req.params.id });
  } catch (err) {
    next(err);
  }
};

/* ----------------------------------------------------------------------- */
/*  Audit log                                                              */
/* ----------------------------------------------------------------------- */

/** GET /api/admin/audit — returns flagged + approved actions, newest first */
exports.auditLog = async (req, res, next) => {
  try {
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 100));

    const flagged = await Incident.find(
      { adminFlaggedAt: { $exists: true } },
      { _id: 1, module: 1, adminFlagged: 1, adminFlagReason: 1, adminFlaggedAt: 1, adminFlaggedBy: 1, adminApprovedAt: 1, adminApprovedBy: 1 }
    )
      .sort({ adminFlaggedAt: -1 })
      .limit(limit)
      .populate('adminFlaggedBy', 'name email')
      .populate('adminApprovedBy', 'name email');

    res.json({ entries: flagged });
  } catch (err) {
    next(err);
  }
};

/* ----------------------------------------------------------------------- */
/*  k-anonymity cell sizes — admin view shows raw cell counts              */
/* ----------------------------------------------------------------------- */

/** GET /api/admin/privacy/cell-sizes?cellSizeM=100 */
exports.cellSizes = async (req, res, next) => {
  try {
    const { applyKAnonymity } = require('../services/privacy');
    const cellSizeM = Math.max(10, parseInt(req.query.cellSizeM, 10) || 100);

    const records = await Incident.find(
      { consentForResearch: true, exportSuppressed: { $ne: true } },
      { location: 1, incidentDate: 1, module: 1, reporterMode: 1, hazardType: 1, concernType: 1 }
    )
      .limit(50000)
      .lean();

    const { rows, manifest } = applyKAnonymity(records, { k: 1, cellSizeM, temporal: 'month' });
    const smallCells = rows.filter((r) => r.n_incidents < 5).length;

    res.json({ manifest, cellCount: rows.length, smallCellsBelow5: smallCells, cellSizeM });
  } catch (err) {
    next(err);
  }
};

/* ----------------------------------------------------------------------- */
/*  Stats summary for admin dashboard                                      */
/* ----------------------------------------------------------------------- */

/** GET /api/admin/stats */
exports.stats = async (req, res, next) => {
  try {
    const [total, byModule, flagged, users] = await Promise.all([
      Incident.countDocuments(),
      Incident.aggregate([{ $group: { _id: '$module', count: { $sum: 1 } } }]),
      Incident.countDocuments({ adminFlagged: true }),
      User.countDocuments(),
    ]);

    res.json({ total, byModule, flagged, users });
  } catch (err) {
    next(err);
  }
};
