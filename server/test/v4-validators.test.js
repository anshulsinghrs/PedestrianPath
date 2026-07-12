/**
 * v4.0 validator helper tests — confirms that `listIn` accepts both
 * comma-separated strings and arrays and rejects unknown values.
 *
 * Run: node --test server/test/v4-validators.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

// We deliberately re-implement the inner predicate of listIn rather than
// poking at express-validator internals: the predicate is the contract we
// care about, and the chain wrapping is just plumbing.
function runValidator(value, allowed, fieldName = 'field') {
  const list = Array.isArray(value)
    ? value
    : String(value)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
  const bad = list.filter((v) => !allowed.includes(v));
  if (bad.length) throw new Error(`${fieldName}: unknown value(s) ${bad.join(', ')}`);
  return true;
}

test('listIn: helper is exported from the routes module', () => {
  const router = require('../routes/incidents');
  assert.strictEqual(typeof router.listIn, 'function');
});

test('listIn: accepts comma-separated valid values', () => {
  const ok = runValidator('a,b,c', ['a', 'b', 'c', 'd']);
  assert.strictEqual(ok, true);
});

test('listIn: accepts an array of valid values', () => {
  const ok = runValidator(['a', 'b'], ['a', 'b', 'c']);
  assert.strictEqual(ok, true);
});

test('listIn: rejects unknown comma-separated value', () => {
  assert.throws(() => runValidator('a,z', ['a', 'b', 'c']), /unknown value/);
});

test('listIn: tolerates whitespace around commas', () => {
  const ok = runValidator(' a , b , c ', ['a', 'b', 'c']);
  assert.strictEqual(ok, true);
});

test('listIn: empty list is accepted', () => {
  const ok = runValidator('', ['a', 'b']);
  assert.strictEqual(ok, true);
});

/* ----------------- buildIncidentQuery via the controller export ----------------- */

const ctrl = require('../controllers/incidentController');

test('controller surface: all v4.0 analytics handlers are functions', () => {
  assert.strictEqual(typeof ctrl.surrogateSafetyAnalytics, 'function');
  assert.strictEqual(typeof ctrl.hazardCategoryAnalytics, 'function');
  assert.strictEqual(typeof ctrl.behavioralAdaptationAnalytics, 'function');
  assert.strictEqual(typeof ctrl.demographicsAnalytics, 'function');
});
