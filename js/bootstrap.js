import SiteUtils from "./src/site_utils.js";

const viewer = document.getElementById("viewerApp");
const landing = document.getElementById("thothSiteApp");

if (SiteUtils.getPageMode(window.location.search) === "viewer") {
    if (viewer) viewer.hidden = false;
    if (landing) landing.hidden = true;
    await import("./main.js");
}
else {
    if (viewer) viewer.hidden = true;
    if (landing) landing.hidden = false;
    const { initSitePage } = await import("./site.js");
    await initSitePage("landing");
}
