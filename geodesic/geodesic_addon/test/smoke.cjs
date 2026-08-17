const assert = require('assert');
const geodesic = require('..');

const vertices = [
    0, 0, 0,
    1, 0, 0,
    1, 1, 0,
    0, 1, 0
];
const faces = [0, 1, 2, 0, 2, 3];

assert.strictEqual(geodesic.loadMesh('unit-square', vertices, faces), true);
const result = geodesic.query('unit-square', 0, 0, 0, 1, 1, 0);
assert.strictEqual(result.status, true, result.error);
assert.ok(Array.isArray(result.path) && result.path.length >= 2);
assert.ok(Math.abs(result.distance - Math.sqrt(2)) < 1e-8, `unexpected distance: ${result.distance}`);

// These points lie on opposite boundary edges, so the exact path crosses the
// face interiors instead of following the mesh graph.
const acrossFaces = geodesic.query('unit-square', 0, 0.5, 0, 1, 0.5, 0);
assert.strictEqual(acrossFaces.status, true, acrossFaces.error);
assert.ok(Math.abs(acrossFaces.distance - 1) < 1e-8, `unexpected face path: ${acrossFaces.distance}`);

const missing = geodesic.query('missing', 0, 0, 0, 1, 1, 0);
assert.strictEqual(missing.status, false);
assert.strictEqual(missing.error, 'mesh not found');
assert.strictEqual(geodesic.loadMesh('invalid', [0, 0, 0], [0, 1, 2]), false);

console.log('Exact geodesic addon smoke test passed');
