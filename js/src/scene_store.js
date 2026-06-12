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

const RUNTIME_FIELDS = new Set([
    "trash",
    "visible_node",
    "ui_node",
    "three_node",
    "mesh",
    "material",
    "path_cache",
    "mesh_cache"
]);


// Setup

SceneStore.setup = () => {
    SceneStore.clear();
};

SceneStore.clear = () => {
    SceneStore.scene = {
        models: {}
    };
};


// Normalize

SceneStore._clone = (value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;

    return structuredClone(value);
};

SceneStore._isObject = (value) => {
    return value !== null && typeof value === "object" && !Array.isArray(value);
};

SceneStore._normalizeVector = (value, defaultValue) => {
    if (Array.isArray(value)) {
        return {
            x: Number(value[0] ?? defaultValue.x),
            y: Number(value[1] ?? defaultValue.y),
            z: Number(value[2] ?? defaultValue.z)
        };
    }

    if (SceneStore._isObject(value)) {
        return {
            x: Number(value.x ?? defaultValue.x),
            y: Number(value.y ?? defaultValue.y),
            z: Number(value.z ?? defaultValue.z)
        };
    }

    return SceneStore._clone(defaultValue);
};

SceneStore._normalizeTransforms = (data = {}) => {
    const transform = data.transform || {};
    const transforms = data.transforms || {};

    return {
        translation: SceneStore._normalizeVector(
            transforms.translation || transform.translation || transform.position,
            { x: 0, y: 0, z: 0 }
        ),
        rotation: SceneStore._normalizeVector(
            transforms.rotation || transform.rotation,
            { x: 0, y: 0, z: 0 }
        ),
        scale: SceneStore._normalizeVector(
            transforms.scale || transform.scale,
            { x: 1, y: 1, z: 1 }
        )
    };
};

SceneStore._normalizeObjectMap = (data) => {
    if (SceneStore._isObject(data)) return SceneStore._clone(data);

    return {};
};

SceneStore._normalizeSensors = (data) => {
    if (Array.isArray(data)) return SceneStore._clone(data);

    return [];
};

SceneStore._normalizeModel = (modelId, data = {}) => {
    return {
        id: data.id || modelId,
        artefact: SceneStore._normalizeObjectMap(data.artefact),
        metadata: SceneStore._normalizeObjectMap(data.metadata),
        transforms: SceneStore._normalizeTransforms(data),
        selections: SceneStore._normalizeObjectMap(data.selections),
        measurements: SceneStore._normalizeObjectMap(data.measurements),
        semantic_annotations: SceneStore._normalizeObjectMap(data.semantic_annotations),
        sensors: SceneStore._normalizeSensors(data.sensors)
    };
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


// Scene

SceneStore.parseScene = (data) => {
    SceneStore.clear();

    if (!SceneStore._isObject(data?.models)) return SceneStore.getScene();

    for (const modelId in data.models) {
        SceneStore.ensureModel(modelId, data.models[modelId]);
    }

    return SceneStore.getScene();
};

SceneStore.getScene = () => {
    return SceneStore.scene;
};

SceneStore.getExportData = () => {
    let models = {};

    for (const modelId in SceneStore.scene.models) {
        const model = SceneStore.scene.models[modelId];
        if (model.trash === true) continue;

        models[modelId] = SceneStore._getExportValue(model);
    }

    return { models };
};


// Models

SceneStore.ensureModel = (modelId, data = {}) => {
    if (!modelId) return;

    const currentModel = SceneStore.scene.models[modelId] || {};
    const nextData = {
        ...currentModel,
        ...SceneStore._clone(data)
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
    else if (fieldName === "sensors") {
        model.sensors = SceneStore._normalizeSensors(value);
    }
    else {
        model[fieldName] = SceneStore._clone(value);
    }

    return model[fieldName];
};

SceneStore.getModelCollection = (modelId, collectionName) => {
    if (!COLLECTION_NAMES.has(collectionName)) return;

    const model = SceneStore.ensureModel(modelId);
    return model?.[collectionName];
};

SceneStore.setModelCollectionItem = (modelId, collectionName, itemId, value) => {
    const collection = SceneStore.getModelCollection(modelId, collectionName);
    if (!collection || !itemId) return;

    if (Array.isArray(collection)) {
        const nextItem = SceneStore._clone(value);
        nextItem.id = nextItem.id || itemId;
        const itemIndex = collection.findIndex(item => item?.id === itemId);

        if (itemIndex === -1) collection.push(nextItem);
        else collection[itemIndex] = nextItem;

        return nextItem;
    }

    collection[itemId] = SceneStore._clone(value);
    return collection[itemId];
};

SceneStore.deleteModelCollectionItem = (modelId, collectionName, itemId) => {
    const collection = SceneStore.getModelCollection(modelId, collectionName);
    if (!collection || !itemId) return;

    if (Array.isArray(collection)) {
        const item = collection.find(value => value?.id === itemId);
        if (item) item.trash = true;
        return;
    }

    if (collection[itemId]) collection[itemId].trash = true;
};


export default SceneStore;
