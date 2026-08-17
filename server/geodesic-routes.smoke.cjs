const assert = require('assert');
const { registerGeodesicRoutes } = require('./geodesic-routes.js');

const routes = new Map();
const app = {
    post(route, handler) {
        routes.set(route, handler);
    }
};
const addon = {
    loadMesh(meshId, vertices, faces) {
        return meshId === 'mesh' && vertices.length === 9 && faces.length === 3;
    },
    query(meshId) {
        if (meshId === 'missing') return { status: false, distance: 0, path: [], error: 'mesh not found' };
        return {
            status: true,
            distance: 1,
            error: '',
            path: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }]
        };
    }
};
registerGeodesicRoutes(app, { addon });

const invoke = (route, body) => {
    const response = {
        statusCode: 200,
        body: null,
        status(statusCode) {
            this.statusCode = statusCode;
            return this;
        },
        json(value) {
            this.body = value;
            return this;
        }
    };
    routes.get(route)({ body }, response);
    return response;
};

assert.deepStrictEqual([...routes.keys()].sort(), [
    '/api/v2/geodesic/exact',
    '/api/v2/geodesic/load'
]);
const invalidLoad = invoke('/api/v2/geodesic/load', {});
assert.strictEqual(invalidLoad.statusCode, 400);
assert.strictEqual(invalidLoad.body.code, 'INVALID_GEODESIC_MESH');
const loaded = invoke('/api/v2/geodesic/load', {
    mesh_id: 'mesh',
    vertices: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    faces: [0, 1, 2]
});
assert.strictEqual(loaded.statusCode, 200);
assert.strictEqual(loaded.body.status, true);
const exact = invoke('/api/v2/geodesic/exact', {
    mesh_id: 'mesh',
    x1: 0,
    y1: 0,
    z1: 0,
    x2: 1,
    y2: 0,
    z2: 0
});
assert.strictEqual(exact.statusCode, 200);
assert.strictEqual(exact.body.distance, 1);
const missing = invoke('/api/v2/geodesic/exact', {
    mesh_id: 'missing',
    x1: 0,
    y1: 0,
    z1: 0,
    x2: 1,
    y2: 0,
    z2: 0
});
assert.strictEqual(missing.statusCode, 404);
assert.strictEqual(missing.body.code, 'GEODESIC_MESH_NOT_FOUND');

console.log('Exact geodesic route smoke test passed');
