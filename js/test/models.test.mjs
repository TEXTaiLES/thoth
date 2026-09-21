import assert from "node:assert/strict";
import test from "node:test";
import Models from "../src/models.js";

test("HESTIA model URLs reach ATON as absolute URLs in new and saved scenes", () => {
    const originalWindow = globalThis.window;
    const originalAton = globalThis.ATON;
    const originalThoth = globalThis.THOTH;
    const originalApplyTransforms = Models._applyCanonicalTransforms;
    const proxyPath = "/hestia/storage/reconstructions/scan-1/model.glb";
    const absoluteUrl = "https://thoth.example.test" + proxyPath;
    const loaded = [];
    const persisted = [];
    const node = () => ({
        removeChildren() { return this; },
        load(url) { loaded.push(url); return this; }
    });

    try {
        globalThis.window = { location: { href: "https://thoth.example.test/a/thoth/?scene_id=one" } };
        globalThis.ATON = {
            getOrCreateSceneNode: node,
            getSceneNode: () => undefined,
            createSceneNode: node,
            SceneHub: { _applyJSONTransformToNode() {} }
        };
        globalThis.THOTH = {
            Artefacts: {
                getModelURL: () => proxyPath,
                parseModelArtefact: (id, data) => persisted.push({ id, data })
            },
            Transforms: { getModelTransform: () => undefined },
            Selections: { parseSelections() {} },
            MSR: { parseMeasurements() {} },
            SemAnnotations: { parseAnnotations() {} }
        };
        Models._applyCanonicalTransforms = () => {};
        Models.modelMap = new Map();
        Models._hasFocusedInitialScene = true;

        Models.addModelFromURL(proxyPath, "scan-1");
        Models.parseModels({ "scan-2": { annotations: {} } });

        assert.deepEqual(loaded, [absoluteUrl, absoluteUrl]);
        assert.deepEqual(persisted, [{ id: "scan-1", data: { gltf_file: proxyPath } }]);
        assert.equal(Models.resolveLoadURL("alice/models/cloth.glb"), "alice/models/cloth.glb");
        assert.equal(Models.resolveLoadURL(absoluteUrl), absoluteUrl);
    }
    finally {
        Models._applyCanonicalTransforms = originalApplyTransforms;
        globalThis.window = originalWindow;
        globalThis.ATON = originalAton;
        globalThis.THOTH = originalThoth;
    }
});
