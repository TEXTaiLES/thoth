const path = require('path');

const GEODESIC_BASE = '/api/v2/geodesic';

const getAddonCandidates = (environment = process.env) => [
    environment.THOTH_GEODESIC_ADDON_PATH,
    path.join(__dirname, '..', 'geodesic', 'geodesic_addon', 'build', 'Release', 'geodesic_addon.node')
].filter(Boolean);

const loadAddon = (options = {}) => {
    if (options.addon) return options.addon;

    const candidates = options.addonPath
        ? [options.addonPath]
        : getAddonCandidates(options.environment);
    const errors = [];
    for (const candidate of candidates) {
        try {
            return require(path.resolve(candidate));
        }
        catch (error) {
            errors.push(`${candidate}: ${error.message}`);
        }
    }

    const error = new Error('Exact geodesic addon is unavailable');
    error.details = errors;
    throw error;
};

const isFiniteNumber = value => typeof value === 'number' && Number.isFinite(value);

const validateLoadPayload = payload => {
    if (!payload || typeof payload.mesh_id !== 'string' || payload.mesh_id.length === 0) {
        return 'mesh_id is required';
    }
    if (!Array.isArray(payload.vertices) || payload.vertices.length < 9 || payload.vertices.length % 3 !== 0) {
        return 'vertices must be a flat array containing at least three 3D points';
    }
    if (!Array.isArray(payload.faces) || payload.faces.length < 3 || payload.faces.length % 3 !== 0) {
        return 'faces must be a flat triangle-index array';
    }
    if (!payload.vertices.every(isFiniteNumber)) return 'vertices must contain only finite numbers';
    if (!payload.faces.every(value => Number.isSafeInteger(value) && value >= 0)) {
        return 'faces must contain only non-negative integer indices';
    }
    return null;
};

const validateQueryPayload = payload => {
    if (!payload || typeof payload.mesh_id !== 'string' || payload.mesh_id.length === 0) {
        return 'mesh_id is required';
    }
    const coordinates = ['x1', 'y1', 'z1', 'x2', 'y2', 'z2'];
    if (!coordinates.every(name => isFiniteNumber(payload[name]))) {
        return 'x1, y1, z1, x2, y2, and z2 must be finite numbers';
    }
    return null;
};

const registerGeodesicRoutes = (app, options = {}) => {
    let addon = options.addon;
    let addonLoadError;
    const getAddon = () => {
        if (addon) return addon;
        if (addonLoadError) throw addonLoadError;
        try {
            addon = loadAddon(options);
            return addon;
        }
        catch (error) {
            addonLoadError = error;
            console.error(`[THOTH] ${error.message}`);
            for (const detail of error.details || []) console.error(`[THOTH] ${detail}`);
            throw error;
        }
    };

    app.post(`${GEODESIC_BASE}/load`, (request, response) => {
        const validationError = validateLoadPayload(request.body);
        if (validationError) {
            response.status(400).json({ error: validationError, code: 'INVALID_GEODESIC_MESH' });
            return;
        }

        try {
            const payload = request.body;
            const loaded = getAddon().loadMesh(payload.mesh_id, payload.vertices, payload.faces);
            if (!loaded) {
                response.status(422).json({
                    error: 'The mesh could not be initialized for exact geodesic computation',
                    code: 'GEODESIC_MESH_REJECTED'
                });
                return;
            }
            response.json({ status: true, mesh_id: payload.mesh_id });
        }
        catch (error) {
            response.status(503).json({ error: error.message, code: 'GEODESIC_ADDON_UNAVAILABLE' });
        }
    });

    app.post(`${GEODESIC_BASE}/exact`, (request, response) => {
        const validationError = validateQueryPayload(request.body);
        if (validationError) {
            response.status(400).json({ error: validationError, code: 'INVALID_GEODESIC_QUERY' });
            return;
        }

        try {
            const payload = request.body;
            const result = getAddon().query(
                payload.mesh_id,
                payload.x1,
                payload.y1,
                payload.z1,
                payload.x2,
                payload.y2,
                payload.z2
            );
            if (!result?.status) {
                const meshMissing = result?.error === 'mesh not found';
                response.status(meshMissing ? 404 : 422).json({
                    error: result?.error || 'Exact geodesic path was not found',
                    code: meshMissing ? 'GEODESIC_MESH_NOT_FOUND' : 'GEODESIC_PATH_NOT_FOUND'
                });
                return;
            }
            response.json(result);
        }
        catch (error) {
            response.status(503).json({ error: error.message, code: 'GEODESIC_ADDON_UNAVAILABLE' });
        }
    });
};

module.exports = {
    GEODESIC_BASE,
    getAddonCandidates,
    loadAddon,
    registerGeodesicRoutes,
    validateLoadPayload,
    validateQueryPayload
};
