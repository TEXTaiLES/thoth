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
    THOTH.sceneMetadata = data;
};


// Utils

MD.buildSchemaMap = (schemaListUrl) => {
    const schemaMap = new Map();
    ATON.REQ.get(
        schemaListUrl,
        schemaList => {
            for (const schemaUrl of schemaList) {
                const schemaName = schemaUrl.split('/').filter(Boolean).pop();
                ATON.REQ.get(
                    schemaUrl,
                    schema => schemaMap.set(schemaName, schema)
                )
            }
        }
    )
    return schemaMap;
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

    if (!data) return { schemaName: schemaName };
    
    const metadata = Array.isArray(data.groups)
        ? MD._buildPropertiesFromGroups(data.groups)
        : MD._buildPropertiesFromObjectSchema(data);
    metadata.schemaName = schemaName;

    return metadata;
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
    layer.metadata.schemaName = schemaName;
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
    THOTH.sceneMetadata.schemaName = schemaName;
}

MD.editSceneMetadata = (data) => {
    if (data === undefined) return;
    THOTH.sceneMetadata = data;
};



export default MD;