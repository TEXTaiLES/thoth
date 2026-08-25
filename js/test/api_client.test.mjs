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
