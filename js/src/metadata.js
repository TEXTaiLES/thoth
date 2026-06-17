/*===========================================================================

    THOTH
    Metadata management

    Authors: 
        Stelios Alvanos (steliosalvanos@gmail.com)

===========================================================================*/
let MD = {};


MD.setup = () => {
    MD.schemaMap = new Map();
    MD.schemaAliasMap = new Map();
    MD.schemasReady = false;
    MD.schemasLoaded = MD._loadSchemaList(THOTH.config.schemaListUrl, MD.schemaMap)
        .then(schemaMap => {
            MD.schemasReady = true;
            return schemaMap;
        });
};

// Utils

MD.buildSchemaMap = (schemaListUrl) => {
    const schemaMap = new Map();
    MD.schemaMap = schemaMap;
    MD.schemaAliasMap = new Map();
    MD.schemasReady = false;
    MD.schemasLoaded = MD._loadSchemaList(schemaListUrl, schemaMap)
        .then(loadedSchemaMap => {
            MD.schemasReady = true;
            return loadedSchemaMap;
        });

    return schemaMap;
};

MD.ensureSchemasLoaded = () => {
    if (!MD.schemasLoaded) {
        MD.schemaMap = MD.schemaMap || new Map();
        MD.schemaAliasMap = MD.schemaAliasMap || new Map();
        MD.schemasReady = false;
        MD.schemasLoaded = MD._loadSchemaList(THOTH.config.schemaListUrl, MD.schemaMap)
            .then(schemaMap => {
                MD.schemasReady = true;
                return schemaMap;
            });
    }

    return MD.schemasLoaded;
};

MD._requestJSON = (url) => {
    return new Promise(resolve => {
        ATON.REQ.get(
            url,
            data => resolve({
                ok  : true,
                data: data
            }),
            error => resolve({
                ok   : false,
                error: error || `Failed to load JSON: ${url}`
            })
        );
    });
};

MD._unique = (values) => {
    return Array.from(new Set(values.filter(Boolean)));
};

MD._getSchemaFileCandidates = (fileName, preferredUrl) => {
    return MD._unique([
        preferredUrl,
        THOTH.PATH_RES_SCHEMA + fileName,
        `js/res/schema/${fileName}`,
        `./js/res/schema/${fileName}`,
        `../thoth/js/res/schema/${fileName}`,
        `../../a/thoth/js/res/schema/${fileName}`
    ]);
};

MD._requestFirstJSON = async (urls) => {
    let lastResponse = {
        ok   : false,
        error: "No schema URLs available"
    };

    for (const url of MD._unique(urls)) {
        const response = await MD._requestJSON(url);
        if (response.ok) {
            return {
                ...response,
                url: url
            };
        }

        lastResponse = {
            ...response,
            url: url
        };
    }

    return lastResponse;
};

MD._resolveUrl = (url, baseUrl) => {
    if (!url) return "";

    if (!/^https?:\/\//i.test(url) && url.includes("res/schema/")) {
        const fileName = String(url).split("/").filter(Boolean).pop();
        return THOTH.PATH_RES_SCHEMA + fileName;
    }

    try {
        const base = new URL(baseUrl || window.location.href, window.location.href);
        return new URL(url, base).toString();
    }
    catch {
        return url;
    }
};

MD._getBaseName = (value = "") => {
    const cleanValue = String(value).split("?")[0].split("#")[0];
    const fileName = cleanValue.split("/").filter(Boolean).pop() || cleanValue;

    return fileName.replace(/\.json$/i, "");
};

MD._getSchemaEntryUrl = (schemaEntry) => {
    if (typeof schemaEntry === "string") return schemaEntry;

    return schemaEntry?.schema_url ||
        schemaEntry?.url ||
        schemaEntry?.href ||
        schemaEntry?.path ||
        "";
};

MD._getSchemaEntryName = (schemaEntry, schemaUrl) => {
    if (typeof schemaEntry !== "string") {
        const entryName = schemaEntry?.schema?.name ||
            schemaEntry?.name ||
            schemaEntry?.id ||
            schemaEntry?.schemaName;
        if (entryName) return MD._getBaseName(entryName);
    }

    return MD._getBaseName(schemaUrl);
};

MD._addSchemaAlias = (alias, canonicalName) => {
    if (!alias || !canonicalName) return;

    MD.schemaAliasMap.set(alias, canonicalName);
    MD.schemaAliasMap.set(MD._getBaseName(alias), canonicalName);
    MD.schemaAliasMap.set(`${MD._getBaseName(alias)}.json`, canonicalName);
};

MD._registerSchema = (schemaMap, schemaName, schema, schemaUrl) => {
    if (!schemaName || !schema) return false;

    const canonicalName = MD._getBaseName(schemaName);
    const schemaData = {
        ...schema,
        url: schema.url || schema.$id || schemaUrl || ""
    };

    schemaMap.set(canonicalName, schemaData);
    MD._addSchemaAlias(canonicalName, canonicalName);
    MD._addSchemaAlias(`${canonicalName}.json`, canonicalName);
    MD._addSchemaAlias(schemaName, canonicalName);
    MD._addSchemaAlias(schemaUrl, canonicalName);
    MD._addSchemaAlias(schemaData.name, canonicalName);
    MD._addSchemaAlias(schemaData.schemaName, canonicalName);
    MD._addSchemaAlias(schemaData.schemaId, canonicalName);
    MD._addSchemaAlias(schemaData.$id, canonicalName);

    return true;
};

MD._loadSchemaList = async (schemaListUrl, schemaMap) => {
    if (THOTH.API?.hasEndpoint?.("list_schemas")) {
        const apiResponse = await THOTH.API.get("list_schemas");
        if (apiResponse.ok) {
            const loadedCount = await MD._loadSchemasFromEndpointList(apiResponse.data, schemaMap);
            if (loadedCount > 0) return schemaMap;
        }
    }

    const localSchemaListUrl = THOTH.PATH_RES_SCHEMA + "list_of_schemas.json";
    const localResponse = await MD._requestFirstJSON(
        MD._getSchemaFileCandidates("list_of_schemas.json", schemaListUrl || localSchemaListUrl)
    );
    if (localResponse.ok) {
        const loadedCount = await MD._loadSchemas(localResponse.data, schemaMap, localResponse.url);
        if (loadedCount > 0) return schemaMap;
    }

    if (schemaListUrl && schemaListUrl !== localSchemaListUrl && schemaListUrl !== localResponse.url) {
        const configuredResponse = await MD._requestJSON(schemaListUrl);
        if (configuredResponse.ok) {
            const loadedCount = await MD._loadSchemas(configuredResponse.data, schemaMap, schemaListUrl);
            if (loadedCount > 0) return schemaMap;
        }
    }

    await MD._loadDefaultSchema(schemaMap);
    return schemaMap;
};

MD._loadSchemasFromEndpointList = async (schemaList, schemaMap) => {
    if (!Array.isArray(schemaList)) return 0;

    const loaders = schemaList.map(async schemaEntry => {
        const schemaName = MD._getSchemaEntryName(schemaEntry, schemaEntry);
        if (!schemaName) return false;

        let schemaUrl = "";
        if (THOTH.API?.hasEndpoint?.("schema")) {
            const response = await THOTH.API.get("schema", {
                "schema.name": schemaName
            });
            if (response.ok) {
                schemaUrl = response.data?.schema_url ||
                    response.data?.url ||
                    response.data?.href ||
                    response.data?.path ||
                    (typeof response.data === "string" ? response.data : "");
            }
        }

        const rawSchemaUrl = schemaUrl || MD._getSchemaEntryUrl(schemaEntry) || `${schemaName}.json`;
        const resolvedSchemaUrl = MD._resolveUrl(rawSchemaUrl, THOTH.PATH_RES_SCHEMA);
        const fileName = String(rawSchemaUrl || resolvedSchemaUrl).split("/").filter(Boolean).pop();
        const response = await MD._requestFirstJSON(
            MD._getSchemaFileCandidates(fileName, resolvedSchemaUrl)
        );
        if (!response.ok) return false;

        return MD._registerSchema(schemaMap, schemaName, response.data, response.url || resolvedSchemaUrl);
    });

    const results = await Promise.all(loaders);
    return results.filter(Boolean).length;
};

MD._loadSchemas = async (schemaList, schemaMap, schemaListUrl) => {
    if (!Array.isArray(schemaList)) return 0;

    const loaders = schemaList.map(async schemaEntry => {
        const rawSchemaUrl = MD._getSchemaEntryUrl(schemaEntry);
        const schemaUrl = MD._resolveUrl(rawSchemaUrl, schemaListUrl);
        if (!schemaUrl) return false;

        const schemaName = MD._getSchemaEntryName(schemaEntry, rawSchemaUrl);
        const fileName = String(rawSchemaUrl || schemaUrl).split("/").filter(Boolean).pop();
        const response = await MD._requestFirstJSON(
            MD._getSchemaFileCandidates(fileName, schemaUrl)
        );
        if (!response.ok) return false;

        return MD._registerSchema(schemaMap, schemaName, response.data, response.url || schemaUrl);
    });

    const results = await Promise.all(loaders);
    return results.filter(Boolean).length;
};

MD._loadDefaultSchema = async (schemaMap) => {
    const schemaUrl = THOTH.PATH_RES_SCHEMA + "puc_schema.json";
    const response = await MD._requestFirstJSON(
        MD._getSchemaFileCandidates("puc_schema.json", schemaUrl)
    );
    if (!response.ok) {
        THOTH.FE?.showToast?.("Error loading default schema: " + response.error);
        return false;
    }

    return MD._registerSchema(schemaMap, "puc_schema", response.data, response.url || schemaUrl);
};

MD._loadLocalSchemaList = (schemaMap) => {
    return MD._loadSchemaList(null, schemaMap);
};

MD._normalizeType = (type) => {
    if (!type) return "";
    return String(type).toLowerCase();
};

MD._getDefaultValue = (type) => {
    switch (type) {
        case "string":
        case "text":
        case "url":
        case "date":
        case "reference":
            return "-";
        case "integer":
            return 0;
        case "float":
            return 0.0;
        case "bool":
        case "boolean":
            return false;
        case "enum":
            return "-";
        case "enum-multiple":
        case "multienum":
            return [];
        case "group":
            return {};
        default:
            return null;
    }
};

MD._buildPropertiesFromObjectSchema = (data) => {
    let A = {};

    for (const key in data) {
        if (key === "required") continue;
        if (key === "schemaId") continue;
        if (key === "version") continue;
        if (key === "description") continue;

        const attr = data[key];
        const type = MD._normalizeType(attr?.type || attr?.dataType);

        if (type) {
            A[key] = MD._getDefaultValue(type);
        }
        else if (typeof attr === "object") {
            A[key] = MD._buildPropertiesFromObjectSchema(attr);
        }
    }

    return A;
};

MD._buildPropertiesFromGroups = (groups) => {
    let A = {};

    if (!Array.isArray(groups)) return A;

    for (const node of groups) {
        const key = node.id || node.label;
        if (!key) continue;

        const type = MD._normalizeType(node.dataType || node.type);
        if (type === "group" || Array.isArray(node.subgroups)) {
            A[key] = MD._buildPropertiesFromGroups(node.subgroups || []);
        }
        else {
            A[key] = MD._getDefaultValue(type);
        }
    }

    return A;
};

MD.resolveSchemaName = (schemaName) => {
    const configuredSchemaName = schemaName || THOTH.config.defaultSchemaName || "puc_schema";

    if (!MD.schemaMap) return MD._getBaseName(configuredSchemaName);

    if (MD.schemaMap.has(configuredSchemaName)) return configuredSchemaName;

    const baseName = MD._getBaseName(configuredSchemaName);
    if (MD.schemaMap.has(baseName)) return baseName;

    const aliasName = MD.schemaAliasMap?.get(configuredSchemaName) ||
        MD.schemaAliasMap?.get(baseName) ||
        MD.schemaAliasMap?.get(`${baseName}.json`);
    if (aliasName) return aliasName;

    const schemaNames = Array.from(MD.schemaMap.keys());
    const matchingName = schemaNames.find(name => name === baseName || name.startsWith(baseName));
    if (matchingName) return matchingName;

    return baseName;
};

MD.getSchema = (schemaName) => {
    const resolvedName = MD.resolveSchemaName(schemaName);

    return MD.schemaMap?.get(resolvedName);
};

MD.getSchemaDetails = (schemaName) => {
    const resolvedName = MD.resolveSchemaName(schemaName);
    const schema = MD.getSchema(resolvedName) || {};

    return {
        name       : resolvedName || "",
        version    : schema.version || "",
        description: schema.description || "",
        url        : schema.url || schema.$id || ""
    };
};

MD.createPropertiesFromSchema = (schemaName) => {
    const resolvedName = MD.resolveSchemaName(schemaName);
    const data = MD.getSchema(resolvedName);

    if (!data) return MD.createMetadataRecord(resolvedName, {});
    
    const attributes = Array.isArray(data.groups)
        ? MD._buildPropertiesFromGroups(data.groups)
        : MD._buildPropertiesFromObjectSchema(data);

    return MD.createMetadataRecord(resolvedName, attributes);
};

MD.createPropertiesfromSchema = (schemaName) => {
    return MD.createPropertiesFromSchema(schemaName);
};

MD.createMetadataRecord = (schemaName, attributes = {}) => {
    const details = schemaName
        ? MD.getSchemaDetails(schemaName)
        : {
            name       : "",
            version    : "",
            description: "",
            url        : ""
        };

    return {
        schema: {
            name       : details.name,
            version    : details.version,
            description: details.description,
            url        : details.url
        },
        attributes: structuredClone(attributes)
    };
};

MD.toCanonicalMetadata = (data = {}) => {
    if (data.schema || data.attributes) {
        const schemaName = data.schema?.name || data.schemaName || "";
        const details = schemaName
            ? MD.getSchemaDetails(schemaName)
            : {
                name       : "",
                version    : data.schema?.version || "",
                description: data.schema?.description || "",
                url        : data.schema?.url || ""
            };

        return {
            schema: {
                name       : details.name,
                version    : details.version || data.schema?.version || "",
                description: details.description || data.schema?.description || "",
                url        : details.url || data.schema?.url || ""
            },
            attributes: structuredClone(data.attributes || {})
        };
    }

    const schemaName = data.schemaName || MD.getDefaultSchemaName();
    const attributes = structuredClone(data);
    delete attributes.schemaName;

    return MD.createMetadataRecord(schemaName, attributes);
};

MD.getSchemaName = (metadata = {}) => {
    return metadata.schema?.name || metadata.schemaName || "";
};

MD.getAttributes = (metadata = {}) => {
    return metadata.attributes || metadata;
};

MD.getDefaultSchemaName = () => {
    const configuredSchemaName = THOTH.config.defaultSchemaName || "puc_schema";

    return MD.resolveSchemaName(configuredSchemaName);
};

MD._isSupportedType = (type) => {
    const supported = new Set([
        "string",
        "text",
        "url",
        "date",
        "reference",
        "integer",
        "float",
        "bool",
        "boolean",
        "enum",
        "enum-multiple",
        "multienum",
        "group"
    ]);

    return supported.has(type);
};

MD._validateObjectSchema = (data) => {
    for (const key in data) {
        if (key === "required") continue;

        const attr = data[key];
        const type = MD._normalizeType(attr?.type || attr?.dataType);

        if (type) {
            if (!MD._isSupportedType(type)) return false;
        }
        else if (typeof attr === "object") {
            if (!MD._validateObjectSchema(attr)) return false;
        }
        else return false;
    }
    return true;
};

MD._validateGroupSchema = (groups) => {
    if (!Array.isArray(groups)) return false;

    for (const node of groups) {
        const type = MD._normalizeType(node.dataType || node.type);

        if (type === "group" || Array.isArray(node.subgroups)) {
            if (node.subgroups && !MD._validateGroupSchema(node.subgroups)) return false;
        }
        else if (!MD._isSupportedType(type)) {
            return false;
        }
    }
    return true;
};

MD.validateSchema = (data) => {
    if (!data) return false;

    if (Array.isArray(data.groups)) return MD._validateGroupSchema(data.groups);

    return MD._validateObjectSchema(data);
};


MD.editModelMetadata = (modelId, data, prevData) => {
    if (!modelId || data === undefined) return;

    THOTH.Ops.applyLocal(THOTH.Ops.makeOperation(
        "model.update_metadata",
        {
            model_id: modelId,
            field   : "metadata"
        },
        MD.toCanonicalMetadata(data),
        prevData
    ));
};



export default MD;
