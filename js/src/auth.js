/*===========================================================================

    THOTH
    Deployment-aware authentication

===========================================================================*/
let Auth = {};

const REASON_MESSAGES = {
    EGI_LOGIN_INIT_FAILED: "EGI login could not be started. Check the deployment configuration.",
    EGI_MISSING_PARAMS: "EGI did not return all required login parameters.",
    EGI_STATE_MISMATCH: "EGI login was rejected because the security state did not match.",
    EGI_USER_NOT_REGISTERED: "This EGI identity is not registered with HESTIA.",
    EGI_USER_INACTIVE: "This HESTIA account is inactive.",
    EGI_CALLBACK_ERROR: "EGI login could not be completed. Please try again.",
    SESSION_EXPIRED: "Your session has expired. Please log in again.",
    HESTIA_USER_UNREGISTERED: "Your HESTIA account is not registered or cannot access this service.",
    HESTIA_USER_UNAVAILABLE: "HESTIA could not load your user account. Please try again.",
    AUTH_SERVICE_UNAVAILABLE: "The authentication service is unavailable. Please try again later."
};

Auth.setup = (options = {}) => {
    Auth.user = null;
    Auth._checkPromise = null;
    Auth.options = options;
};

Auth._app = () => Auth.options?.app || globalThis.THOTH || {};
Auth._aton = () => Auth.options?.aton || globalThis.ATON;
Auth.getMode = () => Auth.options?.config?.auth?.mode || Auth._app().config?.auth?.mode || "aton";
Auth.isHestiaMode = () => Auth.getMode() === "hestia";
Auth._url = (name) => new URL(
    `${Auth.options?.baseURL || Auth._app().BASE_URL || "../thoth"}/${name}`,
    window.location.href
).href;
Auth._currentPath = () => window.location.pathname + window.location.search + window.location.hash;

Auth._checkAton = () => new Promise(resolve => {
    const aton = Auth._aton();
    if (!aton?.checkAuth) {
        resolve(null);
        return;
    }
    aton.checkAuth(user => resolve(user || null), () => resolve(null));
});

Auth._checkHestia = async () => {
    const response = await fetch(Auth._url("whoami"), { credentials: "include" });
    const data = await response.json().catch(() => null);
    if (response.ok && data?.authenticated) return data;
    if (response.status >= 500) {
        const error = new Error(REASON_MESSAGES[data?.code] || "Authentication service unavailable");
        error.code = data?.code || "AUTH_SERVICE_UNAVAILABLE";
        throw error;
    }
    if (data?.code && data.code !== "AUTHENTICATION_REQUIRED") {
        const error = new Error(REASON_MESSAGES[data.code] || `Authentication failed (${data.code}).`);
        error.code = data.code;
        throw error;
    }
    return null;
};

Auth.getUser = () => {
    if (!Auth._checkPromise) {
        Auth._checkPromise = (Auth.isHestiaMode() ? Auth._checkHestia() : Auth._checkAton())
            .finally(() => { Auth._checkPromise = null; });
    }
    return Auth._checkPromise;
};

Auth.checkAuth = (onLogged, onNotLogged) => Auth.getUser()
    .then(user => {
        if (user) {
            if (onLogged) onLogged(user);
        }
        else if (onNotLogged) onNotLogged();
        return user;
    })
    .catch(error => {
        Auth._notify(error.message);
        if (onNotLogged) onNotLogged(error);
        return null;
    });

Auth.startEgiLogin = (redirect = Auth._currentPath()) => {
    const target = new URL(Auth._url("egi-login"));
    target.searchParams.set("redirect", redirect);
    window.location.assign(target.href);
};

Auth.startHestiaLogin = (redirect = Auth._currentPath()) => {
    const target = new URL(Auth._url("hestia-login"));
    target.searchParams.set("redirect", redirect);
    window.location.assign(target.href);
};

Auth.startLogin = Auth.startEgiLogin;

Auth.loginAton = (username, password) => new Promise(resolve => {
    const aton = Auth._aton();
    if (Auth.isHestiaMode() || !aton?.REQ?.login) {
        resolve({ ok: false, error: "ATON login is unavailable" });
        return;
    }

    aton.REQ.login(
        username,
        password,
        user => {
            Auth.setAuthState(user);
            resolve({ ok: true, data: user });
        },
        () => resolve({ ok: false, error: "Invalid username or password" })
    );
});

Auth.logout = () => {
    Auth.setAuthState(null);
    if (!Auth.isHestiaMode()) {
        const aton = Auth._aton();
        if (!aton?.REQ?.logout) {
            window.location.reload();
            return;
        }
        aton.REQ.logout(() => window.location.reload(), () => window.location.reload());
        return;
    }

    fetch(Auth._url("logout"), { method: "POST", credentials: "include" })
        .catch(() => {})
        .finally(() => window.location.reload());
};

Auth.setAuthState = (user) => {
    Auth.user = user || null;
    const app = Auth._app();
    app.user = Auth.user;
    if (app.FE?.syncAuthControls) app.FE.syncAuthControls();
    if (Auth.options?.onUserChange) Auth.options.onUserChange(Auth.user);
};

Auth.isAuthenticated = () => Boolean(Auth.user || Auth._app().user);

Auth.requireAuth = (actionName, onAllowed) => {
    if (Auth.isAuthenticated()) {
        if (onAllowed) onAllowed(Auth.user || Auth._app().user);
        return true;
    }

    const message = actionName ? `Login required to ${actionName}.` : "Login required.";
    Auth._notify(message);
    if (Auth._app().UI?.modalUser) Auth._app().UI.modalUser(message);
    if (Auth.options?.onLoginRequired) Auth.options.onLoginRequired(message);
    return false;
};

Auth._notify = (message) => {
    if (Auth.options?.notify) Auth.options.notify(message);
    else if (Auth._app().FE?.showToast) Auth._app().FE.showToast(message);
};

Auth.consumeRedirectReason = () => {
    const url = new URL(window.location.href);
    let reason = url.searchParams.get("reason");
    // Older HESTIA Portal releases appended `?reason=` even when redirect_url
    // already had a query string or fragment. Recover that response without
    // losing the original scene parameters.
    if (!reason) {
        const malformedSearch = url.search.match(/\?reason=([^&#]+)/);
        if (malformedSearch) {
            reason = decodeURIComponent(malformedSearch[1]);
            url.search = url.search.slice(0, malformedSearch.index);
        }
        else {
            const malformedHash = url.hash.match(/\?reason=([^&#]+)/);
            if (malformedHash) {
                reason = decodeURIComponent(malformedHash[1]);
                url.hash = url.hash.slice(0, malformedHash.index);
            }
        }
    }
    if (!reason) return null;
    url.searchParams.delete("reason");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    return REASON_MESSAGES[reason] || `Authentication failed (${reason}).`;
};

export default Auth;
