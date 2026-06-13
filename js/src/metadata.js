/*===========================================================================

    THOTH
    Metadata management

    Authors: 
        Stelios Alvanos (steliosalvanos@gmail.com)

===========================================================================*/
let MD = {};


MD.setup = () => {
    MD.schemaMap = MD.buildSchemaMap(THOTH.config.schemaListUrl);
};

MD.parseSceneMetadata = (data) => {
    THOTH.sceneMetadata = MD.toCanonicalMetadata(data);
};


// Utils

MD.buildSchemaMap = (schemaListUrl) => {
    const schemaMap = new Map();
    MD._loadSchemaList(schemaListUrl, schemaMap);

    return schemaMap;
};

MD._loadSchemaList = async (schemaListUrl, schemaMap) => {
    const response = await THOTH.API.get("metadata_schema_list");
    if (response.ok) {
        MD._loadSchemas(response.data, schemaMap);
        return;
    }

    if (schemaListUrl) {
        ATON.REQ.get(
            schemaListUrl,
            schemaList => MD._loadSchemas(schemaList, schemaMap),
            () => MD._loadLocalSchemaList(schemaMap)
        );
        return;
    }

    MD._loadLocalSchemaList(schemaMap);
};

MD._loadSchemas = (schemaList, schemaMap) => {
    if (!Array.isArray(schemaList)) return;

    for (const schemaEntry of schemaList) {
        const schemaUrl = typeof schemaEntry === "string"
            ? schemaEntry
            : schemaEntry.url;
        if (!schemaUrl) continue;

        const schemaName = schemaEntry.name ||
            schemaEntry.id ||
            schemaUrl.split('/').filter(Boolean).pop();

        ATON.REQ.get(
            schemaUrl,
            schema => schemaMap.set(schemaName, schema)
        );
    }
};

MD._loadLocalSchemaList = (schemaMap) => {
    ATON.REQ.get(
        THOTH.PATH_RES_SCHEMA + "list_of_schemas.json",
        schemaList => MD._loadSchemas(schemaList, schemaMap),
        error => THOTH.FE?.showToast?.("Error loading schemas: " + error)
    );
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

MD.createPropertiesfromSchema = (schemaName) => {
    const data = MD.schemaMap.get(schemaName);

    if (!data) return MD.createMetadataRecord(schemaName, {});
    
    const attributes = Array.isArray(data.groups)
        ? MD._buildPropertiesFromGroups(data.groups)
        : MD._buildPropertiesFromObjectSchema(data);

    return MD.createMetadataRecord(schemaName, attributes);
};

MD.createMetadataRecord = (schemaName, attributes = {}) => {
    const schema = MD.schemaMap?.get(schemaName) || {};

    return {
        schema: {
            name       : schemaName || "",
            version    : schema.version || "",
            description: schema.description || "",
            url        : schema.url || schema.$id || ""
        },
        attributes: structuredClone(attributes)
    };
};

MD.toCanonicalMetadata = (data = {}) => {
    if (data.schema || data.attributes) {
        const schemaName = data.schema?.name || data.schemaName || MD.getDefaultSchemaName();

        return {
            schema: {
                name       : schemaName,
                version    : data.schema?.version || "",
                description: data.schema?.description || "",
                url        : data.schema?.url || ""
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
    return metadata.schema?.name || metadata.schemaName || MD.getDefaultSchemaName();
};

MD.getAttributes = (metadata = {}) => {
    return metadata.attributes || metadata;
};

MD.getDefaultSchemaName = () => {
    const configuredSchemaName = THOTH.config.defaultSchemaName || "puc_schema";

    if (!MD.schemaMap) return configuredSchemaName;

    if (MD.schemaMap.has(configuredSchemaName)) return configuredSchemaName;
    if (MD.schemaMap.has(`${configuredSchemaName}.json`)) return `${configuredSchemaName}.json`;

    const schemaNames = Array.from(MD.schemaMap.keys());
    const defaultSchemaName = schemaNames.find(name => name.startsWith(configuredSchemaName));
    if (defaultSchemaName) return defaultSchemaName;

    if (schemaNames.length > 0) return schemaNames[0];

    return configuredSchemaName;
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


// Layers

MD.changeLayerSchema = (layerId, schemaName) => {
    const layer = THOTH.Layers.layerMap.get(layerId);
    layer.metadata = MD.createMetadataRecord(schemaName, MD.getAttributes(layer.metadata));
};

MD.inheritLayerMedatataFromScene = (layerId) => {
    const sceneMetadata = THOTH.sceneMetadata;
    const layerMetadata = THOTH.Layers.layerMap.get(layerId).metadata;
    
    let l = {
        id      : layerId,
        data    : sceneMetadata,
        prevData: layerMetadata
    };

    THOTH.fire("editLayerMetadata", l);
};

MD.editLayerMetadata = (layerId, data) => {
    if (layerId === undefined) return;
    
    const layer = THOTH.Layers.layerMap.get(layerId);
    if (!layer) return;
    
    layer.metadata = data;
};  


// Scene

MD.changeSceneSchema = (schemaName) => {
    THOTH.sceneMetadata = MD.createMetadataRecord(
        schemaName,
        MD.getAttributes(THOTH.sceneMetadata)
    );
}

MD.editSceneMetadata = (data) => {
    if (data === undefined) return;
    THOTH.sceneMetadata = MD.toCanonicalMetadata(data);
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
