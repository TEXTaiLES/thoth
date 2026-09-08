import SiteUtils from "./src/site_utils.js";

const viewer = document.getElementById("viewerApp");
const landing = document.getElementById("thothSiteApp");

if (SiteUtils.getPageMode(window.location.search) === "viewer") {
    if (viewer) viewer.hidden = false;
    if (landing) landing.hidden = true;
    await import("./main.js");

    // ATON.App.realize() starts the app from a window.load listener. Chromium
    // may complete that event while this conditional import is resolving,
    // leaving the newly registered listener too late to run. App.run() is
    // internally idempotent, so start it here only when load already finished.
    SiteUtils.startLoadedAtonApp(document.readyState, globalThis.ATON);
}
else {
    if (viewer) viewer.hidden = true;
    if (landing) landing.hidden = false;
    const { initSitePage } = await import("./site.js");
    await initSitePage("landing");
}
