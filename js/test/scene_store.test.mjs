import assert from "node:assert/strict";
import test from "node:test";
import SceneStore from "../src/scene_store.js";

test("scene presentation metadata survives parsing and export", () => {
    SceneStore.setup();
    SceneStore.parseScene({ title: "Textile Study", description: "A scene", models: {} });
    assert.deepEqual(SceneStore.getExportData(), {
        title: "Textile Study",
        description: "A scene",
        models: {}
    });
});

test("model parser refresh preserves presentation fields parsed separately", () => {
    SceneStore.setup();
    SceneStore.setSceneField("title", "Preserved title");
    SceneStore.parseScene({ models: {} });
    assert.equal(SceneStore.getScene().title, "Preserved title");
});
