/*===========================================================================

    THOTH
    Auth helpers

===========================================================================*/
let Auth = {};

Auth.setup = () => {
    Auth.user = null;
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
