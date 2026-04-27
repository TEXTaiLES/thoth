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

MD.createPropertiesfromSchema = (schemaName) => {
    const data = MD.schemaMap.get(schemaName);
    
    const buildProperties = (data) => {
        let A = {};
    
        for (const key in data) {
            if (key === "required") continue;
    
            const attr = data[key];
            if (attr["type"]) {
                switch (attr.type.toLowerCase()) {
                    case "string":
                        A[key] = "-";
                        break;
                    case "integer":
                        A[key] = 0;
                        break;
                    case "float": 
                        A[key] = 0.0;
                        break;
                    case "bool": 
                        A[key] = false;
                        break;
                    case "enum":
                        A[key] = "-";
                        break;
                    case "enum-multiple": 
                        A[key] = [];
                        break;
                    default: 
                        A[key] = null;
                        break;
                }
            }
            else if (typeof attr === "object") {
                A[key] = buildProperties(attr);
            }
        }
        return A;

    };
    
    const metadata = buildProperties(data);
    metadata.schemaName = schemaName;

    return metadata;
};

MD.validateSchema = (data) => {
    let check = true;

    for (const key in data) {
        if (key === "required") continue;

        const attr = data[key];
        if (attr["type"]) {
            switch (attr.type.toLowerCase()) {
                case "string":
                    break;
                case "integer":
                    break;
                case "float": 
                    break;
                case "bool": 
                    break;
                case "enum":
                    break;
                case "enum-multiple": 
                    break;
                default:
                    check = false;
            }
        }
        else if (typeof attr === "object") {
            check = MD.validateSchema(attr);
        }
        else check = false;
    }
    return check;
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