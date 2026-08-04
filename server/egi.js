// EGI Check-In OIDC helpers (thoth server-side).
//
// CommonJS port of the Directus archive's utils/egi.js, so it can be required
// directly from THOTH's ATON gateway extension, which is
// require-based (not ESM).
//
// We run the authorization-code + PKCE flow against EGI's Keycloak, then read
// the identity from the userinfo endpoint. We deliberately do NOT verify
// id_tokens ourselves — a 200 from userinfo with an email claim is proof enough
// that the auth session is legitimate.

const crypto = require('crypto');
const https = require('https');
const { URL, URLSearchParams } = require('url');

// EGI configuration pulled from env. The three URLs + client creds are required
// at boot. redirectUri must match a redirect_uri registered on the EGI client
// byte-for-byte; for thoth this is a single fixed callback (the target scene is
// carried separately via a cookie, see auth-routes.js).
const EGI = {
    authorizeUrl: process.env.EGI_AUTHORIZE_URL,
    tokenUrl:     process.env.EGI_TOKEN_URL,
    userinfoUrl:  process.env.EGI_USERINFO_URL,
    clientId:     process.env.EGI_CLIENT_ID,
    clientSecret: process.env.EGI_CLIENT_SECRET,
    redirectUri:  process.env.EGI_REDIRECT_URI || 'http://localhost:8054/a/thoth/egi-callback',
};

// Generate a URL-safe random string (base64url, no padding).
const randomToken = (bytes = 32) =>
    crypto.randomBytes(bytes).toString('base64url');

// PKCE (S256): produce a verifier the client keeps (in a cookie) and a challenge (hash) sent to EGI.
const generatePkcePair = () => {
    const verifier = randomToken(32);
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
};

// Minimal Promise-wrapped https request. Parses JSON responses automatically.
// Returns { status, headers, body }. Rejects only on transport errors.
const httpsRequest = ({ url, method = 'GET', headers = {}, body = null }) =>
    new Promise((resolve, reject) => {
        const u = new URL(url);
        const req = https.request({
            hostname: u.hostname,
            port: u.port || 443,
            path: u.pathname + u.search,
            method,
            headers,
        }, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const raw = Buffer.concat(chunks).toString('utf8');
                const ctype = (res.headers['content-type'] || '').toLowerCase();
                let parsed = raw;
                if (ctype.includes('application/json')) {
                    try { parsed = JSON.parse(raw); } catch { /* keep raw */ }
                }
                resolve({ status: res.statusCode, headers: res.headers, body: parsed });
            });
        });
        req.on('error', reject);
        req.setTimeout(10000, () => {
            const error = new Error('[EGI] Upstream request timed out');
            error.code = 'ETIMEDOUT';
            req.destroy(error);
        });
        if (body) req.write(body);
        req.end();
    });

// Exchange the authorization code (+ PKCE verifier) for tokens. This is the
// server-to-server step, authenticated with our client_secret, that proves the
// code is genuine. Throws if EGI didn't return a valid access_token.
const exchangeCodeForTokens = async (code, codeVerifier) => {
    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: EGI.redirectUri,
        client_id: EGI.clientId,
        client_secret: EGI.clientSecret,
        code_verifier: codeVerifier,
    }).toString();

    const { status, body: data } = await httpsRequest({
        url: EGI.tokenUrl,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
        },
        body,
    });

    if (status !== 200 || !data || !data.access_token) {
        throw new Error(`[EGI] Token exchange failed (${status}): ${JSON.stringify(data)}`);
    }
    return data;
};

// Call EGI's userinfo endpoint with the access token. This is where EGI
// validates the token server-side; a 200 with an email claim is our proof that
// the authentication actually happened at EGI.
const fetchUserInfo = async (accessToken) => {
    const { status, body: data } = await httpsRequest({
        url: EGI.userinfoUrl,
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
        },
    });

    if (status !== 200) {
        throw new Error(`[EGI] Userinfo failed (${status}): ${JSON.stringify(data)}`);
    }
    if (!data || !data.email) {
        throw new Error(`[EGI] Userinfo returned no email claim: ${JSON.stringify(data)}`);
    }
    return data;
};

module.exports = {
    EGI,
    randomToken,
    generatePkcePair,
    exchangeCodeForTokens,
    fetchUserInfo,
};
