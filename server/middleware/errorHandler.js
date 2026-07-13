/**
 * Express error handler — surfaces validation, multer, and generic errors
 * in a consistent JSON shape. Always last middleware in the chain.
 */
module.exports = (err, _req, res, _next) => {
  console.error(err);

  // Multer file-size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large' });
  }
  // Multer or our custom file filter rejection
  if (err.message?.startsWith('Only JPEG')) {
    return res.status(400).json({ error: err.message });
  }
  // Mongoose validation
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
};
