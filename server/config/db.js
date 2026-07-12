const mongoose = require('mongoose');

/**
 * Connect to MongoDB. Designed for Render Free + Atlas M0, where the
 * very first dial after a cold start occasionally times out before
 * Atlas accepts the connection.
 *
 * Two behaviours that matter:
 *
 *   1. **Retries with backoff.** A single transient failure no longer
 *      sinks the boot. We try a handful of times before giving up.
 *
 *   2. **Never exit on failure.** The Express app keeps listening even
 *      if Mongo is unreachable, so `/api/health` can honestly report
 *      `db: 'down'` (503) and the frontend banner shows a meaningful
 *      message. Mongoose's driver keeps trying to reconnect in the
 *      background, so the service heals automatically once Atlas is
 *      reachable again — no Render restart needed.
 */
const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.warn('⚠️  MONGO_URI not set — running without a database connection.');
    return;
  }

  mongoose.connection.on('error', (err) => {
    console.error(`MongoDB connection error: ${err.message}`);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected — driver will retry automatically.');
  });
  mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB reconnected.');
  });

  const maxAttempts = 5;
  const baseDelayMs = 2000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 15000,
      });
      console.log(`✅ MongoDB connected: ${conn.connection.host}`);
      return;
    } catch (err) {
      const isLast = attempt === maxAttempts;
      const delay = baseDelayMs * 2 ** (attempt - 1);
      console.error(
        `❌ MongoDB connection attempt ${attempt}/${maxAttempts} failed: ${err.message}` +
          (isLast ? '' : ` — retrying in ${delay} ms`)
      );
      if (!isLast) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  console.error(
    '❌ MongoDB unreachable after retries. Server stays up so /api/health ' +
      'can report db:down; the driver will keep retrying in the background.'
  );
};

module.exports = connectDB;
