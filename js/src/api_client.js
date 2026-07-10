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
    if (API.hasEndpoint("list_models")) return API.get("list_models");

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

    return API.get("glb_model", {
        "artefact.Title": modelName
    });
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

    return API.get("artefact_data", {
        "artefact.Title": artefactTitle,
        data_type       : "json"
    });
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

    if (!API.hasEndpoint("artefact_data")) {
        return {
            ok   : false,
            error: "No artefact_data endpoint configured"
        };
    }

    return API.put("artefact_data", {
        "artefact.Title": artefactTitle,
        data_type       : "json",
        artefact_data   : artefactData
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
        return API.get("sensor", {
            sensor_id: sensorId
        });
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

    try {
        const requestUrl = API._buildUrl(endpoint, options.params);
        const fetchOptions = {
            method : options.method || "GET",
            headers: API._buildHeaders(options.headers)
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
                error : data || response.statusText,
                status: response.status
            };
        }

        return {
            ok    : true,
            data  : data,
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
    const requestHeaders = {
        "Content-Type": "application/json",
        ...headers
    };

    const authKey = API.config?.authKey;
    if (authKey && typeof authKey === "string") {
        const separatorIndex = authKey.indexOf(":");
        if (separatorIndex !== -1) {
            const key = authKey.slice(0, separatorIndex).trim();
            const value = authKey.slice(separatorIndex + 1).trim();
            requestHeaders[key] = value;
        }
        else {
            requestHeaders.Authorization = authKey.startsWith("Bearer ")
                ? authKey
                : `Bearer ${authKey}`;
        }
    }

    return requestHeaders;
};

API._getUsername = (user) => {
    return user?.username || user?.id || user?.name || THOTH.user?.username;
};

API._showToast = (message) => {
    if (THOTH.FE?.showToast) THOTH.FE.showToast(message);
};

export default API;
