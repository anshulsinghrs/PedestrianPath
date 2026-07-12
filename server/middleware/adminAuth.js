const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware that requires a valid JWT whose user has isAdmin === true.
 * Must be placed after any auth middleware that sets req.user, or used
 * standalone (it re-validates the token itself).
 */
module.exports = async function adminAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const user = await User.findById(decoded.id).select('+isAdmin');
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (!user.isAdmin) return res.status(403).json({ error: 'Admin access required' });

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};
