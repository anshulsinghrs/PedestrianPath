/**
 * AI image-analysis tests — schema normalisation, the heuristic (no-key)
 * provider, provider dispatch/fallback, and JSON extraction. Fully offline:
 * the heuristic provider needs no network, and dispatch is tested against a
 * stub provider.
 *
 * Run: node --test server/test/vision.test.js
 */
const test = require('node:test');
const assert = require('node:assert');
const sharp = require('sharp');

const vision = require('../services/vision');
const schema = require('../services/vision/schema');
const { extractJson } = require('../services/vision/providers/util');

function solidImage(r, g, b) {
  return sharp({ create: { width: 48, height: 32, channels: 3, background: { r, g, b } } })
    .jpeg()
    .toBuffer();
}

test('schema.normalize: coerces booleans, clamps ranges, fills defaults', () => {
  const out = schema.normalize(
    {
      detections: { sidewalk: true, pothole: { present: true, confidence: 2 } },
      walkabilityEstimate: 150,
    },
    'test',
    'test-1'
  );
  assert.strictEqual(out.detections.sidewalk.present, true);
  assert.strictEqual(out.detections.pothole.confidence, 1); // clamped to 1
  assert.strictEqual(out.walkabilityEstimate, 100); // clamped to 100
  assert.ok(schema.SEVERITIES.includes(out.suggestedSeverity));
  assert.strictEqual(out.provider, 'test');
});

test('schema.severityFromDetections: escalates with hazards', () => {
  const minor = schema.severityFromDetections({ sidewalk: { present: true } });
  const worse = schema.severityFromDetections({
    pothole: { present: true },
    obstruction: { present: true },
    lighting: { level: 'poor' },
  });
  assert.strictEqual(minor, 'minor');
  assert.ok(['moderate', 'major'].includes(worse));
});

test('heuristic provider: dark image → poor lighting, bright → good', async () => {
  const dark = await vision.analyzeImage({ buffer: await solidImage(20, 20, 24) });
  const bright = await vision.analyzeImage({ buffer: await solidImage(210, 210, 215) });
  assert.strictEqual(dark.detections.lighting.level, 'poor');
  assert.strictEqual(bright.detections.lighting.level, 'good');
  assert.ok(bright.walkabilityEstimate > dark.walkabilityEstimate);
  assert.strictEqual(dark.provider, 'heuristic');
});

test('resolveProvider: unconfigured provider falls back to heuristic', () => {
  const original = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  const { key, fellBack } = vision.resolveProvider('openai');
  assert.strictEqual(key, 'heuristic');
  assert.strictEqual(fellBack, true);
  if (original) process.env.OPENAI_API_KEY = original;
});

test('analyzeImage: reports fallback note when provider unavailable', async () => {
  const result = await vision.analyzeImage({
    buffer: await solidImage(120, 120, 120),
    provider: 'gemini', // not configured in test env
  });
  assert.match(result.note || '', /unavailable/);
});

test('status: heuristic always configured; detections listed', () => {
  const s = vision.status();
  assert.strictEqual(s.providers.heuristic.configured, true);
  assert.ok(s.detections.includes('pothole'));
});

test('extractJson: handles fenced, bare, and prose-wrapped JSON', () => {
  assert.deepStrictEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepStrictEqual(extractJson('{"a":2}'), { a: 2 });
  assert.deepStrictEqual(extractJson('Here you go: {"a":3} — done'), { a: 3 });
  assert.throws(() => extractJson('no json here'));
});
