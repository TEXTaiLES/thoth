// thoth EGI Check-In login routes.
//
// Adapted from the Directus archive's egi-auth.js. Same OAuth handshake, but:
//   * NO authorization step — any identity EGI confirms is logged in. We do not
//     look the email up in any user store (that was Directus's allow-list).
//   * NO ATON passport/express-session. ATON's session is keyed to pre-registered
//     Core.users, which fights "any EGI user". Instead we mint our own signed
//     cookie carrying just the EGI email. That is the whole thoth session.
//
// Endpoints (all mounted under /a/thoth, BEFORE the /a static handler):
//   GET /a/thoth/egi-login    → build EGI auth URL, set handshake cookies, redirect
//   GET /a/thoth/egi-callback → validate state, exchange code, set session cookie,
//                               redirect back to the scene the user came from
//   GET /a/thoth/whoami       → { email } if the session cookie is valid, else 401
//   GET /a/thoth/egi-logout   → clear the session cookie

const crypto = require('crypto');
const {
    EGI,
    randomToken,
    generatePkcePair,
    exchangeCodeForTokens,
    fetchUserInfo,
} = require('./egi.js');

// Short-lived cookies for the OAuth handshake (state + PKCE verifier + the scene
// URL to land back on). Scoped to /a/thoth/ so they don't leak to the rest of ATON.
const STATE_COOKIE = 'thoth_egi_state';
const VERIFIER_COOKIE = 'thoth_egi_pkce_verifier';
const REDIRECT_COOKIE = 'thoth_egi_final_redirect';

// The actual session cookie: a signed token carrying the EGI email.
const SESSION_COOKIE = 'thoth_egi_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

const IS_HTTPS = (EGI.redirectUri || '').startsWith('https');

// Dev fallback secret — override with THOTH_SESSION_SECRET in any real deployment.
const SESSION_SECRET = process.env.THOTH_SESSION_SECRET || 'thoth-dev-session-secret-change-me';

const TEMP_COOKIE_OPTIONS = {
    httpOnly: true,
    sameSite: 'lax',
    path: '/a/thoth/',
    maxAge: 10 * 60 * 1000, // 10 minutes — plenty for the round trip to EGI
    secure: IS_HTTPS,
};

// Refuse absolute and protocol-relative URLs to prevent open-redirect via
// ?redirect=. The scene URL is always a same-origin path like /a/thoth/?s=...
const sanitizeRedirect = (raw) => {
    if (!raw || typeof raw !== 'string') return '/a/thoth/';
    if (!raw.startsWith('/')) return '/a/thoth/';
    if (raw.startsWith('//')) return '/a/thoth/';
    return raw;
};

// ---- Session token: base64url(payload) + "." + base64url(HMAC) ----------------
const b64url = (buf) => Buffer.from(buf).toString('base64url');

const signSession = (email) => {
    const payload = b64url(JSON.stringify({ email, exp: Date.now() + SESSION_TTL_MS }));
    const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
    return `${payload}.${sig}`;
};

const verifySession = (token) => {
    if (!token || typeof token !== 'string' || !token.includes('.')) return null;
    const [payload, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
    // Timing-safe compare; lengths must match or timingSafeEqual throws.
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
        const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (!data.email || !data.exp || Date.now() > data.exp) return null;
        return data;
    } catch {
        return null;
    }
};

module.exports = (app) => {
    // ------------------------------------------------------------------
    // /a/thoth/egi-login  →  redirect to EGI's authorization endpoint
    // ------------------------------------------------------------------
    app.get('/a/thoth/egi-login', (req, res) => {
        try {
            const state = randomToken(32);
            const { verifier, challenge } = generatePkcePair();
            // Where to land after login — the scene the user was annotating.
            const finalRedirect = sanitizeRedirect(req.query.redirect);

            res.cookie(STATE_COOKIE, state, TEMP_COOKIE_OPTIONS);
            res.cookie(VERIFIER_COOKIE, verifier, TEMP_COOKIE_OPTIONS);
            res.cookie(REDIRECT_COOKIE, finalRedirect, TEMP_COOKIE_OPTIONS);

            const authUrl = new URL(EGI.authorizeUrl);
            authUrl.searchParams.set('response_type', 'code');
            authUrl.searchParams.set('client_id', EGI.clientId);
            authUrl.searchParams.set('redirect_uri', EGI.redirectUri);
            authUrl.searchParams.set('scope', 'openid email profile');
            authUrl.searchParams.set('state', state);
            authUrl.searchParams.set('code_challenge', challenge);
            authUrl.searchParams.set('code_challenge_method', 'S256');

            console.info('[THOTH EGI] Redirecting to EGI authorize endpoint');
            return res.redirect(authUrl.toString());
        } catch (err) {
            console.error('[THOTH EGI] Login init failed:', err);
            return res.redirect('/a/thoth/?reason=EGI_LOGIN_INIT_FAILED');
        }
    });

    // ------------------------------------------------------------------
    // /a/thoth/egi-callback  →  handle EGI's redirect back after auth
    // ------------------------------------------------------------------
    app.get('/a/thoth/egi-callback', async (req, res) => {
        const finalRedirect = sanitizeRedirect(req.cookies[REDIRECT_COOKIE]);

        const clearTemps = () => {
            res.clearCookie(STATE_COOKIE, { path: '/a/thoth/' });
            res.clearCookie(VERIFIER_COOKIE, { path: '/a/thoth/' });
            res.clearCookie(REDIRECT_COOKIE, { path: '/a/thoth/' });
        };

        try {
            if (req.query.error) {
                console.warn('[THOTH EGI] EGI returned error:', req.query.error);
                clearTemps();
                const code = String(req.query.error).toUpperCase().replace(/[^A-Z0-9_]/g, '');
                return res.redirect(`${finalRedirect}?reason=EGI_${code}`);
            }

            const code = req.query.code;
            const state = req.query.state;
            const cookieState = req.cookies[STATE_COOKIE];
            const codeVerifier = req.cookies[VERIFIER_COOKIE];

            if (!code || !state || !cookieState || !codeVerifier) {
                console.warn('[THOTH EGI] Missing params or handshake cookies');
                clearTemps();
                return res.redirect(`${finalRedirect}?reason=EGI_MISSING_PARAMS`);
            }

            // CSRF guard: the state we handed to EGI must match what it sent back.
            if (state !== cookieState) {
                console.warn('[THOTH EGI] State mismatch — possible CSRF');
                clearTemps();
                return res.redirect(`${finalRedirect}?reason=EGI_STATE_MISMATCH`);
            }

            // Exchange code (+ PKCE verifier) for tokens, then read the identity.
            // This server-to-server step, authenticated with our client_secret,
            // is what makes "confirmed by EGI" trustworthy.
            const tokens = await exchangeCodeForTokens(code, codeVerifier);
            const userinfo = await fetchUserInfo(tokens.access_token);
            const email = userinfo.email;
            console.info(`[THOTH EGI] Authenticated at EGI: email=${email}`);

            // No allow-list, no user lookup: EGI confirmed the identity, so mint
            // the thoth session cookie straight from the email.
            res.cookie(SESSION_COOKIE, signSession(email), {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                maxAge: SESSION_TTL_MS,
                secure: IS_HTTPS,
            });

            console.info(`[THOTH EGI] Session issued for ${email}, redirecting to ${finalRedirect}`);
            clearTemps();
            return res.redirect(finalRedirect);
        } catch (err) {
            console.error('[THOTH EGI] Callback failed:', err);
            clearTemps();
            return res.redirect(`${finalRedirect}?reason=EGI_CALLBACK_ERROR`);
        }
    });

    // ------------------------------------------------------------------
    // /a/thoth/whoami  →  who is logged in (for the thoth client)
    // ------------------------------------------------------------------
    app.get('/a/thoth/whoami', (req, res) => {
        const session = verifySession(req.cookies[SESSION_COOKIE]);
        if (!session) {
            res.status(401).json({ authenticated: false });
            return;
        }
        res.json({ authenticated: true, email: session.email, username: session.email });
    });

    // ------------------------------------------------------------------
    // /a/thoth/egi-logout  →  drop the session cookie
    // ------------------------------------------------------------------
    app.get('/a/thoth/egi-logout', (req, res) => {
        res.clearCookie(SESSION_COOKIE, { path: '/' });
        res.json({ ok: true });
    });
};
