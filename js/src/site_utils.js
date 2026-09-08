/*===========================================================================

    THOTH
    Landing and scene-management utilities

===========================================================================*/
const SiteUtils = {};

SiteUtils.getPageMode = (search = "") => {
    const sceneId = new URLSearchParams(search).get("scene_id");
    return sceneId !== null && sceneId.trim() !== "" ? "viewer" : "landing";
};

SiteUtils.startLoadedAtonApp = (readyState, aton = globalThis.ATON) => {
    if (readyState !== "complete" || typeof aton?.App?.run !== "function") return false;
    return aton.App.run();
};

SiteUtils.getAppBasePath = (pathname = "/a/thoth/") => {
    const marker = "/a/thoth";
    const index = pathname.toLowerCase().indexOf(marker);
    if (index < 0) return "/a/thoth/";
    return `${pathname.slice(0, index)}${marker}/`.replace(/\/+/g, "/");
};

SiteUtils.sceneUrl = (sceneId, basePath = "/a/thoth/") => {
    const url = new URL(basePath, "http://thoth.local");
    url.searchParams.set("scene_id", String(sceneId || "").trim());
    return `${url.pathname}${url.search}`;
};

SiteUtils.matchesScene = (scene, term = "") => {
    const query = String(term).trim().toLocaleLowerCase();
    if (!query) return true;
    return [scene?.id, scene?.sid, scene?.title]
        .filter(Boolean)
        .some(value => String(value).toLocaleLowerCase().includes(query));
};

SiteUtils.formatDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
    }).format(date);
};

SiteUtils.sortScenes = (scenes = []) => [...scenes].sort((a, b) => {
    const timeA = new Date(a?.creationDate || 0).getTime() || 0;
    const timeB = new Date(b?.creationDate || 0).getTime() || 0;
    if (timeA !== timeB) return timeB - timeA;
    return String(a?.title || a?.id || "").localeCompare(String(b?.title || b?.id || ""));
});

export default SiteUtils;
