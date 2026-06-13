/*===========================================================================

    THOTH
    Scene operations

===========================================================================*/
let Ops = {};


const COLLECTION_TYPES = {
    selection           : "selections",
    measurement         : "measurements",
    semantic_annotation : "semantic_annotations"
};


// Setup

Ops.setup = () => {
    Ops.appliedTimestamps = new Map();
};


// Utils

Ops._clone = (value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;

    return structuredClone(value);
};

Ops._getLocalUserId = () => {
    return THOTH.user?.id || THOTH.user?.username || THOTH.user?.name || "local";
};

Ops._getTargetKey = (operation) => {
    const target = operation?.target || {};

    if (target.collection || target.item_id !== undefined) {
        return [
            "collection",
            target.model_id ?? "",
            target.collection ?? "",
            target.item_id ?? ""
        ].join(":");
    }

    if (operation?.type === "model.create" || operation?.type === "model.delete") {
        return [
            "model",
            target.model_id ?? ""
        ].join(":");
    }

    return [
        "model",
        target.model_id ?? "",
        target.field || operation?.type || ""
    ].join(":");
};

Ops._shouldApply = (operation) => {
    const timestamp = operation?.timestamp;
    if (timestamp === undefined || timestamp === null) return true;

    const key = Ops._getTargetKey(operation);
    const previousTimestamp = Ops.appliedTimestamps.get(key);

    return previousTimestamp === undefined || Number(timestamp) >= Number(previousTimestamp);
};

Ops._recordTimestamp = (operation) => {
    const timestamp = operation?.timestamp;
    if (timestamp === undefined || timestamp === null) return;

    Ops.appliedTimestamps.set(Ops._getTargetKey(operation), Number(timestamp));
};

Ops._getCollectionInfo = (type) => {
    const [prefix, action] = type.split(".");
    const collection = COLLECTION_TYPES[prefix];

    if (!collection) return null;

    return { prefix, action, collection };
};

Ops._getItemId = (operation) => {
    return operation?.target?.item_id ?? operation?.value?.id ?? operation?.prev_value?.id;
};

Ops._getModelId = (operation) => {
    return operation?.target?.model_id || operation?.value?.model_id || operation?.prev_value?.model_id;
};

Ops._replaceMapValue = (map, itemId, value) => {
    if (!map || itemId === undefined || value === undefined) return;

    map.set(itemId, Ops._clone(value));
};

Ops._applySelectionRuntime = (action, itemId, value) => {
    if (action === "create") {
        THOTH.Layers.createLayer(itemId);
        const layer = THOTH.Layers.layerMap.get(itemId);
        if (layer && value) Object.assign(layer, Ops._clone(value), { trash: false });
        THOTH.updateVisibility();
        return;
    }

    if (action === "update") {
        let layer = THOTH.Layers.layerMap.get(itemId);
        if (!layer && value) {
            THOTH.Layers.createLayer(itemId);
            layer = THOTH.Layers.layerMap.get(itemId);
        }
        if (!layer || !value) return;

        Object.assign(layer, Ops._clone(value));
        if (value.name !== undefined) {
            const layerNameBtn = THOTH.FE.layerNameMap.get(itemId);
            if (layerNameBtn) layerNameBtn.textContent = value.name;
        }
        if (value.visible !== undefined) {
            const layerController = THOTH.FE.layerMap.get(itemId);
            THOTH.FE.toggleControllerVisibility(layerController, value.visible);
        }
        THOTH.updateVisibility();
        return;
    }

    if (action === "delete") {
        THOTH.Layers.deleteLayer(itemId);
    }
};

Ops._applyMeasurementRuntime = (action, itemId, value, operation) => {
    if (action === "create") {
        const points = value?.points || [value?.point1, value?.point2];
        THOTH.MSR.addMeasurement(itemId, points[0], points[1], value);

        const measurement = THOTH.MSR.msrMap.get(itemId);
        if (measurement) operation.value = Ops._clone(measurement);
        return;
    }

    if (action === "update") {
        THOTH.MSR.updateMeasurement(itemId, value);
        return;
    }

    if (action === "delete") {
        THOTH.MSR.deleteMeasurement(itemId);
    }
};

Ops._applySemanticAnnotationRuntime = (action, itemId, value) => {
    if (action === "create") {
        THOTH.SemAnnotations.addAnnotation(itemId, value);
        return;
    }

    if (action === "update") {
        THOTH.SemAnnotations.updateAnnotation(itemId, value);
        return;
    }

    if (action === "delete") {
        THOTH.SemAnnotations.deleteAnnotation(itemId);
    }
};

Ops._applyModel = (operation) => {
    const modelId = operation.target?.model_id;
    const value = operation.value || {};

    switch (operation.type) {
        case "model.create": {
            THOTH.SceneStore.ensureModel(modelId, value);
            THOTH.Artefacts?.parseModelArtefact(modelId, value.artefact || {});
            THOTH.Transforms?.parseModelTransform(modelId, value.transforms || {});
            const modelURL = THOTH.Artefacts?.getModelURL(modelId) || modelId;
            THOTH.Models.addModelFromURL(modelURL, modelId);
            break;
        }
        case "model.delete":
            THOTH.SceneStore.deleteModel(modelId);
            THOTH.Models.deleteModel(modelId);
            break;
        case "model.update_artefact":
            THOTH.SceneStore.setModelField(modelId, "artefact", value);
            break;
        case "model.update_metadata":
            THOTH.SceneStore.setModelField(modelId, "metadata", value);
            break;
        case "model.update_transform":
            THOTH.Transforms.applyModelTransform(modelId, value);
            break;
        default:
            console.warn("Unsupported model operation:", operation.type);
    }
};

Ops._applyCollection = (operation) => {
    const info = Ops._getCollectionInfo(operation.type);
    if (!info) return false;

    const modelId = Ops._getModelId(operation);
    const itemId  = Ops._getItemId(operation);
    let value     = operation.value;

    if (info.prefix === "selection") {
        Ops._applySelectionRuntime(info.action, itemId, value);
    }
    else if (info.prefix === "measurement") {
        Ops._applyMeasurementRuntime(info.action, itemId, value, operation);
    }
    else if (info.prefix === "semantic_annotation") {
        Ops._applySemanticAnnotationRuntime(info.action, itemId, value);
    }

    if (info.action !== "delete" && THOTH.Annotations) {
        value = THOTH.Annotations.normalize(operation.value);
        operation.value = value;
    }

    if (info.action === "delete") {
        THOTH.SceneStore.deleteModelCollectionItem(modelId, info.collection, itemId);
    }
    else {
        THOTH.SceneStore.setModelCollectionItem(modelId, info.collection, itemId, operation.value);
    }

    return true;
};


// API

Ops.makeOperation = (type, target, value, prevValue) => {
    return {
        type      : type,
        target    : Ops._clone(target) || {},
        value     : Ops._clone(value),
        prev_value: Ops._clone(prevValue),
        user_id   : undefined,
        timestamp : undefined,
        source    : undefined
    };
};

Ops.apply = (operation, options = {}) => {
    if (!operation?.type) return false;
    if (!Ops._shouldApply(operation)) return false;

    if (operation.type.startsWith("model.")) Ops._applyModel(operation);
    else if (!Ops._applyCollection(operation)) {
        console.warn("Unsupported operation:", operation.type);
        return false;
    }

    Ops._recordTimestamp(operation);

    if (options.pushHistory) {
        THOTH.History.push(Ops.invert(operation));
    }
    if (options.broadcast) {
        Ops.broadcast(operation);
    }

    return true;
};

Ops.applyLocal = (operation) => {
    const localOperation = {
        ...Ops._clone(operation),
        user_id  : Ops._getLocalUserId(),
        timestamp: Date.now(),
        source   : "local"
    };

    return Ops.apply(localOperation, {
        pushHistory: true,
        broadcast  : true
    });
};

Ops.applyRemote = (operation) => {
    if (operation?.user_id === Ops._getLocalUserId()) return false;

    const remoteOperation = {
        ...Ops._clone(operation),
        source: "remote"
    };

    return Ops.apply(remoteOperation, {
        pushHistory: false,
        broadcast  : false
    });
};

Ops.invert = (operation) => {
    if (!operation?.type) return;

    let inverseType = operation.type;
    if (operation.type.endsWith(".create")) {
        inverseType = operation.type.replace(".create", ".delete");
    }
    else if (operation.type.endsWith(".delete")) {
        inverseType = operation.type.replace(".delete", ".create");
    }

    return {
        type      : inverseType,
        target    : Ops._clone(operation.target),
        value     : Ops._clone(operation.prev_value),
        prev_value: Ops._clone(operation.value),
        user_id   : operation.user_id,
        timestamp : operation.timestamp,
        source    : operation.source
    };
};

Ops.broadcast = (operation) => {
    if (!THOTH.collaborative || !THOTH.firePhoton) return;

    THOTH.firePhoton("thoth.operation", Ops._clone(operation));
};


export default Ops;
