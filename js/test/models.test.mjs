import assert from "node:assert/strict";
import test from "node:test";
import Models from "../src/models.js";

test("HESTIA model URLs reach ATON as absolute URLs in new and saved scenes", () => {
    const originalWindow = globalThis.window;
    const originalAton = globalThis.ATON;
    const originalThoth = globalThis.THOTH;
    const originalApplyTransforms = Models._applyCanonicalTransforms;
    const originalOnLoad = Models.onLoad;
    const proxyPath = "/hestia/storage/reconstructions/scan-1/model.glb";
    const absoluteUrl = "https://thoth.example.test" + proxyPath;
    const loaded = [];
    const loadedSources = [];
    const persisted = [];
    const node = () => ({
        removeChildren() { return this; },
        attachToRoot() { return this; },
        load(url, done) { loaded.push(url); done(); return this; }
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
        Models.onLoad = (_model, options) => loadedSources.push(options.sourceURL);
        Models.modelMap = new Map();
        Models._hasFocusedInitialScene = true;

        Models.addModelFromURL(proxyPath, "scan-1");
        Models.parseModels({ "scan-2": { annotations: {} } });

        assert.deepEqual(loaded, [absoluteUrl, absoluteUrl]);
        assert.deepEqual(loadedSources, [proxyPath, proxyPath]);
        assert.deepEqual(persisted, [{ id: "scan-1", data: { gltf_file: proxyPath } }]);
        assert.equal(Models.resolveLoadURL("alice/models/cloth.glb"), "alice/models/cloth.glb");
        assert.equal(Models.resolveLoadURL(absoluteUrl), absoluteUrl);
    }
    finally {
        Models._applyCanonicalTransforms = originalApplyTransforms;
        Models.onLoad = originalOnLoad;
        globalThis.window = originalWindow;
        globalThis.ATON = originalAton;
        globalThis.THOTH = originalThoth;
    }
});

test("only same-origin HESTIA reconstruction GLBs get nonmetallic materials", () => {
    const originalWindow = globalThis.window;
    globalThis.window = { location: { href: "https://thoth.example.test/a/thoth/" } };
    const texture = { name: "embedded color map" };
    const textured = { metalness: 1, map: texture };
    const second = { metalness: 0.7 };
    const archiveMaterial = { metalness: 1, map: texture };
    const model = materials => ({
        traverse(callback) {
            callback({ isMesh: true, material: materials });
            callback({ isMesh: false, material: { metalness: 1 } });
        }
    });

    try {
        Models.setReconstructionMetalness(
            model([textured, second]),
            "/hestia/storage/reconstructions/scan-1/model.glb"
        );
        assert.equal(textured.metalness, 0);
        assert.equal(second.metalness, 0);
        assert.equal(textured.map, texture);

        Models.setReconstructionMetalness(
            model(archiveMaterial),
            "https://textailes.example.test/archive/assets/old.glb"
        );
        assert.equal(archiveMaterial.metalness, 1);

        const external = { metalness: 1 };
        Models.setReconstructionMetalness(
            model(external),
            "https://other.example.test/hestia/storage/reconstructions/scan-1/model.glb"
        );
        assert.equal(external.metalness, 1);
    }
    finally {
        globalThis.window = originalWindow;
    }
});
