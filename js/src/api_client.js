/*===========================================================================

    THOTH
    API client

===========================================================================*/
let API = {};

API.endpointNames = [
    "scene",
    "list_models",
    "glb_model",
    "artefact_data",
    "list_schemas",
    "schema",
    "metadata",
    "list_rgb_images",
    "rgb_image",
    "list_multispectral_images",
    "multispectral_image",
    "list_sensors",
    "sensor",
    "echoes",
    "authentication"
];

API.setup = (config = {}) => {
    API.config = config;
    API.endpoints = {};

    const configuredEndpoints =
        config.endpoints ||
        config.apiEndpoints ||
        config.api?.endpoints ||
        {};

    for (const name of API.endpointNames) {
        API.endpoints[name] = configuredEndpoints[name] || config[name];
    }
};

API.hasEndpoint = (name) => {
    return Boolean(API.getEndpoint(name));
};

API.supports = (name, method = "GET") => {
    const endpoint = API.getEndpointConfig(name);
    if (!endpoint) return false;
    if (typeof endpoint === "string") return true;
    if (!Array.isArray(endpoint.methods)) return true;
    return endpoint.methods.includes(String(method).toUpperCase());
};

API.getEndpoint = (name) => {
    const endpoint = API.getEndpointConfig(name);

    return endpoint?.endpoint_url || endpoint;
};

API.getEndpointConfig = (name) => {
    if (API.config?.use_endpoints !== true) return undefined;

    const endpoint = API.endpoints?.[name];
    if (!endpoint) return undefined;

    if (typeof endpoint === "string") return endpoint;
    if (endpoint.enabled !== true) return undefined;
    if (!endpoint.endpoint_url) return undefined;

    return endpoint;
};

API.get = (name, params = {}) => {
    return API._request(name, {
        method: "GET",
        params: params
    });
};

API.post = (name, body = {}) => {
    return API._request(name, {
        method: "POST",
        body: body
    });
};

API.put = (name, body = {}) => {
    return API._request(name, {
        method: "PUT",
        body: body
    });
};

API.patch = (name, body = {}) => {
    return API._request(name, {
        method: "PATCH",
        body  : body
    });
};

API.delete = (name, body = {}) => {
    return API._request(name, {
        method: "DELETE",
        body  : body
    });
};

API.withAuth = (callback, options = {}) => {
    if (!THOTH.requireAuth(options.actionName || "this action")) {
        return Promise.resolve({
            ok   : false,
            error: "Authentication required"
        });
    }

    if (!callback) return undefined;

    return callback();
};

API.listModelsFallback = (user) => {
    return new Promise(resolve => {
        const username = API._getUsername(user);
        if (!username) {
            resolve({
                ok   : false,
                error: "Missing user"
            });
            return;
        }

        ATON.REQ.get(
            `items/${username}/models/`,
            entries => resolve({
                ok  : true,
                data: entries
            }),
            error => resolve({
                ok   : false,
                error: error || "Error loading models"
            })
        );
    });
};

API.listModels = async (user) => {
    if (API.hasEndpoint("list_models")) {
        const response = await API.get("list_models");
        if (!response.ok) return response;
        const rows = Array.isArray(response.data)
            ? response.data
            : response.data?.artifacts || response.data?.data || [];
        return {
            ...response,
            data: rows
                .map(API._normalizeModelEntry)
                .filter(entry => entry.id && API._isModelEntry(entry))
        };
    }

    return API.listModelsFallback(user);
};

API.getGlbModel = async (modelName) => {
    if (!modelName) {
        return {
            ok   : false,
            error: "Missing model name"
        };
    }

    if (!API.hasEndpoint("glb_model")) {
        return {
            ok  : true,
            data: {
                image_name: modelName,
                gltf_file : modelName
            }
        };
    }

    const endpoint = API.getEndpointConfig("glb_model");
    const response = endpoint?.item_path
        ? await API._request("glb_model", {
            method: "GET",
            path: `/${encodeURIComponent(API._getModelId(modelName))}`
        })
        : await API.get("glb_model", { "artefact.Title": API._getModelId(modelName) });
    if (!response.ok) return response;

    const entry = API._normalizeModelEntry(response.data?.artifact || response.data);
    return {
        ...response,
        data: {
            ...response.data,
            id: entry.id,
            title: entry.title,
            gltf_file: entry.url
        }
    };
};

API.getArtefactData = async (artefactTitle) => {
    if (!artefactTitle) {
        return {
            ok   : false,
            error: "Missing artefact title"
        };
    }

    if (!API.hasEndpoint("artefact_data")) {
        return API.getArtefactDataFallback(artefactTitle);
    }

    const endpoint = API.getEndpointConfig("artefact_data");
    const response = endpoint?.item_path
        ? await API._request("artefact_data", {
            method: "GET",
            path: `/${encodeURIComponent(API._getModelId(artefactTitle))}`
        })
        : await API.get("artefact_data", {
            "artefact.Title": API._getModelId(artefactTitle),
            data_type: "json"
        });
    if (!response.ok || API.config?.deploymentMode !== "hestia") return response;
    return { ...response, data: API._normalizeHestiaArtefact(response.data) };
};

API.getArtefactDataFallback = async (artefactTitle) => {
    const model = THOTH.SceneStore?.getModel(artefactTitle);
    if (!model || model.trash === true) {
        return {
            ok  : true,
            data: {}
        };
    }

    return {
        ok  : true,
        data: {
            artefact_data: {
                artefact_data  : model.artefact || {},
                annotations    : {
                    "artefact.annotations": model.annotations || {}
                },
                sensorial_data : {
                    sensors: model.sensors || []
                },
                artefact_metadata: {
                    "artefact.metadata": model.metadata || {}
                }
            }
        }
    };
};

API.putArtefactData = async (artefactTitle, artefactData) => {
    if (!artefactTitle) {
        return {
            ok   : false,
            error: "Missing artefact title"
        };
    }

    if (!API.supports("artefact_data", "PUT")) {
        return {
            ok   : false,
            error: API.config?.deploymentMode === "hestia"
                ? "HESTIA persists model data through scene export"
                : "No artefact_data endpoint configured"
        };
    }

    return API.put("artefact_data", {
        "artefact.Title": artefactTitle,
        data_type       : "json",
        artefact_data   : artefactData
    });
};

// PUT /echoes/<artefact_id> on Hestia. The endpoint reads the body as an
// opaque payload and relays it to the ECHOES knowledge base; the artefact
// must have been registered on ECHOES first (POST /echoes/<artefact_id>).
API.putEchoesScene = async (artefactId, scenePayload) => {
    if (!artefactId) {
        return { ok: false, error: "Missing artefact id" };
    }

    return API._request("echoes", {
        method: "PUT",
        path: `/${encodeURIComponent(artefactId)}`,
        body: scenePayload
    });
};

API.getMetadata = async (artefactTitle) => {
    if (!API.hasEndpoint("metadata")) {
        const model = THOTH.SceneStore?.getModel(artefactTitle);
        return {
            ok  : true,
            data: model?.metadata || {}
        };
    }

    return API.get("metadata", {
        "artefact.Title": artefactTitle
    });
};

API.putMetadata = async (artefactTitle, metadata) => {
    if (!API.hasEndpoint("metadata")) {
        if (API.config?.deploymentMode === "hestia") {
            return {
                ok: false,
                error: "HESTIA persists metadata through scene export"
            };
        }
        if (artefactTitle && metadata !== undefined) {
            THOTH.SceneStore?.setModelField(artefactTitle, "metadata", metadata);
        }
        return {
            ok  : true,
            data: metadata
        };
    }

    return API.put("metadata", {
        "artefact.Title": artefactTitle,
        body            : metadata
    });
};

API.listRgbImages = async () => {
    if (API.hasEndpoint("list_rgb_images")) return API.get("list_rgb_images");

    return {
        ok  : true,
        data: []
    };
};

API.getRgbImage = async (imageName) => {
    if (API.hasEndpoint("rgb_image")) {
        return API.get("rgb_image", {
            image_name: imageName
        });
    }

    return {
        ok  : true,
        data: null
    };
};

API.listMultispectralImages = async () => {
    if (API.hasEndpoint("list_multispectral_images")) {
        return API.get("list_multispectral_images");
    }

    return {
        ok  : true,
        data: []
    };
};

API.getMultispectralImage = async (imageName) => {
    if (API.hasEndpoint("multispectral_image")) {
        return API.get("multispectral_image", {
            image_name: imageName
        });
    }

    return {
        ok  : true,
        data: null
    };
};

API.listSensors = async () => {
    if (API.hasEndpoint("list_sensors")) return API.get("list_sensors");

    return {
        ok  : true,
        data: []
    };
};

API.getSensor = async (sensorId) => {
    if (API.hasEndpoint("sensor")) {
        const response = await API.get("sensor", {
            sensor_id: sensorId,
            per_page : 1
        });
        if (!response.ok || API.config?.deploymentMode !== "hestia") return response;
        return {
            ...response,
            data: Array.isArray(response.data) ? (response.data[0] || null) : response.data
        };
    }

    return {
        ok  : true,
        data: {}
    };
};

API._request = async (name, options = {}) => {
    const endpointConfig = API.getEndpointConfig(name);
    const endpoint = typeof endpointConfig === "string"
        ? endpointConfig
        : endpointConfig?.endpoint_url;

    if (!endpoint) {
        const error = `Missing endpoint: ${name}`;
        if (options.userTriggered) API._showToast(error);
        return {
            ok: false,
            error
        };
    }

    if (!API.supports(name, options.method || "GET")) {
        return {
            ok: false,
            error: `${options.method || "GET"} is not supported by endpoint: ${name}`
        };
    }

    try {
        const requestUrl = API._buildUrl(endpoint + (options.path || ""), options.params);
        const fetchOptions = {
            method : options.method || "GET",
            headers: API._buildHeaders(options.headers),
            credentials: "include"
        };
        const timeoutSeconds = Number(endpointConfig?.timeout_seconds);
        let timeoutId;

        if (
            Number.isFinite(timeoutSeconds) &&
            timeoutSeconds > 0 &&
            typeof AbortController !== "undefined"
        ) {
            const controller = new AbortController();
            timeoutId = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
            fetchOptions.signal = controller.signal;
        }

        if (options.body instanceof FormData) {
            fetchOptions.body = options.body;
            delete fetchOptions.headers["Content-Type"];
        }
        else if (options.body !== undefined && fetchOptions.method !== "GET") {
            fetchOptions.body = JSON.stringify(options.body);
        }

        const response = await fetch(requestUrl, fetchOptions);
        const contentType = response.headers.get("content-type") || "";
        const data = contentType.includes("application/json")
            ? await API._readJSON(response)
            : await response.text();

        if (timeoutId) clearTimeout(timeoutId);

        if (!response.ok) {
            return {
                ok    : false,
                error : data?.error || data?.message || data || response.statusText,
                code  : data?.code,
                status: response.status
            };
        }

        return {
            ok    : true,
            data  : API._rewriteAssetUrls(data),
            status: response.status
        };
    }
    catch (err) {
        return {
            ok   : false,
            error: err?.message || String(err)
        };
    }
};

API._readJSON = async (response) => {
    const text = await response.text();
    if (!text) return null;

    return JSON.parse(text);
};

API._buildUrl = (endpoint, params = {}) => {
    const url = new URL(endpoint, window.location.href);

    for (const key of Object.keys(params || {})) {
        const value = params[key];
        if (value !== undefined && value !== null) {
            url.searchParams.set(key, value);
        }
    }

    return url.toString();
};

API._buildHeaders = (headers = {}) => {
    return {
        "Content-Type": "application/json",
        ...headers
    };
};

API._getModelId = (model) => {
    if (typeof model === "object" && model !== null) {
        return model.id || model.artifact_id || model.title || model.name;
    }
    return model;
};

API._normalizeModelEntry = (item = {}) => {
    if (typeof item === "string") {
        return { id: item, title: item, url: API._proxyAssetUrl(item), raw: item };
    }
    const id = item.artifact_id || item.id || item["artefact.ID"] || item.title || item.name || "";
    const title = item.title || item.Title || item["artefact.Title"] || item.name || id;
    const url = API._proxyAssetUrl(
        item.gltf_file || item.glb_file || item.public_url || item.url || item.path || item.src || ""
    );
    return { id: String(id), title: String(title), url, gltf_file: url, raw: item };
};

API._isModelEntry = (entry = {}) => {
    const path = String(entry.url || entry.raw?.filename || "").split(/[?#]/)[0].toLowerCase();
    return [".glb", ".gltf", ".obj"].some(extension => path.endsWith(extension));
};

API._normalizeHestiaArtefact = (data = {}) => {
    const artifact = data.artifact || data;
    const entry = API._normalizeModelEntry(artifact);
    return {
        artefact_data: {
            artefact_data: {
                "artefact.title": entry.title,
                "artefact.glb_file": entry.url,
                "artefact.description": artifact.description || "",
                "artefact.owner": artifact.uploaded_by || artifact.owner || "",
                "artefact.keywords": artifact.keywords || [],
                "artefact.copyright": artifact.copyright || "",
                artifact_id: entry.id
            },
            annotations: {
                "artefact.annotations": data.annotations || {}
            },
            sensorial_data: {
                sensors: data.sensor_readings || []
            },
            artefact_metadata: {
                "artefact.metadata": artifact.metadata || {}
            }
        }
    };
};

API._proxyAssetUrl = (value, allowApiRoute = false) => {
    if (typeof value !== "string" || API.config?.deploymentMode !== "hestia") return value;
    try {
        const publicBase = new URL(API.config.hestiaApiPublicUrl, window.location.href);
        const asset = new URL(value, publicBase);
        if (
            asset.origin !== publicBase.origin &&
            !(allowApiRoute && asset.pathname === "/multispectral/file")
        ) return value;
        return `/hestia${asset.pathname}${asset.search}${asset.hash}`;
    }
    catch {
        return value;
    }
};

API._rewriteAssetUrls = (value, key = "") => {
    if (Array.isArray(value)) return value.map(item => API._rewriteAssetUrls(item, key));
    if (value && typeof value === "object") {
        const result = {};
        for (const childKey of Object.keys(value)) {
            const childPath = key ? `${key}.${childKey}` : childKey;
            result[childKey] = API._rewriteAssetUrls(value[childKey], childPath);
        }
        return result;
    }
    if (typeof value !== "string") return value;
    const normalizedKey = key.toLowerCase();
    if (normalizedKey.includes("url") || normalizedKey.includes("file") || normalizedKey === "src") {
        return API._proxyAssetUrl(value, normalizedKey.includes("api_urls"));
    }
    return value;
};

API._getUsername = (user) => {
    return user?.username || user?.id || user?.name || THOTH.user?.username;
};

API._showToast = (message) => {
    if (THOTH.FE?.showToast) THOTH.FE.showToast(message);
};

export default API;
