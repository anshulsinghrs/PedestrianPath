/**
 * AlertCycle - Urban Mobility Safety Platform
 * Express + MongoDB API for multi-modal road safety reporting
 * (cyclists, pedestrians, wheelchair users, runners, e-scooter riders)
 */
const http = require('http');
const express = require('express');
const { Server: SocketIOServer } = require('socket.io');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const connectDB = require('./config/db');
const incidentRoutes = require('./routes/incidents');
const authRoutes = require('./routes/auth');
const infrastructureRoutes = require('./routes/infrastructure');
const configRoutes = require('./routes/config');
const routeRoutes = require('./routes/routes');
const walkabilityRoutes = require('./routes/walkability');
const visionRoutes = require('./routes/vision');
const errorHandler = require('./middleware/errorHandler');

// ---------------------------------------------------------------------------
// CORS / origin helpers — defined first so Socket.IO can reference them.
//
// Accepted CLIENT_URL patterns:
//   - Literal origin:        https://pathguard.example.com
//   - Name-pinned wildcard:  *.vercel.app  (matches any single-label subdomain)
//   - Open (dev only):       *
//
// When CLIENT_URL is unset the server is CLOSED to all cross-origin requests.
// ---------------------------------------------------------------------------
const allowedOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function matchesOrigin(origin) {
  for (const entry of allowedOrigins) {
    if (entry === '*') return true;
    if (entry === origin) return true;
    if (entry.startsWith('*.')) {
      const suffix = entry.slice(1); // ".vercel.app"
      try {
        const hostname = new URL(origin).hostname;
        // Require at least one label before the suffix to prevent
        // ".vercel.app" from matching "vercel.app" itself.
        if (hostname.endsWith(suffix) && hostname.length > suffix.length)
          return true;
      } catch {
        /* invalid origin URL — deny */
      }
    }
  }
  return false;
}

function originCallback(origin, cb) {
  if (!origin) return cb(null, true); // no Origin header — server-to-server / same-origin
  if (!allowedOrigins.length)
    return cb(new Error('CORS: CLIENT_URL is not configured'));
  if (matchesOrigin(origin)) return cb(null, true);
  return cb(new Error(`CORS: origin ${origin} not allowed`));
}

// ---------------------------------------------------------------------------
// App + HTTP server + Socket.IO
// ---------------------------------------------------------------------------
const app = express();
const httpServer = http.createServer(app);

// Real-time incident broadcasts — same origin policy as REST CORS.
const io = new SocketIOServer(httpServer, {
  cors: { origin: originCallback, credentials: true },
});
// Expose io so controllers can emit events without requiring this module.
app.set('io', io);

// Connect to MongoDB
connectDB();

// Trust proxy (needed when deployed behind Render/Railway/Heroku)
app.set('trust proxy', 1);

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------
app.use(cors({ origin: originCallback, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---------------------------------------------------------------------------
// Health checks — deliberately mounted BEFORE the rate limiter and split into
// liveness vs. readiness. Both matter for staying reachable on Render:
//
//   * Registering these ahead of `apiLimiter` means Render's frequent
//     health polling (and the frontend banner's 30 s probe) can never be
//     throttled to a 429 — a throttled health check would make Render mark
//     the whole service unhealthy and pull it out of rotation.
//
//   * Liveness (/api/health) returns 200 as long as the process is serving
//     requests. This is what Render's `healthCheckPath` targets, so a
//     transient MongoDB outage (e.g. an Atlas IP-allowlist hiccup) degrades
//     gracefully — the API stays reachable and the frontend banner can
//     surface "database unavailable" — instead of the DB outage taking the
//     entire service down and presenting as "backend unreachable".
//
//   * Readiness (/api/health/ready) returns 503 when Mongoose isn't
//     connected, for orchestration or monitoring that wants to gate on the
//     database being up.
// ---------------------------------------------------------------------------
const mongoose = require('mongoose');

function healthBody() {
  const dbUp = mongoose.connection.readyState === 1;
  return {
    dbUp,
    payload: {
      status: dbUp ? 'ok' : 'degraded',
      db: dbUp ? 'up' : 'down',
      schemaVersion: '4.0',
      timestamp: new Date().toISOString(),
    },
  };
}

// Liveness — 200 whenever the process is up, regardless of DB state.
app.get('/api/health', (req, res) => {
  res.status(200).json(healthBody().payload);
});

// Readiness — 503 when the database is not connected.
app.get('/api/health/ready', (req, res) => {
  const { dbUp, payload } = healthBody();
  res.status(dbUp ? 200 : 503).json(payload);
});

// Rate limiting on the API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', apiLimiter);

// ---------------------------------------------------------------------------
// API routes — unversioned (v1–v3 compat) and /api/v4 aliases share the same
// handlers so external consumers can pin to a stable versioned URL.
// ---------------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/infrastructure', infrastructureRoutes);
app.use('/api/config', configRoutes);
// Pedestrian Mobility Platform additions — walkability engine + router.
app.use('/api/routes', routeRoutes);
app.use('/api/walkability', walkabilityRoutes);
app.use('/api/vision', visionRoutes);

app.use('/api/v4/auth', authRoutes);
app.use('/api/v4/incidents', incidentRoutes);
app.use('/api/v4/infrastructure', infrastructureRoutes);
app.use('/api/v4/config', configRoutes);
app.use('/api/v4/routes', routeRoutes);
app.use('/api/v4/walkability', walkabilityRoutes);
app.use('/api/v4/vision', visionRoutes);

// Aliased analytics endpoints under /api/analytics (see docs/API.md).
const incidentCtrl = require('./controllers/incidentController');
app.get('/api/analytics/hotspots/kde', incidentCtrl.kdeHotspots);
app.get('/api/analytics/hotspots/getis-ord', incidentCtrl.getisOrdHotspots);
app.get('/api/analytics/interactions', incidentCtrl.interactionAnalytics);
app.get('/api/analytics/infrastructure-conditions', incidentCtrl.infrastructureConditionAnalytics);
app.get('/api/analytics/personal-safety-context', incidentCtrl.personalSafetyContext);
app.get('/api/analytics/pilot/:cohort', incidentCtrl.pilotMetrics);

// Admin routes
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);
app.use('/api/v4/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`AlertCycle API running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

module.exports = app;
