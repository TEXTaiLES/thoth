import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import SiteUtils from "../src/site_utils.js";

test("root dispatch selects landing unless scene_id is non-empty", () => {
    assert.equal(SiteUtils.getPageMode(""), "landing");
    assert.equal(SiteUtils.getPageMode("?scene_id="), "landing");
    assert.equal(SiteUtils.getPageMode("?scene_id=%20"), "landing");
    assert.equal(SiteUtils.getPageMode("?artefact_id=abc"), "landing");
    assert.equal(SiteUtils.getPageMode("?scene_id=user%2Fscene&artefact_id=abc"), "viewer");
});

test("a dynamically imported ATON app starts when window load already completed", () => {
    let starts = 0;
    const aton = { App: { run: () => { starts += 1; return true; } } };

    assert.equal(SiteUtils.startLoadedAtonApp("loading", aton), false);
    assert.equal(starts, 0);
    assert.equal(SiteUtils.startLoadedAtonApp("complete", aton), true);
    assert.equal(starts, 1);
});

test("scene URLs encode IDs without losing slashes or spaces", () => {
    const url = SiteUtils.sceneUrl("alice/fabric study", "/a/thoth/");
    assert.equal(url, "/a/thoth/?scene_id=alice%2Ffabric+study");
    assert.equal(new URL(url, "http://localhost").searchParams.get("scene_id"), "alice/fabric study");
});

test("app base path remains scoped to THOTH", () => {
    assert.equal(SiteUtils.getAppBasePath("/a/thoth/"), "/a/thoth/");
    assert.equal(SiteUtils.getAppBasePath("/a/thoth/myscenes/"), "/a/thoth/");
    assert.equal(SiteUtils.getAppBasePath("/prefix/a/thoth/myscenes/"), "/prefix/a/thoth/");
});

test("scene filtering uses ID and title", () => {
    const scene = { id: "alice/scene-42", title: "Blue Textile" };
    assert.equal(SiteUtils.matchesScene(scene, "textile"), true);
    assert.equal(SiteUtils.matchesScene(scene, "SCENE-42"), true);
    assert.equal(SiteUtils.matchesScene(scene, "ceramic"), false);
});

test("the static My Scenes route exists", () => {
    const path = fileURLToPath(new URL("../../myscenes/index.html", import.meta.url));
    assert.equal(existsSync(path), true);
});
