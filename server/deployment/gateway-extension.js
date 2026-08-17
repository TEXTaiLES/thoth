const { createProxyMiddleware, fixRequestBody } = require('http-proxy-middleware');
const { registerAuthRoutes, requireAuthentication } = require('../auth-routes.js');
const { registerGeodesicRoutes } = require('../geodesic-routes.js');

const REQUIRED_ENV = [
    'HESTIA_API_AUTH_KEY',
    'HESTIA_API_TARGET',
    'HESTIA_API_PUBLIC_URL',
    'HESTIA_DIRECTUS_TARGET',
    'HESTIA_PORTAL_URL',
    'EGI_AUTHORIZE_URL',
    'EGI_TOKEN_URL',
    'EGI_USERINFO_URL',
    'EGI_CLIENT_ID',
    'EGI_CLIENT_SECRET',
    'EGI_REDIRECT_URI',
    'THOTH_SESSION_SECRET'
];

const ALLOWED_API_ROUTES = [
    { methods: ['GET', 'POST', 'PUT'], pattern: /^\/scenes(?:\/[^/]+)?\/?$/ },
    { methods: ['GET'], pattern: /^\/artifacts(?:\/[^/]+)?\/?$/ },
    { methods: ['GET'], pattern: /^\/artefacts\/[^/]+\/?$/ },
    { methods: ['GET'], pattern: /^\/rgb\/(?:image|images)(?:\/.*)?$/ },
    { methods: ['GET'], pattern: /^\/multispectral\/(?:image|images|file)(?:\/.*)?$/ },
    { methods: ['GET'], pattern: /^\/sensor-readings\/?$/ },
    { methods: ['GET', 'POST', 'PUT'], pattern: /^\/echoes\/[^/]+\/?$/ },
    { methods: ['GET'], pattern: /^\/storage\/[^/]+\/.*$/ }
];

const validateEnvironment = (environment = process.env) => {
    const missing = REQUIRED_ENV.filter(name => !String(environment[name] || '').trim());
    if (missing.length > 0) {
        throw new Error(`[THOTH] Missing required HESTIA environment variables: ${missing.join(', ')}`);
    }
};

const isAllowedApiRequest = (method, requestPath) => ALLOWED_API_ROUTES.some(route =>
    route.methods.includes(String(method || '').toUpperCase()) && route.pattern.test(requestPath)
);

const getApiAuthorizationHeader = (environment = process.env) =>
    `Bearer ${environment.HESTIA_API_AUTH_KEY}`;

const getDeploymentSelector = (environment = process.env) => ({
    mode: 'hestia',
    source: 'hestia.json',
    runtime: {
        hestiaApiPublicUrl: environment.HESTIA_API_PUBLIC_URL,
        auth: {
            portalUrl: environment.HESTIA_PORTAL_URL
        }
    }
});

module.exports = (app) => {
    registerGeodesicRoutes(app);

    const mode = String(process.env.THOTH_DEPLOYMENT_MODE || 'local').toLowerCase();
    if (mode !== 'hestia') {
        console.log('[THOTH] Local deployment mode: using native ATON API and authentication');
        return;
    }

    validateEnvironment();

    app.get('/a/thoth/config/deployment.json', (request, response) => {
        response.json(getDeploymentSelector());
    });

    registerAuthRoutes(app);

    // Browser clients use this same-origin route instead of contacting HESTIA
    // directly. Besides keeping the service credential on the server, this is
    // the CORS workaround formerly carried by the copied ATON gateway file.
    app.use('/hestia', requireAuthentication, (request, response, next) => {
        if (!isAllowedApiRequest(request.method, request.path)) {
            response.status(404).json({ error: 'HESTIA route is not enabled for THOTH', code: 'ROUTE_NOT_ALLOWED' });
            return;
        }
        next();
    });

    app.use('/hestia', createProxyMiddleware({
        target: process.env.HESTIA_API_TARGET,
        pathRewrite: { '^/hestia': '' },
        changeOrigin: true,
        proxyTimeout: 30000,
        timeout: 30000,
        on: {
            proxyReq: (proxyRequest, request, response) => {
                proxyRequest.setHeader('Authorization', getApiAuthorizationHeader());
                fixRequestBody(proxyRequest, request, response);
            },
            error: (error, request, response) => {
                if (response.headersSent) return;
                response.status(503).json({
                    error: 'HESTIA API unavailable',
                    code: error?.code === 'ETIMEDOUT' ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE'
                });
            }
        }
    }));

    console.log(`[THOTH] HESTIA deployment mode: proxying API at ${process.env.HESTIA_API_TARGET}`);
};

module.exports.ALLOWED_API_ROUTES = ALLOWED_API_ROUTES;
module.exports.getDeploymentSelector = getDeploymentSelector;
module.exports.getApiAuthorizationHeader = getApiAuthorizationHeader;
module.exports.isAllowedApiRequest = isAllowedApiRequest;
module.exports.validateEnvironment = validateEnvironment;
