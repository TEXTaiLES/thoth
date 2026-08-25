/*===========================================================================

    THOTH
    Landing page and My Scenes application

===========================================================================*/
import DeploymentConfig from "./src/deployment_config.js";
import API from "./src/api_client.js";
import Auth from "./src/auth.js";
import SiteUtils from "./src/site_utils.js";

const Site = {
    page: "landing",
    config: null,
    user: null,
    scenes: [],
    basePath: "/a/thoth/",
    modal: null
};

Site.el = id => document.getElementById(id);

Site.loadConfig = async () => {
    const selectorUrl = new URL("config/deployment.json", window.location.origin + Site.basePath);
    const selectorResponse = await fetch(selectorUrl, { credentials: "same-origin" });
    if (!selectorResponse.ok) throw new Error("Unable to load THOTH deployment selector");
    const selector = await selectorResponse.json();
    const source = DeploymentConfig.getSource(selector);
    const configResponse = await fetch(
        new URL(`config/${source}`, window.location.origin + Site.basePath),
        { credentials: "same-origin" }
    );
    if (!configResponse.ok) throw new Error("Unable to load THOTH deployment configuration");
    return DeploymentConfig.resolve(selector, await configResponse.json());
};

Site.notify = (message, tone = "info", duration = 5500) => {
    const region = Site.el("siteToastRegion");
    if (!region || !message) return;
    const toast = document.createElement("div");
    toast.className = `alert alert-${tone} shadow-sm mb-2 thoth-site-toast`;
    toast.setAttribute("role", tone === "danger" ? "alert" : "status");
    toast.textContent = String(message);
    region.append(toast);
    window.setTimeout(() => toast.remove(), duration);
};

Site.createElement = (tag, options = {}) => {
    const element = document.createElement(tag);
    if (options.className) element.className = options.className;
    if (options.text !== undefined) element.textContent = options.text;
    for (const [name, value] of Object.entries(options.attributes || {})) {
        element.setAttribute(name, value);
    }
    return element;
};

Site.showModal = ({ title, body, footer, size = "" }) => {
    const modalElement = Site.el("siteModal");
    Site.el("siteModalTitle").textContent = title || "THOTH";
    const dialog = modalElement.querySelector(".modal-dialog");
    dialog.className = `modal-dialog modal-dialog-centered modal-dialog-scrollable ${size}`.trim();
    const bodyElement = Site.el("siteModalBody");
    const footerElement = Site.el("siteModalFooter");
    bodyElement.replaceChildren(body || document.createTextNode(""));
    footerElement.replaceChildren(...(footer ? [footer] : []));
    footerElement.hidden = !footer;
    Site.modal = bootstrap.Modal.getOrCreateInstance(modalElement);
    Site.modal.show();
    return Site.modal;
};

Site.hideModal = () => Site.modal?.hide();

Site.renderShell = () => {
    const root = Site.el("thothSiteApp");
    root.innerHTML = `
        <nav class="navbar navbar-expand-md bg-body-tertiary fixed-top aton-navbar thoth-site-navbar" aria-label="THOTH navigation">
            <div class="container-fluid">
                <a class="navbar-brand" href="${Site.basePath}" aria-label="THOTH home">
                    <img src="${Site.basePath}appicon.png" alt="THOTH" height="38" width="38">
                </a>
                <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#thothNavbarContent" aria-controls="thothNavbarContent" aria-expanded="false" aria-label="Toggle navigation">
                    <span class="navbar-toggler-icon"></span>
                </button>
                <div class="collapse navbar-collapse gap-2" id="thothNavbarContent">
                    <ul class="navbar-nav me-auto" id="siteNavSections"></ul>
                    <form class="d-flex thoth-site-search" role="search" id="siteSearchForm">
                        <label class="visually-hidden" for="siteSearchInput" id="siteSearchLabel"></label>
                        <div class="input-group">
                            <span class="input-group-text"><i class="bi bi-search" aria-hidden="true"></i></span>
                            <input class="form-control" type="search" id="siteSearchInput" autocomplete="off" spellcheck="false">
                        </div>
                    </form>
                    <div class="d-flex gap-2 align-items-center" id="siteAuthControls"></div>
                </div>
            </div>
        </nav>
        <main id="siteMain" class="thoth-site-main"></main>
        <footer class="aton-footer thoth-site-footer">
            <a href="https://aton.ispc.cnr.it/site/" target="_blank" rel="noopener noreferrer"><b>ATON</b></a>
            framework by <a href="https://ispc.cnr.it/" target="_blank" rel="noopener noreferrer">CNR ISPC</a>
        </footer>
        <div id="siteToastRegion" class="position-fixed bottom-0 start-50 translate-middle-x p-3 thoth-site-toast-region" aria-live="polite" aria-atomic="false"></div>
        <div class="modal fade" id="siteModal" tabindex="-1" aria-labelledby="siteModalTitle" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 class="modal-title fs-5" id="siteModalTitle">THOTH</h2>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body" id="siteModalBody"></div>
                    <div class="modal-footer" id="siteModalFooter"></div>
                </div>
            </div>
        </div>`;

    const input = Site.el("siteSearchInput");
    const label = Site.el("siteSearchLabel");
    if (Site.page === "landing") {
        input.placeholder = "Open scene by ID";
        input.setAttribute("aria-label", "Open scene by ID");
        label.textContent = "Open scene by ID";
        Site.el("siteSearchForm").addEventListener("submit", event => {
            event.preventDefault();
            const sceneId = input.value.trim();
            if (!sceneId) {
                Site.notify("Enter a scene ID to open.", "warning");
                input.focus();
                return;
            }
            window.location.assign(SiteUtils.sceneUrl(sceneId, Site.basePath));
        });
    }
    else {
        input.placeholder = "Filter my scenes";
        input.setAttribute("aria-label", "Filter my scenes");
        label.textContent = "Filter my scenes";
        Site.el("siteSearchForm").addEventListener("submit", event => event.preventDefault());
        input.addEventListener("input", () => Site.renderSceneCards(input.value));
    }
};

Site.renderLanding = () => {
    Site.el("siteMain").innerHTML = `
        <section class="thoth-hero">
            <div class="container col-xxl-9 px-4 py-5">
                <div class="row flex-lg-row-reverse align-items-center g-5 py-5">
                    <div class="col-12 col-lg-5 text-center">
                        <img src="${Site.basePath}appicon.png" class="thoth-hero-logo img-fluid" alt="THOTH logo">
                        <img src="${Site.basePath}res/Logo-Textailes-Colour-RGB-Hor.png" class="thoth-partner-logo img-fluid mt-4" alt="TEXTaiLES logo">
                    </div>
                    <div class="col-lg-7">
                        <p class="text-uppercase fw-semibold text-secondary mb-2">TEXTaiLES toolbox</p>
                        <h1 class="display-4 fw-bold lh-1 mb-3">THOTH 3D Viewer and Annotator</h1>
                        <p class="lead">Explore, inspect, and annotate cultural-heritage 3D models through a focused web workspace built on the ATON framework.</p>
                        <div class="d-grid gap-2 d-sm-flex justify-content-sm-start mt-4">
                            <a class="btn btn-secondary btn-lg px-4" href="https://aton.ispc.cnr.it/site/" target="_blank" rel="noopener noreferrer">ATON Website <span class="visually-hidden">(opens in a new tab)</span></a>
                            <a class="btn btn-secondary btn-lg px-4" href="https://textailes.athenarc.gr" target="_blank" rel="noopener noreferrer">TEXTaiLES <span class="visually-hidden">(opens in a new tab)</span></a>
                        </div>
                    </div>
                </div>
            </div>
        </section>`;
};

Site.renderNav = () => {
    const sections = Site.el("siteNavSections");
    sections.replaceChildren();
    if (Site.user) {
        const item = Site.createElement("li", { className: "nav-item" });
        const link = Site.createElement("a", {
            className: `nav-link${Site.page === "myscenes" ? " active" : ""}`,
            text: "My Scenes",
            attributes: { href: `${Site.basePath}myscenes/` }
        });
        if (Site.page === "myscenes") link.setAttribute("aria-current", "page");
        item.append(link);
        sections.append(item);
    }

    const controls = Site.el("siteAuthControls");
    controls.replaceChildren();
    if (!Site.user) {
        const login = Site.createElement("button", {
            className: "btn btn-secondary",
            text: "Login",
            attributes: { type: "button" }
        });
        login.addEventListener("click", () => Site.showLoginModal());
        controls.append(login);
        return;
    }

    const userButton = Site.createElement("button", {
        className: "btn btn-secondary",
        text: Site.user.username || Site.user.email || "Account",
        attributes: { type: "button", "aria-label": "Open account menu" }
    });
    userButton.addEventListener("click", () => Site.showAccountModal());
    controls.append(userButton);
};

Site.showLoginModal = (message = "") => {
    const body = Site.createElement("div", { className: "d-grid gap-3" });
    if (message) body.append(Site.createElement("div", {
        className: "alert alert-info mb-0",
        text: message,
        attributes: { role: "status" }
    }));
    const redirect = `${Site.basePath}myscenes/`;

    if (Auth.isHestiaMode()) {
        const egi = Site.createElement("button", {
            className: "btn btn-primary btn-lg",
            text: "Login with EGI",
            attributes: { type: "button" }
        });
        const portal = Site.createElement("button", {
            className: "btn btn-outline-secondary btn-lg",
            text: "Login through HESTIA Portal",
            attributes: { type: "button" }
        });
        egi.addEventListener("click", () => Auth.startEgiLogin(redirect));
        portal.addEventListener("click", () => Auth.startHestiaLogin(redirect));
        body.append(egi, portal);
        Site.showModal({ title: "Sign in to THOTH", body });
        return;
    }

    const form = Site.createElement("form", { className: "d-grid gap-3" });
    const username = Site.createElement("input", {
        className: "form-control",
        attributes: { name: "username", autocomplete: "username", required: "", placeholder: "Username", "aria-label": "Username" }
    });
    const password = Site.createElement("input", {
        className: "form-control",
        attributes: { name: "password", type: "password", autocomplete: "current-password", required: "", placeholder: "Password", "aria-label": "Password" }
    });
    const error = Site.createElement("div", { className: "text-danger", attributes: { role: "alert" } });
    const submit = Site.createElement("button", {
        className: "btn btn-primary btn-lg",
        text: "Login",
        attributes: { type: "submit" }
    });
    form.addEventListener("submit", async event => {
        event.preventDefault();
        submit.disabled = true;
        submit.textContent = "Signing in…";
        error.textContent = "";
        const response = await Auth.loginAton(username.value, password.value);
        if (!response.ok) {
            error.textContent = response.error || "Authentication failed";
            submit.disabled = false;
            submit.textContent = "Login";
            return;
        }
        window.location.assign(redirect);
    });
    form.append(username, password, error, submit);
    body.append(form);
    Site.showModal({ title: "Sign in to THOTH", body });
    window.setTimeout(() => username.focus(), 250);
};

Site.showAccountModal = () => {
    const body = Site.createElement("div", { className: "d-grid gap-2" });
    const myScenes = Site.createElement("a", {
        className: "btn btn-primary",
        text: "My Scenes",
        attributes: { href: `${Site.basePath}myscenes/` }
    });
    const logout = Site.createElement("button", {
        className: "btn btn-outline-secondary",
        text: "Logout",
        attributes: { type: "button" }
    });
    logout.addEventListener("click", () => {
        Site.notify("Logging out…");
        Site.hideModal();
        Auth.logout();
    });
    body.append(myScenes, logout);
    Site.showModal({ title: Site.user.username || Site.user.email || "Account", body });
};

Site.renderMyScenes = () => {
    Site.el("siteMain").innerHTML = `
        <section class="container-fluid thoth-scenes-page px-3 px-md-4 py-4">
            <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 border-bottom pb-3 mb-4">
                <div>
                    <h1 class="h2 mb-1">My Scenes</h1>
                    <p class="text-body-secondary mb-0">Total: <span id="sceneCount">0</span></p>
                </div>
                <button class="btn btn-primary btn-lg" id="newSceneButton" type="button" disabled>
                    <i class="bi bi-plus-lg" aria-hidden="true"></i> New Scene
                </button>
            </div>
            <div id="sceneStatus" aria-live="polite"></div>
            <div id="sceneGrid" class="thoth-scene-grid"></div>
        </section>`;
    Site.el("newSceneButton").addEventListener("click", () => Site.showNewSceneModal());
};

Site.setSceneStatus = (message, tone = "secondary") => {
    const status = Site.el("sceneStatus");
    status.replaceChildren();
    if (!message) return;
    status.append(Site.createElement("div", {
        className: `alert alert-${tone} thoth-scenes-state`,
        text: message,
        attributes: { role: tone === "danger" ? "alert" : "status" }
    }));
};

Site.loadScenes = async () => {
    if (!Site.user) {
        Site.setSceneStatus("Login to view and manage your scenes.", "info");
        Site.showLoginModal("Login is required to open My Scenes.");
        return;
    }
    Site.el("newSceneButton").disabled = false;
    if (!API.hasPersonalSceneList()) {
        Site.setSceneStatus("Personal HESTIA scene listing is not yet supported. You can still create a new scene and open it immediately.", "info");
        Site.el("sceneCount").textContent = "—";
        return;
    }

    Site.setSceneStatus("Loading your scenes…", "secondary");
    const response = await API.listScenes(Site.user);
    if (!response.ok) {
        Site.setSceneStatus(response.error || "Unable to load your scenes.", "danger");
        return;
    }
    Site.scenes = SiteUtils.sortScenes(response.data);
    Site.el("sceneCount").textContent = String(Site.scenes.length);
    Site.setSceneStatus(Site.scenes.length ? "" : "You do not have any scenes yet. Create one to get started.", "secondary");
    Site.renderSceneCards(Site.el("siteSearchInput")?.value || "");
};

Site.renderSceneCards = (term = "") => {
    const grid = Site.el("sceneGrid");
    if (!grid) return;
    grid.replaceChildren();
    const scenes = Site.scenes.filter(scene => SiteUtils.matchesScene(scene, term));
    for (const scene of scenes) grid.append(Site.createSceneCard(scene));
    if (Site.scenes.length && !scenes.length) {
        grid.append(Site.createElement("p", {
            className: "text-body-secondary text-center py-5 grid-column-full",
            text: "No scenes match this search."
        }));
    }
};

Site.createSceneCard = scene => {
    const card = Site.createElement("article", {
        className: "card aton-card thoth-scene-card shadow-sm",
        attributes: { "data-search-term": `${scene.title} ${scene.id}`.toLocaleLowerCase() }
    });
    const open = Site.createElement("a", {
        className: "thoth-scene-cover",
        attributes: { href: SiteUtils.sceneUrl(scene.id, Site.basePath), "aria-label": `Open ${scene.title}` }
    });
    const image = Site.createElement("img", {
        className: "card-img-top",
        attributes: {
            src: scene.cover || `${Site.basePath}appicon.png`,
            alt: "",
            loading: "lazy"
        }
    });
    image.addEventListener("error", () => {
        image.src = `${Site.basePath}appicon.png`;
        image.classList.add("thoth-scene-placeholder");
    }, { once: true });
    open.append(image);

    const body = Site.createElement("div", { className: "card-body d-flex flex-column" });
    const title = Site.createElement("h2", { className: "h5 card-title", text: scene.title || scene.id });
    const id = Site.createElement("p", { className: "small text-body-secondary text-break", text: scene.id });
    body.append(title, id);
    const date = SiteUtils.formatDate(scene.creationDate);
    if (date) body.append(Site.createElement("p", { className: "small mb-2", text: date }));
    const keywords = Array.isArray(scene.keywords)
        ? scene.keywords
        : Object.keys(scene.keywords || {});
    if (keywords.length) {
        const keywordRow = Site.createElement("div", { className: "d-flex flex-wrap gap-1 mb-3" });
        for (const keyword of keywords) keywordRow.append(Site.createElement("span", {
            className: "badge text-bg-secondary",
            text: keyword
        }));
        body.append(keywordRow);
    }
    const actions = Site.createElement("div", { className: "d-grid mt-auto" });
    const manage = Site.createElement("button", {
        className: "btn btn-outline-secondary",
        text: "Manage",
        attributes: { type: "button", "aria-label": `Manage ${scene.title || scene.id}` }
    });
    manage.addEventListener("click", () => Site.showManageModal(scene));
    actions.append(manage);
    body.append(actions);
    card.append(open, body);
    return card;
};

Site.showManageModal = scene => {
    const body = Site.createElement("div", { className: "d-grid gap-3" });
    body.append(Site.createElement("p", {
        className: "mb-0",
        text: "Delete this scene descriptor. Referenced model resources will not be removed."
    }));
    const button = Site.createElement("button", {
        className: "btn btn-danger",
        text: "Delete this scene",
        attributes: { type: "button" }
    });
    if (!API.supportsSceneOperation("DELETE")) {
        button.disabled = true;
        button.setAttribute("aria-describedby", "deleteUnsupported");
        const notice = Site.createElement("div", {
            className: "alert alert-info mb-0",
            text: "Scene deletion is not yet supported by HESTIA.",
            attributes: { id: "deleteUnsupported", role: "status" }
        });
        body.append(notice, button);
    }
    else {
        button.addEventListener("click", async () => {
            if (!window.confirm(`Delete scene “${scene.title || scene.id}”? This cannot be undone.`)) return;
            button.disabled = true;
            button.textContent = "Deleting…";
            const response = await API.deleteScene(scene.id);
            if (!response.ok) {
                Site.notify(response.error || "Scene deletion failed.", "danger");
                button.disabled = false;
                button.textContent = "Delete this scene";
                return;
            }
            Site.scenes = Site.scenes.filter(entry => entry.id !== scene.id);
            Site.el("sceneCount").textContent = String(Site.scenes.length);
            Site.hideModal();
            Site.notify("Scene deleted successfully.", "success");
            Site.renderSceneCards(Site.el("siteSearchInput")?.value || "");
            if (!Site.scenes.length) Site.setSceneStatus("You do not have any scenes yet. Create one to get started.");
        });
        body.append(button);
    }
    Site.showModal({ title: scene.title || scene.id, body });
};

Site.showNewSceneModal = async () => {
    const body = Site.createElement("form", { className: "d-grid gap-3", attributes: { id: "newSceneForm" } });
    const nameGroup = Site.createElement("div");
    const nameLabel = Site.createElement("label", { className: "form-label", text: "Scene name", attributes: { for: "newSceneName" } });
    const name = Site.createElement("input", {
        className: "form-control",
        attributes: { id: "newSceneName", required: "", maxlength: "100", autocomplete: "off" }
    });
    nameGroup.append(nameLabel, name);

    const searchGroup = Site.createElement("div");
    const searchLabel = Site.createElement("label", { className: "form-label", text: "Search models", attributes: { for: "modelSearch" } });
    const search = Site.createElement("input", {
        className: "form-control",
        attributes: { id: "modelSearch", type: "search", placeholder: "Filter available models", disabled: "" }
    });
    searchGroup.append(searchLabel, search);
    const modelStatus = Site.createElement("div", {
        className: "text-body-secondary small",
        text: "Loading models…",
        attributes: { role: "status", "aria-live": "polite" }
    });
    const modelList = Site.createElement("div", {
        className: "thoth-model-picker border rounded p-2",
        attributes: { role: "group", "aria-label": "Available models" }
    });
    const selectedTitle = Site.createElement("p", { className: "form-label mb-1", text: "Selected models" });
    const selectedList = Site.createElement("div", {
        className: "d-flex flex-wrap gap-2",
        attributes: { "aria-live": "polite" }
    });
    const collaboration = Site.createElement("div", { className: "form-check form-switch" });
    const collaborative = Site.createElement("input", {
        className: "form-check-input",
        attributes: { type: "checkbox", role: "switch", id: "newSceneCollaborative" }
    });
    const collaborationLabel = Site.createElement("label", {
        className: "form-check-label",
        text: "Enable collaboration",
        attributes: { for: "newSceneCollaborative" }
    });
    collaboration.append(collaborative, collaborationLabel);
    const validation = Site.createElement("div", { className: "text-danger", attributes: { role: "alert" } });
    body.append(nameGroup, searchGroup, modelStatus, modelList, selectedTitle, selectedList, collaboration, validation);

    const submit = Site.createElement("button", {
        className: "btn btn-primary",
        text: "Create Scene",
        attributes: { type: "submit", form: "newSceneForm", disabled: "" }
    });
    const cancel = Site.createElement("button", {
        className: "btn btn-outline-secondary",
        text: "Cancel",
        attributes: { type: "button", "data-bs-dismiss": "modal" }
    });
    const footer = Site.createElement("div", { className: "d-flex gap-2" });
    footer.append(cancel, submit);
    Site.showModal({ title: "New Scene", body, footer, size: "modal-lg" });

    const selected = new Map();
    let models = [];
    let loading = true;
    let submitting = false;
    const updateSubmit = () => {
        submit.disabled = loading || submitting || !name.value.trim() || selected.size < 1;
    };
    const renderSelected = () => {
        selectedList.replaceChildren();
        if (!selected.size) {
            selectedList.append(Site.createElement("span", { className: "text-body-secondary small", text: "No models selected" }));
        }
        for (const model of selected.values()) {
            const chip = Site.createElement("button", {
                className: "btn btn-sm btn-secondary",
                text: `${model.title} ×`,
                attributes: { type: "button", "aria-label": `Remove ${model.title}` }
            });
            chip.addEventListener("click", () => {
                selected.delete(model.id);
                renderModels();
                renderSelected();
                updateSubmit();
            });
            selectedList.append(chip);
        }
    };
    const renderModels = () => {
        modelList.replaceChildren();
        const term = search.value.trim().toLocaleLowerCase();
        const visible = models.filter(model => !term || `${model.title} ${model.id}`.toLocaleLowerCase().includes(term));
        if (!visible.length) {
            modelList.append(Site.createElement("p", { className: "text-body-secondary mb-0 p-2", text: "No models match this search." }));
            return;
        }
        for (const model of visible) {
            const row = Site.createElement("div", { className: "form-check thoth-model-picker-row" });
            const inputId = `model-${String(model.id).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
            const checkbox = Site.createElement("input", {
                className: "form-check-input",
                attributes: { type: "checkbox", id: inputId, value: model.id }
            });
            checkbox.checked = selected.has(model.id);
            const label = Site.createElement("label", {
                className: "form-check-label w-100",
                text: model.title === model.id ? model.title : `${model.title} (${model.id})`,
                attributes: { for: inputId }
            });
            checkbox.addEventListener("change", () => {
                if (checkbox.checked) selected.set(model.id, model);
                else selected.delete(model.id);
                renderSelected();
                updateSubmit();
            });
            row.append(checkbox, label);
            modelList.append(row);
        }
    };
    name.addEventListener("input", updateSubmit);
    search.addEventListener("input", renderModels);
    renderSelected();

    const response = await API.listModels(Site.user);
    loading = false;
    if (!response.ok) {
        modelStatus.className = "text-danger small";
        modelStatus.textContent = response.error || "Unable to load models.";
        modelList.replaceChildren();
    }
    else {
        models = response.data;
        modelStatus.textContent = models.length
            ? `${models.length} model${models.length === 1 ? "" : "s"} available.`
            : "No compatible 3D models are available for this account.";
        search.disabled = !models.length;
        renderModels();
    }
    updateSubmit();

    body.addEventListener("submit", async event => {
        event.preventDefault();
        validation.textContent = "";
        if (!name.value.trim()) validation.textContent = "Scene name is required.";
        else if (!selected.size) validation.textContent = "Select at least one model.";
        if (validation.textContent) return;
        submitting = true;
        updateSubmit();
        submit.textContent = "Creating…";
        const createResponse = await API.createScene({
            name: name.value,
            models: Array.from(selected.values()),
            collaborative: collaborative.checked
        });
        if (!createResponse.ok) {
            validation.textContent = createResponse.error || "Scene creation failed.";
            submitting = false;
            submit.textContent = "Create Scene";
            updateSubmit();
            return;
        }
        const sceneId = createResponse.data?.scene_id;
        Site.hideModal();
        const message = Site.config.deploymentMode === "hestia"
            ? "Scene created. Personal HESTIA scene listing is not yet supported."
            : "Scene created successfully.";
        try {
            window.sessionStorage.setItem("thoth:flash", JSON.stringify({ message, tone: "success" }));
        }
        catch {
            Site.notify(message, "success");
        }
        window.location.assign(SiteUtils.sceneUrl(sceneId, Site.basePath));
    });
    window.setTimeout(() => name.focus(), 250);
};

export const initSitePage = async (page = document.body.dataset.thothPage || "landing") => {
    Site.page = page;
    Site.basePath = SiteUtils.getAppBasePath(window.location.pathname);
    Site.renderShell();
    if (page === "landing") Site.renderLanding();
    else Site.renderMyScenes();

    try {
        if (globalThis.ATON?.realize2D) globalThis.ATON.realize2D();
        Site.config = await Site.loadConfig();
        API.setup(Site.config, {
            aton: globalThis.ATON,
            notify: Site.notify,
            baseURL: window.location.origin + Site.basePath
        });
        Auth.setup({
            config: Site.config,
            baseURL: Site.basePath.replace(/\/$/, ""),
            aton: globalThis.ATON,
            app: Site,
            notify: Site.notify,
            onUserChange: user => {
                Site.user = user;
                Site.renderNav();
            },
            onLoginRequired: message => Site.showLoginModal(message)
        });
        const reason = Auth.consumeRedirectReason();
        if (reason) Site.notify(reason, "danger", 8000);
        Site.user = await Auth.getUser().catch(error => {
            Site.notify(error.message || "Authentication service unavailable.", "danger");
            return null;
        });
        Auth.setAuthState(Site.user);
        if (page === "myscenes") await Site.loadScenes();
    }
    catch (error) {
        Site.notify(error.message || "THOTH could not start.", "danger", 10000);
        if (page === "myscenes") Site.setSceneStatus("THOTH configuration could not be loaded.", "danger");
    }
};

export default Site;
