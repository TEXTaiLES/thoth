/*===========================================================================

    THOTH
    Auth helpers

===========================================================================*/
let Auth = {};

Auth.setup = () => {
    Auth.user = null;
};

// Resolve a thoth server endpoint (whoami / egi-login / egi-logout) to an
// absolute URL relative to the current page (thoth is served at /a/thoth/).
Auth._url = (name) => new URL(`${THOTH.BASE_URL}/${name}`, window.location.href).href;

// Ask our EGI session endpoint who is logged in. Drop-in replacement for
// ATON.checkAuth(onLogged, onNotLogged): 200 => onLogged(user), else onNotLogged.
Auth.checkAuth = (onLogged, onNotLogged) => {
    fetch(Auth._url("whoami"), { credentials: "include" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
            if (data && data.authenticated) {
                if (onLogged) onLogged(data);
            }
            else if (onNotLogged) onNotLogged();
        })
        .catch(() => { if (onNotLogged) onNotLogged(); });
};

// Kick off EGI login, carrying the current scene URL so the callback lands us
// back on exactly this scene after authentication.
Auth.startLogin = () => {
    const target = new URL(Auth._url("egi-login"));
    target.searchParams.set("redirect", window.location.pathname + window.location.search);
    window.location.assign(target.href);
};

// Clear the thoth session cookie, then reload so the UI reflects logged-out state.
Auth.logout = () => {
    fetch(Auth._url("egi-logout"), { credentials: "include" })
        .catch(() => {})
        .finally(() => window.location.reload());
};

Auth.setAuthState = (user) => {
    Auth.user = user || null;
    THOTH.user = Auth.user;

    if (THOTH.FE?.syncAuthControls) THOTH.FE.syncAuthControls();
};

Auth.isAuthenticated = () => {
    return Boolean(Auth.user || THOTH.user);
};

Auth.requireAuth = (actionName, onAllowed) => {
    if (Auth.isAuthenticated()) {
        if (onAllowed) onAllowed(Auth.user || THOTH.user);
        return true;
    }

    const message = actionName
        ? `Login required to ${actionName}.`
        : "Login required.";

    if (THOTH.FE?.showToast) THOTH.FE.showToast(message);
    if (THOTH.UI?.modalUser) THOTH.UI.modalUser(message);

    return false;
};

export default Auth;
