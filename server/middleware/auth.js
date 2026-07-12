const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Required auth — rejects with 401 if no/invalid token.
 */
const protect = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Look up the user to surface admin status (Module 3 admin reads).
    const user = await User.findById(decoded.id).select('email isAdmin');
    req.user = {
      id: decoded.id,
      email: user?.email,
      isAdmin: isAdminUser(user),
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Optional auth — populates req.user if a valid token is present,
 * but never blocks the request.
 */
const optionalAuth = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('email isAdmin');
      req.user = {
        id: decoded.id,
        email: user?.email,
        isAdmin: isAdminUser(user),
      };
    } catch {
      /* ignore — treat as anonymous */
    }
  }
  next();
};

/**
 * Admin gate.
 *
 * v3.0 has no admin-management UI: a user is admin if their email is in
 * ADMIN_EMAILS (comma-separated env var) OR if they have user.isAdmin set
 * directly in Mongo.
 */
function isAdminUser(user) {
  if (!user) return false;
  if (user.isAdmin) return true;
  const list = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(String(user.email || '').toLowerCase());
}

const requireAdmin = (req, res, next) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'admin_required' });
  }
  next();
};

module.exports = { protect, optionalAuth, requireAdmin, isAdminUser };
