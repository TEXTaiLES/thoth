const http = require('http');
const https = require('https');
const { URL } = require('url');
const {
    EGI,
    randomToken,
    generatePkcePair,
    exchangeCodeForTokens,
    fetchUserInfo
} = require('./egi.js');
const {
    SESSION_TTL_MS,
    HESTIA_SESSION_TTL_MS,
    createSession,
    verifySession
} = require('./session.js');

const EGI_SESSION_COOKIE = 'thoth_egi_session';
const HESTIA_SESSION_COOKIE = 'thoth_hestia_session';
const PROVIDER_COOKIE = 'thoth_auth_provider';
const STATE_COOKIE = 'thoth_egi_state';
const VERIFIER_COOKIE = 'thoth_egi_pkce_verifier';
const REDIRECT_COOKIE = 'thoth_egi_final_redirect';

const getSettings = () => ({
    sessionSecret: process.env.THOTH_SESSION_SECRET,
    portalUrl: process.env.HESTIA_PORTAL_URL,
    directusTarget: process.env.HESTIA_DIRECTUS_TARGET,
    cookieName: process.env.HESTIA_COOKIE_NAME || 'textailes_refresh_token',
    cookieDomain: process.env.HESTIA_COOKIE_DOMAIN || undefined,
    secure: (process.env.EGI_REDIRECT_URI || '').startsWith('https') ||
        (process.env.HESTIA_PORTAL_URL || '').startsWith('https')
});

const parseCookies = (request) => {
    const result = {};
    for (const part of String(request.headers.cookie || '').split(';')) {
        const index = part.indexOf('=');
        if (index < 0) continue;
        const key = part.slice(0, index).trim();
        if (!key) continue;
        try { result[key] = decodeURIComponent(part.slice(index + 1).trim()); }
        catch { result[key] = part.slice(index + 1).trim(); }
    }
    return result;
};

const requestJson = ({ url, method = 'GET', headers = {}, body }) => new Promise((resolve, reject) => {
    const target = new URL(url);
    const transport = target.protocol === 'http:' ? http : https;
    const payload = body === undefined ? null : JSON.stringify(body);
    const requestHeaders = { Accept: 'application/json', ...headers };
    if (payload !== null) {
        requestHeaders['Content-Type'] = 'application/json';
        requestHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const request = transport.request({
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || undefined,
        path: `${target.pathname}${target.search}`,
        method,
        headers: requestHeaders
    }, response => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            let data = text;
            try { data = text ? JSON.parse(text) : null; }
            catch { /* Preserve non-JSON upstream errors. */ }
            resolve({ status: response.statusCode, data });
        });
    });
    request.on('error', reject);
    request.setTimeout(10000, () => {
        const error = new Error('Authentication upstream timed out');
        error.code = 'ETIMEDOUT';
        request.destroy(error);
    });
    if (payload !== null) request.write(payload);
    request.end();
});

const sanitizeLocalRedirect = (raw) => {
    if (!raw || typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) {
        return '/a/thoth/';
    }
    return raw;
};

const appendReason = (redirect, reason) => {
    const target = new URL(sanitizeLocalRedirect(redirect), 'http://thoth.local');
    target.searchParams.set('reason', reason);
    return `${target.pathname}${target.search}${target.hash}`;
};

const getPublicUrl = (request, localPath) => {
    const protocol = String(request.headers['x-forwarded-proto'] || request.protocol || 'http')
        .split(',')[0]
        .trim();
    return new URL(localPath, `${protocol}://${request.get('host')}`).toString();
};

const clearCookie = (response, name, options = {}) => {
    response.clearCookie(name, { path: '/', ...options });
};

const normalizedIdentity = (data, provider) => {
    const email = data?.email || data?.data?.email || '';
    const firstName = data?.first_name || data?.data?.first_name || '';
    const lastName = data?.last_name || data?.data?.last_name || '';
    const displayName = [firstName, lastName].filter(Boolean).join(' ');
    const username = data?.username || data?.data?.username || displayName || email;
    if (!username && !email) return null;
    return {
        authenticated: true,
        provider,
        username,
        email,
        id: data?.id || data?.data?.id || email || username
    };
};

const verifyLocalSession = (cookies, provider, settings) => {
    const cookieName = provider === 'hestia' ? HESTIA_SESSION_COOKIE : EGI_SESSION_COOKIE;
    const session = verifySession(cookies[cookieName], settings.sessionSecret);
    return session ? normalizedIdentity(session, provider) : null;
};

const refreshHestiaSession = async (request, response, settings, requester = requestJson) => {
    const cookies = request.thothCookies || parseCookies(request);
    const refreshToken = cookies[settings.cookieName];
    if (!refreshToken) return null;

    const refresh = await requester({
        url: new URL('/auth/refresh', settings.directusTarget).toString(),
        method: 'POST',
        body: { refresh_token: refreshToken, mode: 'json' }
    });
    const tokens = refresh.data?.data || refresh.data;
    if (refresh.status < 200 || refresh.status >= 300 || !tokens?.access_token) {
        request.thothAuthCode = 'SESSION_EXPIRED';
        clearCookie(response, settings.cookieName, { domain: settings.cookieDomain });
        return null;
    }

    if (tokens.refresh_token) {
        response.cookie(settings.cookieName, tokens.refresh_token, {
            httpOnly: true,
            secure: settings.secure,
            sameSite: 'lax',
            domain: settings.cookieDomain,
            path: '/',
            maxAge: Number(tokens.expires) || 7 * 24 * 60 * 60 * 1000
        });
    }

    const userResponse = await requester({
        url: new URL('/users/me?fields=id,email,first_name,last_name', settings.directusTarget).toString(),
        headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    if (userResponse.status < 200 || userResponse.status >= 300) {
        request.thothAuthCode = userResponse.status === 403
            ? 'HESTIA_USER_UNREGISTERED'
            : 'HESTIA_USER_UNAVAILABLE';
        return null;
    }

    const identity = normalizedIdentity(userResponse.data, 'hestia');
    if (!identity) return null;
    response.cookie(
        HESTIA_SESSION_COOKIE,
        createSession(identity, settings.sessionSecret, HESTIA_SESSION_TTL_MS),
        {
            httpOnly: true,
            secure: settings.secure,
            sameSite: 'lax',
            path: '/',
            maxAge: HESTIA_SESSION_TTL_MS
        }
    );
    return identity;
};

const resolveIdentity = async (request, response) => {
    const settings = getSettings();
    const cookies = request.thothCookies || parseCookies(request);
    request.thothCookies = cookies;
    const preferred = cookies[PROVIDER_COOKIE];
    const providers = preferred === 'egi' ? ['egi', 'hestia'] : ['hestia', 'egi'];

    for (const provider of providers) {
        const localIdentity = verifyLocalSession(cookies, provider, settings);
        if (localIdentity) return localIdentity;
        const localCookie = provider === 'hestia' ? HESTIA_SESSION_COOKIE : EGI_SESSION_COOKIE;
        if (cookies[localCookie]) request.thothAuthCode = 'SESSION_EXPIRED';
        if (provider === 'hestia') {
            try {
                const hestiaIdentity = await refreshHestiaSession(request, response, settings);
                if (hestiaIdentity) return hestiaIdentity;
            }
            catch (error) {
                request.thothAuthError = error;
                request.thothAuthCode = 'AUTH_SERVICE_UNAVAILABLE';
            }
        }
    }
    return null;
};

const requireAuthentication = async (request, response, next) => {
    try {
        const identity = await resolveIdentity(request, response);
        if (!identity) {
            const unavailable = Boolean(request.thothAuthError);
            response.status(unavailable ? 503 : 401).json({
                error: unavailable ? 'Authentication service unavailable' : 'Authentication required',
                code: request.thothAuthCode || (unavailable ? 'AUTH_SERVICE_UNAVAILABLE' : 'AUTHENTICATION_REQUIRED')
            });
            return;
        }
        request.thothIdentity = identity;
        next();
    }
    catch (error) {
        response.status(503).json({ error: 'Authentication service unavailable', code: 'AUTH_SERVICE_UNAVAILABLE' });
    }
};

const registerAuthRoutes = (app) => {
    const settings = getSettings();
    const tempCookieOptions = {
        httpOnly: true,
        secure: settings.secure,
        sameSite: 'lax',
        path: '/a/thoth/',
        maxAge: 10 * 60 * 1000
    };

    app.get('/a/thoth/egi-login', (request, response) => {
        try {
            const state = randomToken(32);
            const { verifier, challenge } = generatePkcePair();
            const finalRedirect = sanitizeLocalRedirect(request.query.redirect);
            response.cookie(PROVIDER_COOKIE, 'egi', { httpOnly: true, secure: settings.secure, sameSite: 'lax', path: '/' });
            response.cookie(STATE_COOKIE, state, tempCookieOptions);
            response.cookie(VERIFIER_COOKIE, verifier, tempCookieOptions);
            response.cookie(REDIRECT_COOKIE, finalRedirect, tempCookieOptions);

            const authUrl = new URL(EGI.authorizeUrl);
            authUrl.searchParams.set('response_type', 'code');
            authUrl.searchParams.set('client_id', EGI.clientId);
            authUrl.searchParams.set('redirect_uri', EGI.redirectUri);
            authUrl.searchParams.set('scope', 'openid email profile');
            authUrl.searchParams.set('state', state);
            authUrl.searchParams.set('code_challenge', challenge);
            authUrl.searchParams.set('code_challenge_method', 'S256');
            response.redirect(authUrl.toString());
        }
        catch (error) {
            response.redirect(appendReason(request.query.redirect, 'EGI_LOGIN_INIT_FAILED'));
        }
    });

    app.get('/a/thoth/egi-callback', async (request, response) => {
        const cookies = parseCookies(request);
        const finalRedirect = sanitizeLocalRedirect(cookies[REDIRECT_COOKIE]);
        const clearTemporaryCookies = () => {
            for (const name of [STATE_COOKIE, VERIFIER_COOKIE, REDIRECT_COOKIE]) {
                response.clearCookie(name, { path: '/a/thoth/' });
            }
        };

        try {
            if (request.query.error) {
                clearTemporaryCookies();
                const reason = `EGI_${String(request.query.error).toUpperCase().replace(/[^A-Z0-9_]/g, '')}`;
                response.redirect(appendReason(finalRedirect, reason));
                return;
            }
            if (
                !request.query.code ||
                !request.query.state ||
                !cookies[STATE_COOKIE] ||
                !cookies[VERIFIER_COOKIE]
            ) {
                clearTemporaryCookies();
                response.redirect(appendReason(finalRedirect, 'EGI_MISSING_PARAMS'));
                return;
            }
            if (request.query.state !== cookies[STATE_COOKIE]) {
                clearTemporaryCookies();
                response.redirect(appendReason(finalRedirect, 'EGI_STATE_MISMATCH'));
                return;
            }

            const tokens = await exchangeCodeForTokens(request.query.code, cookies[VERIFIER_COOKIE]);
            const userinfo = await fetchUserInfo(tokens.access_token);
            const identity = normalizedIdentity(userinfo, 'egi');
            if (!identity) throw new Error('EGI userinfo did not contain a usable identity');
            response.cookie(
                EGI_SESSION_COOKIE,
                createSession(identity, settings.sessionSecret, SESSION_TTL_MS),
                {
                    httpOnly: true,
                    secure: settings.secure,
                    sameSite: 'lax',
                    path: '/',
                    maxAge: SESSION_TTL_MS
                }
            );
            clearTemporaryCookies();
            response.redirect(finalRedirect);
        }
        catch (error) {
            clearTemporaryCookies();
            response.redirect(appendReason(finalRedirect, 'EGI_CALLBACK_ERROR'));
        }
    });

    app.get('/a/thoth/hestia-login', (request, response) => {
        const redirectPath = sanitizeLocalRedirect(request.query.redirect);
        const finalRedirect = getPublicUrl(request, redirectPath);
        const loginUrl = new URL('/archive/user/login', settings.portalUrl);
        loginUrl.searchParams.set('redirect_url', finalRedirect);
        response.cookie(PROVIDER_COOKIE, 'hestia', { httpOnly: true, secure: settings.secure, sameSite: 'lax', path: '/' });
        response.redirect(loginUrl.toString());
    });

    app.get('/a/thoth/whoami', async (request, response) => {
        try {
            const identity = await resolveIdentity(request, response);
            if (!identity) {
                response.status(request.thothAuthError ? 503 : 401).json({
                    authenticated: false,
                    code: request.thothAuthCode ||
                        (request.thothAuthError ? 'AUTH_SERVICE_UNAVAILABLE' : 'AUTHENTICATION_REQUIRED')
                });
                return;
            }
            response.json(identity);
        }
        catch {
            response.status(503).json({ authenticated: false, code: 'AUTH_SERVICE_UNAVAILABLE' });
        }
    });

    const logout = async (request, response) => {
        const cookies = parseCookies(request);
        const refreshToken = cookies[settings.cookieName];
        if (refreshToken) {
            try {
                await requestJson({
                    url: new URL('/auth/logout', settings.directusTarget).toString(),
                    method: 'POST',
                    body: { refresh_token: refreshToken, mode: 'json' }
                });
            }
            catch { /* Local cookie clearing still logs THOTH out. */ }
        }
        clearCookie(response, EGI_SESSION_COOKIE);
        clearCookie(response, HESTIA_SESSION_COOKIE);
        clearCookie(response, PROVIDER_COOKIE);
        clearCookie(response, settings.cookieName, { domain: settings.cookieDomain });
        response.json({ ok: true });
    };
    app.post('/a/thoth/logout', logout);
    // Retained for bookmarks created by the previous EGI-only integration.
    app.get('/a/thoth/egi-logout', logout);
};

module.exports = {
    appendReason,
    normalizedIdentity,
    parseCookies,
    refreshHestiaSession,
    registerAuthRoutes,
    requireAuthentication,
    resolveIdentity,
    sanitizeLocalRedirect
};
