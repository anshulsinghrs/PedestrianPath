/**
 * AI image-analysis controller.
 *
 * POST /api/vision/analyze  — analyse an uploaded image (multipart `image`)
 *                             or a JSON body { imageUrl } and return
 *                             normalised VLM predictions.
 * GET  /api/vision/status   — active provider + configured providers.
 *
 * All analysis goes through services/vision, so the provider is swappable
 * via VISION_PROVIDER without touching this controller.
 */
'use strict';

const fs = require('fs');
const vision = require('../services/vision');

exports.status = (_req, res) => {
  res.json(vision.status());
};

exports.analyze = async (req, res, next) => {
  try {
    const provider = req.body?.provider || req.query?.provider;
    let input;
    if (req.file) {
      input = { path: req.file.path, mimeType: req.file.mimetype, provider };
    } else if (req.body?.imageUrl) {
      input = { url: req.body.imageUrl, provider };
    } else {
      return res.status(400).json({
        error: 'Provide an image (multipart field `image`) or a JSON `imageUrl`.',
      });
    }

    const result = await vision.analyzeImage(input);
    res.json(result);
  } catch (err) {
    if (/fetch|network|responded \d/i.test(err.message || '')) {
      return res.status(502).json({ error: 'Vision provider request failed', detail: err.message });
    }
    next(err);
  } finally {
    // Clean up a transient upload made only for analysis (no report attached).
    if (req.file?.path && req.query?.keep !== 'true') {
      fs.promises.unlink(req.file.path).catch(() => {});
    }
  }
};
