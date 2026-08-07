/*===========================================================================

    THOTH
    API client

===========================================================================*/
let API = {};
//const geodesic = require("../../geodesic_addon");

API.endpointNames = [
    "artefacts",
    "artefact",
    "metadata",
    "metadata_schema_list",
    "metadata_schema",
    "rgb_images",
    "multispectral_images",
    "related_artefacts",
    "scene_export",
    "model_import",
    "geodesic_exact",
    "geodesic_load"
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

    if (!API.endpoints.metadata_schema_list) {
        API.endpoints.metadata_schema_list = config.schemaListUrl;
    }
     if (!API.endpoints.geodesic_exact) {
        API.endpoints.geodesic_exact = "/api/v2/geodesic/exact";
    }
    if (!API.endpoints.geodesic_load) {
        API.endpoints.geodesic_load = "/api/v2/geodesic/load";
    }
};

API.hasEndpoint = (name) => {
    return Boolean(API.getEndpoint(name));
};

API.getEndpoint = (name) => {
    return API.endpoints?.[name];
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

API.delete = (name, body = {}) => {
    return API._request(name, {
        method: "DELETE",
        body: body
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

API._request = async (name, options = {}) => {
    const endpoint = API.getEndpoint(name);

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
            ? await response.json()
            : await response.text();

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
    }

    return requestHeaders;
};

API._showToast = (message) => {
    if (THOTH.FE?.showToast) THOTH.FE.showToast(message);
};

API.geodesicExact = async function(payload) {
    const result = await API.post("geodesic_exact",payload);

    if (!result.ok) {
        throw new Error(
            typeof result.error === "string"
            ? result.error
            : JSON.stringify(result.error)
        );
    }

    return result.data.data;
};

API.geodesicLoad = async function(payload){
    const result = await API.post("geodesic_load", payload);

    if (!result.ok) {
        throw new Error(
            typeof result.error === "string"
            ? result.error
            : JSON.stringify(result.error)
        );
    }

    return result.data;
};

export default API;
