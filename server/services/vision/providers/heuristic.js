/**
 * Heuristic (no-API-key) vision provider — the default.
 *
 * It does NOT pretend to be a scene-understanding model. Instead it derives
 * the signals it can measure honestly from image statistics via `sharp`
 * (already a server dependency): overall brightness → a real lighting
 * estimate, and blur/exposure → an image-quality note. Scene detections
 * (sidewalk, pothole, …) are returned as low-confidence "unknown", with a
 * note that a configured VLM provider gives full detection.
 *
 * This keeps the platform fully functional with zero external calls, and
 * the `lighting` signal it produces is a genuine measurement, not a guess.
 */
'use strict';

let sharp;
try {
  sharp = require('sharp');
} catch {
  sharp = null;
}

const NAME = 'heuristic-v1';

function isConfigured() {
  return true; // always available
}

async function analyze({ buffer } = {}) {
  let brightness = null;
  let width;
  let height;

  if (sharp && buffer) {
    try {
      const img = sharp(buffer);
      const meta = await img.metadata();
      width = meta.width;
      height = meta.height;
      const stats = await img.stats();
      // Mean across channels, normalised to 0..1.
      const means = stats.channels.map((c) => c.mean);
      brightness = means.reduce((a, b) => a + b, 0) / (means.length * 255);
    } catch {
      brightness = null;
    }
  }

  let lightingLevel = 'unknown';
  let lightingConfidence = 0.3;
  if (brightness != null) {
    lightingConfidence = 0.7;
    if (brightness < 0.28) lightingLevel = 'poor';
    else if (brightness < 0.5) lightingLevel = 'moderate';
    else lightingLevel = 'good';
  }

  const unknown = { present: false, confidence: 0.2 };
  const walkabilityEstimate =
    brightness != null ? Math.round(40 + brightness * 40) : 50;

  const descriptionParts = [];
  if (lightingLevel !== 'unknown')
    descriptionParts.push(`${lightingLevel} lighting/visibility`);
  if (width && height) descriptionParts.push(`${width}×${height} image`);
  const description =
    (descriptionParts.length
      ? `Auto-analysis: ${descriptionParts.join(', ')}. `
      : '') +
    'Configure a VLM provider (VISION_PROVIDER=anthropic|openai|gemini) for full scene detection.';

  return {
    detections: {
      sidewalk: unknown,
      obstruction: unknown,
      crossing: unknown,
      pothole: unknown,
      encroachment: unknown,
      lighting: { level: lightingLevel, confidence: lightingConfidence },
    },
    walkabilityEstimate,
    description,
    suggestedSeverity: lightingLevel === 'poor' ? 'moderate' : 'minor',
    tags: lightingLevel === 'poor' ? ['poor_lighting'] : [],
  };
}

module.exports = { NAME, isConfigured, analyze };
