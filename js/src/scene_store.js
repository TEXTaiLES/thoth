/*===========================================================================

    THOTH
    Canonical scene store

===========================================================================*/
let SceneStore = {};


const COLLECTION_NAMES = new Set([
    "selections",
    "measurements",
    "semantic_annotations",
    "sensors"
]);

const ANNOTATION_COLLECTION_NAMES = new Set([
    "selections",
    "measurements",
    "semantic_annotations"
]);

const RUNTIME_FIELDS = new Set([
    "trash",
    "visible_node",
    "ui_node",
    "three_node",
    "mesh",
    "material",
    "highlightColor",
    "path",
    "path_cache",
    "mesh_cache",
    "temp_node",
    "runtime_cache"
]);


// Setup

SceneStore.setup = () => {
    SceneStore.clear();
};

SceneStore.clear = (presentation = {}) => {
    SceneStore.scene = {
        ...SceneStore._normalizePresentation(presentation),
        models: {}
    };
};


// Normalize

SceneStore._isObject = (value) => {
    return value !== null && typeof value === "object" && !Array.isArray(value);
};

SceneStore._normalizeTransforms = (data = {}) => {
    return THOTH.Transforms.normalize(data);
};

SceneStore._normalizeArtefact = (data = {}) => {
    return THOTH.Artefacts.normalize(data, { preserveSceneInput: true });
};

SceneStore._normalizeMetadata = (data) => {
    if (data === undefined || data === null) {
        return {
            schema: {
                name       : "",
                version    : "",
                description: "",
                url        : ""
            },
            attributes: {}
        };
    }

    const metadata = SceneStore._isObject(data) ? data : {};
    const schemaName = metadata.schemaName || metadata.schema?.name || "";

    if (metadata.schema || metadata.attributes) {
        return {
            schema: {
                name       : schemaName,
                version    : metadata.schema?.version || "",
                description: metadata.schema?.description || "",
                url        : metadata.schema?.url || ""
            },
            attributes: SceneStore._normalizeObjectMap(metadata.attributes)
        };
    }

    const attributes = structuredClone(metadata);
    delete attributes.schemaName;
    const legacySchemaName = schemaName || (
        Object.keys(attributes).length > 0 ? "puc_schema" : ""
    );

    return {
        schema: {
            name       : legacySchemaName,
            version    : "",
            description: "",
            url        : ""
        },
        attributes: SceneStore._normalizeObjectMap(attributes)
    };
};

SceneStore._normalizeObjectMap = (data) => {
    if (SceneStore._isObject(data)) return structuredClone(data);

    return {};
};

SceneStore._normalizePresentation = (data = {}) => {
    const presentation = {};
    for (const field of ["title", "description", "kwords", "keywords", "visibility"]) {
        if (data[field] !== undefined) presentation[field] = structuredClone(data[field]);
    }
    return presentation;
};

SceneStore._normalizeAnnotationCollection = (data) => {
    const collection = SceneStore._normalizeObjectMap(data);

    if (typeof THOTH === "undefined" || !THOTH.Annotations) return collection;

    for (const annotationId in collection) {
        collection[annotationId] = THOTH.Annotations.normalize({
            ...collection[annotationId],
            id: collection[annotationId]?.id ?? annotationId
        });
    }

    return collection;
};

SceneStore._normalizeAnnotations = (data = {}) => {
    const annotations = SceneStore._isObject(data.annotations)
        ? data.annotations
        : {};

    return {
        selections: SceneStore._normalizeAnnotationCollection(
            annotations.selections ?? data.selections
        ),
        measurements: SceneStore._normalizeAnnotationCollection(
            annotations.measurements ?? data.measurements
        ),
        semantic_annotations: SceneStore._normalizeAnnotationCollection(
            annotations.semantic_annotations ?? data.semantic_annotations
        )
    };
};

SceneStore._normalizeSensors = (data) => {
    if (Array.isArray(data)) return structuredClone(data);

    return [];
};

SceneStore._normalizeModel = (modelId, data = {}) => {
    const model = {
        id: data.id || modelId,
        artefact: SceneStore._normalizeArtefact(data.artefact),
        metadata: SceneStore._normalizeMetadata(data.metadata),
        transforms: SceneStore._normalizeTransforms(data),
        annotations: SceneStore._normalizeAnnotations(data),
        sensors: SceneStore._normalizeSensors(data.sensors)
    };

    if (data.trash === true) model.trash = true;

    return model;
};

SceneStore._getExportValue = (value) => {
    if (Array.isArray(value)) {
        return value
            .filter(item => item?.trash !== true)
            .map(item => SceneStore._getExportValue(item));
    }

    if (!SceneStore._isObject(value)) return value;

    let output = {};
    for (const key in value) {
        if (RUNTIME_FIELDS.has(key)) continue;
        if (value[key]?.trash === true) continue;

        output[key] = SceneStore._getExportValue(value[key]);
    }

    return output;
};

SceneStore._getExportAnnotationCollection = (modelId, collectionName, collection = {}) => {
    if (collectionName === "selections" && typeof THOTH !== "undefined" && THOTH.Selections) {
        return THOTH.Selections.getExportData(modelId);
    }

    if (typeof THOTH !== "undefined" && THOTH.Annotations) {
        return THOTH.Annotations.getExportData(modelId, collectionName);
    }

    return SceneStore._getExportValue(collection);
};

SceneStore._getExportModel = (model) => {
    const output = SceneStore._getExportValue(model);
    const modelId = model.id;

    output.annotations = {
        selections: SceneStore._getExportAnnotationCollection(
            modelId,
            "selections",
            model.annotations?.selections
        ),
        measurements: SceneStore._getExportAnnotationCollection(
            modelId,
            "measurements",
            model.annotations?.measurements
        ),
        semantic_annotations: SceneStore._getExportAnnotationCollection(
            modelId,
            "semantic_annotations",
            model.annotations?.semantic_annotations
        )
    };

    return output;
};


// Scene

SceneStore.parseScene = (data) => {
    const presentation = {
        ...SceneStore.getPresentationData(),
        ...SceneStore._normalizePresentation(data)
    };
    SceneStore.clear(presentation);

    if (!SceneStore._isObject(data?.models)) return SceneStore.getScene();

    for (const modelId in data.models) {
        SceneStore.ensureModel(modelId, data.models[modelId]);
    }

    return SceneStore.getScene();
};

SceneStore.getScene = () => {
    return SceneStore.scene;
};

SceneStore.setSceneField = (fieldName, value) => {
    if (!["title", "description", "kwords", "keywords", "visibility"].includes(fieldName)) return;
    if (value === undefined) delete SceneStore.scene[fieldName];
    else SceneStore.scene[fieldName] = structuredClone(value);
    return SceneStore.scene[fieldName];
};

SceneStore.setPresentationData = (data = {}) => {
    const presentation = SceneStore._normalizePresentation(data);
    for (const [field, value] of Object.entries(presentation)) {
        SceneStore.setSceneField(field, value);
    }
    return SceneStore.getPresentationData();
};

SceneStore.getPresentationData = () => SceneStore._normalizePresentation(SceneStore.scene);

SceneStore.getExportData = () => {
    let models = {};

    for (const modelId in SceneStore.scene.models) {
        const model = SceneStore.scene.models[modelId];
        if (model.trash === true) continue;

        models[modelId] = SceneStore._getExportModel(model);
    }

    return {
        ...SceneStore.getPresentationData(),
        models
    };
};

SceneStore.getModelExportData = (modelId) => {
    const model = SceneStore.getModel(modelId);
    if (!model || model.trash === true) return;

    return SceneStore._getExportModel(model);
};

SceneStore.getModelMetadataExportData = (modelId) => {
    const model = SceneStore.getModel(modelId);
    if (!model || model.trash === true) return;

    return SceneStore._getExportValue(model.metadata)
};


// Models

SceneStore.ensureModel = (modelId, data = {}) => {
    if (!modelId) return;

    const currentModel = SceneStore.scene.models[modelId] || {};
    const nextData = {
        ...currentModel,
        ...structuredClone(data)
    };

    SceneStore.scene.models[modelId] = SceneStore._normalizeModel(modelId, nextData);

    if (currentModel.trash === true && data.trash === undefined) {
        SceneStore.scene.models[modelId].trash = true;
    }

    return SceneStore.scene.models[modelId];
};

SceneStore.getModel = (modelId) => {
    if (!modelId) return undefined;

    return SceneStore.scene.models[modelId];
};

SceneStore.deleteModel = (modelId) => {
    const model = SceneStore.getModel(modelId);
    if (!model) return;

    model.trash = true;
};

SceneStore.setModelField = (modelId, fieldName, value) => {
    const model = SceneStore.ensureModel(modelId);
    if (!model || !fieldName) return;

    if (fieldName === "transforms") {
        model.transforms = SceneStore._normalizeTransforms({ transforms: value });
    }
    else if (fieldName === "artefact") {
        model.artefact = SceneStore._normalizeArtefact(value);
    }
    else if (fieldName === "metadata") {
        model.metadata = SceneStore._normalizeMetadata(value);
    }
    else if (fieldName === "sensors") {
        model.sensors = SceneStore._normalizeSensors(value);
    }
    else {
        model[fieldName] = structuredClone(value);
    }

    return model[fieldName];
};

SceneStore.getModelCollection = (modelId, collectionName) => {
    if (!COLLECTION_NAMES.has(collectionName)) return;

    const model = SceneStore.ensureModel(modelId);
    if (ANNOTATION_COLLECTION_NAMES.has(collectionName)) {
        if (!model.annotations) model.annotations = SceneStore._normalizeAnnotations(model);
        if (!model.annotations[collectionName]) model.annotations[collectionName] = {};

        return model.annotations[collectionName];
    }

    return model?.[collectionName];
};

SceneStore.setModelCollectionItem = (modelId, collectionName, itemId, value) => {
    const collection = SceneStore.getModelCollection(modelId, collectionName);
    if (!collection || itemId === undefined || itemId === null) return;

    if (Array.isArray(collection)) {
        const nextItem = structuredClone(value);
        nextItem.id = nextItem.id || itemId;
        const itemIndex = collection.findIndex(item => item?.id === itemId);

        if (itemIndex === -1) collection.push(nextItem);
        else collection[itemIndex] = nextItem;

        return nextItem;
    }

    collection[itemId] = structuredClone(value);
    return collection[itemId];
};

SceneStore.deleteModelCollectionItem = (modelId, collectionName, itemId) => {
    const collection = SceneStore.getModelCollection(modelId, collectionName);
    if (!collection || itemId === undefined || itemId === null) return;

    if (Array.isArray(collection)) {
        const item = collection.find(value => value?.id === itemId);
        if (item) item.trash = true;
        return;
    }

    if (collection[itemId]) collection[itemId].trash = true;
};


export default SceneStore;
