import assert from "node:assert/strict";
import test from "node:test";
import API from "../src/api_client.js";

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;

const response = (data, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 400 ? "Error" : "OK",
    headers: { get: name => name.toLowerCase() === "content-type" ? "application/json" : "" },
    text: async () => data === null ? "" : JSON.stringify(data)
});

test.beforeEach(() => {
    globalThis.window = { location: { href: "http://localhost:8080/a/thoth/myscenes/" } };
});

test.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
});

test("local scene creation sends canonical model map and uses returned ATON ID", async () => {
    let captured;
    globalThis.fetch = async (url, options) => {
        captured = { url: String(url), options };
        return response("alice/generated-id");
    };
    API.setup(
        { deploymentMode: "local", use_endpoints: false, ATONSceneUrl: "../../api/v2/scenes/" },
        { baseURL: "http://localhost:8080/a/thoth/" }
    );
    const result = await API.createScene({
        name: "Textile Study",
        collaborative: true,
        models: [{ id: "cloth.glb", title: "Cloth", url: "alice/models/cloth.glb" }]
    });

    assert.equal(result.ok, true);
    assert.equal(result.data.scene_id, "alice/generated-id");
    assert.equal(captured.url, "http://localhost:8080/api/v2/scenes/");
    const body = JSON.parse(captured.options.body);
    assert.equal(body.data.title, "Textile Study");
    assert.equal(body.data.collaborative, true);
    assert.equal(body.data.models["cloth.glb"].artefact.gltf_file, "alice/models/cloth.glb");
});

test("local scene listing is scoped to the authenticated username", async () => {
    let requestedUrl;
    globalThis.fetch = async url => {
        requestedUrl = String(url);
        return response([{ sid: "alice/one", title: "One" }]);
    };
    API.setup(
        { deploymentMode: "local", use_endpoints: false, ATONSceneUrl: "../../api/v2/scenes/" },
        { baseURL: "http://localhost:8080/a/thoth/" }
    );
    const result = await API.listScenes({ username: "alice" });
    assert.equal(result.ok, true);
    assert.equal(requestedUrl, "http://localhost:8080/api/v2/scenes/alice");
    assert.deepEqual(result.data.map(scene => scene.id), ["alice/one"]);
});

test("local deletion preserves the full username/scene path", async () => {
    let requested;
    globalThis.fetch = async (url, options) => {
        requested = { url: String(url), method: options.method };
        return response(true);
    };
    API.setup(
        { deploymentMode: "local", use_endpoints: false, ATONSceneUrl: "../../api/v2/scenes/" },
        { baseURL: "http://localhost:8080/a/thoth/" }
    );
    const result = await API.deleteScene("alice/fabric study");
    assert.equal(result.ok, true);
    assert.deepEqual(requested, {
        url: "http://localhost:8080/api/v2/scenes/alice/fabric%20study",
        method: "DELETE"
    });
});

test("HESTIA creation uses configured POST endpoint and a model list", async () => {
    let captured;
    globalThis.fetch = async (url, options) => {
        captured = { url: String(url), options };
        return response({ scene_id: "textile-fixed" }, 201);
    };
    API.setup({
        deploymentMode: "hestia",
        use_endpoints: true,
        endpoints: { scene: { endpoint_url: "/hestia/scenes", methods: ["GET", "POST", "PUT"], enabled: true } }
    });
    const result = await API.createScene({
        name: "Textile Study",
        models: [{ id: "artifact-1", title: "Cloth", url: "/hestia/storage/cloth.glb" }]
    });
    assert.equal(result.ok, true);
    assert.equal(captured.url, "http://localhost:8080/hestia/scenes");
    const body = JSON.parse(captured.options.body);
    assert.match(body.scene_id, /^textile-study-/);
    assert.equal(Array.isArray(body.models), true);
    assert.equal(body.models[0].id, "artifact-1");
});

test("HESTIA personal listing and deletion are explicit unsupported states", async () => {
    let fetchCalled = false;
    globalThis.fetch = async () => {
        fetchCalled = true;
        return response({});
    };
    API.setup({
        deploymentMode: "hestia",
        use_endpoints: true,
        endpoints: { scene: { endpoint_url: "/hestia/scenes", methods: ["GET", "POST", "PUT"], enabled: true } }
    });
    const list = await API.listScenes({ username: "alice" });
    const deletion = await API.deleteScene("scene-1");
    assert.equal(list.unsupported, true);
    assert.equal(list.code, "PERSONAL_SCENE_LIST_UNSUPPORTED");
    assert.equal(deletion.unsupported, true);
    assert.equal(deletion.code, "SCENE_DELETE_UNSUPPORTED");
    assert.equal(fetchCalled, false);
});

test("model normalization strips the local collection prefix but preserves its URL", () => {
    API.setup({ deploymentMode: "local", use_endpoints: false });
    const model = API._normalizeModelEntry("alice/models/subfolder/cloth.glb", { username: "alice" });
    assert.equal(model.id, "cloth.glb");
    assert.equal(model.title, "subfolder/cloth.glb");
    assert.equal(model.url, "alice/models/subfolder/cloth.glb");
});

test("HESTIA reconstruction listing resolves its GLBs through the protected storage proxy", async () => {
    const rows = [
        {
            object_id: "scan-1",
            scan_id: "statue",
            filename: "model.glb",
            glb_location: "s3://reconstructions/scan-1/model.glb",
            public_url_glb: "http://localhost:9000/reconstructions/scan-1/model.glb"
        },
        {
            object_id: "scan-3",
            scan_id: "statue",
            filename: "model.glb",
            glb_location: "s3://reconstructions/scan-3/model.glb"
        },
        {
            object_id: "scan-4",
            scan_id: "rock",
            filename: "model.glb",
            glb_location: "s3://reconstructions/scan-4/model.glb"
        },
        {
            object_id: "scan-2",
            scan_id: "box",
            filename: "model.obj",
            glb_location: null,
            public_url_glb: null
        }
    ];
    const requests = [];
    globalThis.fetch = async url => {
        requests.push(String(url));
        return response(rows);
    };
    API.setup({
        deploymentMode: "hestia",
        hestiaApiPublicUrl: "https://api.textailes.athenarc.gr",
        use_endpoints: true,
        endpoints: {
            list_models: { endpoint_url: "/hestia/reconstructions", methods: ["GET"], enabled: true }
        }
    });

    const listed = await API.listModels({ username: "alice" });
    assert.equal(listed.ok, true);
    assert.deepEqual(listed.data.map(model => model.id), ["scan-1", "scan-3", "scan-4"]);
    assert.deepEqual(listed.data.map(model => model.title), ["statue", "statue", "rock"]);
    assert.deepEqual(listed.data.map(model => model.displayLabel), ["statue (scan-1)", "statue (scan-3)", "rock"]);
    assert.equal(listed.data[0].url, "/hestia/storage/reconstructions/scan-1/model.glb");
    assert.equal(API._proxyAssetUrl(listed.data[0].url), listed.data[0].url);

    const selected = await API.getGlbModel("scan-1");
    assert.equal(selected.ok, true);
    assert.equal(selected.data.gltf_file, "/hestia/storage/reconstructions/scan-1/model.glb");
    assert.deepEqual(requests, [
        "http://localhost:8080/hestia/reconstructions",
        "http://localhost:8080/hestia/reconstructions"
    ]);
});
