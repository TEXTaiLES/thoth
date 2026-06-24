/*===========================================================================

    THOTH
    Shared annotation API

===========================================================================*/
let Annotations = {};


const MODALITIES = {
    selections: {
        operationPrefix: "selection"
    },
    measurements: {
        operationPrefix: "measurement"
    },
    semantic_annotations: {
        operationPrefix: "semantic_annotation"
    }
};

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
    "runtime_cache",
    "model_id",
    "meshId",
    "meshName",
    "faceId",
    "coords",
    "distanceType"
]);

const TOP_LEVEL_RUNTIME_FIELDS = new Set([
    "model_id",
    "meshId",
    "meshName",
    "faceId",
    "coords",
    "point",
    "point1",
    "point2",
    "points",
    "distance",
    "distanceType",
    "distance_type"
]);

const RELATION_FIELDS = [
    "related_rgb_images",
    "related_multispectral_images",
    "related_artefacts"
];

const SHARED_FIELDS = new Set([
    "id",
    "name",
    "description",
    "related_rgb_images",
    "related_multispectral_images",
    "related_artefacts",
    "annotation",
    "visible"
]);


// Setup

Annotations.setup = () => {
    Annotations.modalities = MODALITIES;
    Annotations.activeAnnotation = null;
};


// Utils

Annotations._clone = (value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;

    return structuredClone(value);
};

Annotations._isObject = (value) => {
    return value !== null && typeof value === "object" && !Array.isArray(value);
};

Annotations._normalizeRelation = (relation) => {
    if (!Annotations._isObject(relation)) {
        return {
            id  : relation === undefined || relation === null ? "" : String(relation),
            name: "",
            url : ""
        };
    }

    return {
        ...Annotations._clone(relation),
        id  : relation.id === undefined || relation.id === null ? "" : String(relation.id),
        name: relation.name || "",
        url : relation.url || ""
    };
};

Annotations._normalizeRelations = (relations) => {
    if (!Array.isArray(relations)) return [];

    return relations.map(Annotations._normalizeRelation);
};

Annotations._stripRuntime = (value) => {
    if (Array.isArray(value)) {
        return value
            .filter(item => item?.trash !== true)
            .map(Annotations._stripRuntime);
    }

    if (!Annotations._isObject(value)) return value;

    let output = {};
    for (const key in value) {
        if (RUNTIME_FIELDS.has(key)) continue;
        if (value[key]?.trash === true) continue;

        output[key] = Annotations._stripRuntime(value[key]);
    }

    return output;
};

Annotations._getAnnotationPayload = (data = {}) => {
    const payload = Annotations._isObject(data.annotation)
        ? Annotations._clone(data.annotation)
        : {};

    for (const key in data) {
        if (SHARED_FIELDS.has(key)) continue;
        if (RUNTIME_FIELDS.has(key)) continue;
        if (TOP_LEVEL_RUNTIME_FIELDS.has(key)) continue;
        if (data[key]?.trash === true) continue;

        payload[key] = Annotations._clone(data[key]);
    }

    return Annotations._stripRuntime(payload);
};

Annotations._getOperationPrefix = (modality) => {
    return MODALITIES[modality]?.operationPrefix;
};

Annotations._getFallbackModelId = () => {
    const models = THOTH.SceneStore?.getScene()?.models || {};
    const modelIds = Object.keys(models);
    if (modelIds.length > 0) return modelIds[0];

    if (THOTH.Models?.modelMap?.size > 0) {
        return THOTH.Models.modelMap.keys().next().value;
    }

    return undefined;
};

Annotations._makeTarget = (modelId, modality, annotationId, field) => {
    const target = {
        model_id  : modelId ?? Annotations._getFallbackModelId(),
        collection: modality,
        item_id   : annotationId
    };

    if (field) target.field = field;

    return target;
};

Annotations._applyCollectionOperation = (type, target, value, prevValue) => {
    if (!THOTH.Ops) return false;

    const operation = THOTH.Ops.makeOperation(type, target, value, prevValue);
    return THOTH.Ops.applyLocal(operation);
};

Annotations._getSelectionTarget = (selectionId, modelId) => {
    const selection = modelId !== undefined
        ? THOTH.Selections?.getSelection(modelId, selectionId)
        : THOTH.Selections?.getSelectionById(selectionId);
    if (!selection || selection.trash === true) return null;

    return {
        modality: "selections",
        id      : selection.id,
        model_id: selection.model_id,
        item    : selection
    };
};

Annotations._getMeasurementTarget = (measurementId, modelId) => {
    const measurementKey = THOTH.MSR?.getMeasurementKey?.(measurementId) ?? measurementId;
    const measurement = THOTH.MSR?.getMeasurement?.(measurementKey);
    if (!measurement || measurement.trash === true) return null;

    return {
        modality: "measurements",
        id      : measurementKey,
        model_id: measurement.model_id || modelId || Annotations.getModelId("measurements", measurementKey),
        item    : measurement
    };
};

Annotations._getSemanticTarget = (annotationId, modelId) => {
    const annotationKey = THOTH.SemAnnotations?.getAnnotationKey?.(annotationId) ?? annotationId;
    const annotation = THOTH.SemAnnotations?.getAnnotation?.(annotationKey);
    if (!annotation || annotation.trash === true) return null;

    return {
        modality: "semantic_annotations",
        id      : annotationKey,
        model_id: annotation.model_id || modelId || Annotations.getModelId("semantic_annotations", annotationKey),
        item    : annotation
    };
};

Annotations._resolveTarget = (modality, annotationId, modelId) => {
    if (modality === "selections") {
        return Annotations._getSelectionTarget(annotationId, modelId);
    }
    if (modality === "measurements") {
        return Annotations._getMeasurementTarget(annotationId, modelId);
    }
    if (modality === "semantic_annotations") {
        return Annotations._getSemanticTarget(annotationId, modelId);
    }

    return null;
};

Annotations._getControllerKey = (target) => {
    if (!target) return undefined;
    if (target.modality === "selections") {
        return THOTH.Selections?._makeKey?.(target.model_id, target.id);
    }

    return target.id;
};

Annotations._getControllerMap = (modality) => {
    if (modality === "selections") return THOTH.FE?.selectionControllerMap;
    if (modality === "measurements") return THOTH.FE?.msrMap;
    if (modality === "semantic_annotations") return THOTH.FE?.semMap;

    return undefined;
};

Annotations._setSceneTreeActive = (target) => {
    if (!THOTH.FE) return;
    if (!target?.model_id) {
        THOTH.FE.sceneTreeActiveKey = null;
        return;
    }

    THOTH.FE.sceneTreeActiveKey = `model:${target.model_id}:${target.modality}:${target.id}`;
    THOTH.FE.sceneTreeExpanded?.add(`model:${target.model_id}`);
    THOTH.FE.sceneTreeExpanded?.add(`model:${target.model_id}:${target.modality}`);
};

Annotations._clearRuntimeState = () => {
    if (THOTH.Selections) THOTH.Selections.activeSelection = undefined;
    THOTH.MSR?.clearMeasurementHighlight?.(false);
    THOTH.SemAnnotations?.clearAnnotationHighlight?.(false);

    THOTH.FE?.handleElementHighlight?.(null, THOTH.FE?.selectionControllerMap);
    THOTH.FE?.handleElementHighlight?.(null, THOTH.FE?.msrMap);
    THOTH.FE?.handleElementHighlight?.(null, THOTH.FE?.semMap);
};

Annotations._applyRuntimeState = (target) => {
    if (target.modality === "selections") {
        THOTH.Selections.activeSelection = target.item;
    }
    else if (target.modality === "measurements") {
        THOTH.MSR?.applyMeasurementHighlight?.(target.id);
    }
    else if (target.modality === "semantic_annotations") {
        THOTH.SemAnnotations?.applyAnnotationHighlight?.(target.id);
    }

    THOTH.FE?.handleElementHighlight?.(
        Annotations._getControllerKey(target),
        Annotations._getControllerMap(target.modality)
    );
};


// Active annotation

Annotations.clearActive = (options = {}) => {
    Annotations.activeAnnotation = null;
    Annotations._clearRuntimeState();

    if (THOTH.FE && options.clearSceneTree !== false) {
        THOTH.FE.sceneTreeActiveKey = null;
    }

    if (options.refreshSceneTree !== false) {
        THOTH.FE?.refreshSceneTree?.();
    }
};

Annotations.select = (modality, annotationId, options = {}) => {
    const modelId = options.modelId ?? options.model_id;
    const target = Annotations._resolveTarget(modality, annotationId, modelId);
    if (!target) return false;

    Annotations.clearActive({
        clearSceneTree   : false,
        refreshSceneTree : false
    });

    Annotations.activeAnnotation = {
        modality: target.modality,
        id      : target.id,
        model_id: target.model_id
    };

    Annotations._applyRuntimeState(target);
    Annotations._setSceneTreeActive(target);

    if (options.refreshSceneTree !== false) {
        THOTH.FE?.refreshSceneTree?.();
    }

    return true;
};

Annotations.getActive = () => {
    if (!Annotations.activeAnnotation) return null;

    return { ...Annotations.activeAnnotation };
};

Annotations.isActive = (modality, annotationId, modelId) => {
    const active = Annotations.activeAnnotation;
    if (!active || active.modality !== modality) return false;

    const target = Annotations._resolveTarget(modality, annotationId, modelId);
    if (!target) {
        return String(active.id) === String(annotationId) &&
            (modelId === undefined || String(active.model_id) === String(modelId));
    }

    return String(active.id) === String(target.id) &&
        String(active.model_id) === String(target.model_id);
};

Annotations.getActiveSelection = () => {
    if (Annotations.activeAnnotation?.modality !== "selections") return undefined;

    return THOTH.Selections?.getSelection?.(
        Annotations.activeAnnotation.model_id,
        Annotations.activeAnnotation.id
    ) || THOTH.Selections?.activeSelection;
};


// Shape

Annotations.createBaseAnnotation = (id, data = {}) => {
    const base = Annotations._isObject(data) ? Annotations._clone(data) : {};

    return {
        ...base,
        id                            : base.id ?? id ?? "",
        name                          : base.name || "",
        description                   : base.description || "",
        related_rgb_images            : Annotations._normalizeRelations(base.related_rgb_images),
        related_multispectral_images  : Annotations._normalizeRelations(base.related_multispectral_images),
        related_artefacts             : Annotations._normalizeRelations(base.related_artefacts),
        annotation                    : Annotations._getAnnotationPayload(base),
        visible                       : base.visible !== false
    };
};

Annotations.normalize = (annotation) => {
    const normalized = Annotations.createBaseAnnotation(annotation?.id, annotation);

    for (const fieldName of RELATION_FIELDS) {
        normalized[fieldName] = Annotations._normalizeRelations(normalized[fieldName]);
    }

    return normalized;
};

Annotations.clone = (annotation) => {
    return Annotations._clone(annotation);
};

Annotations.toExportAnnotation = (annotation) => {
    const normalized = Annotations.normalize(annotation);

    return {
        id                          : normalized.id,
        name                        : normalized.name,
        description                 : normalized.description,
        related_rgb_images          : normalized.related_rgb_images,
        related_multispectral_images: normalized.related_multispectral_images,
        related_artefacts           : normalized.related_artefacts,
        annotation                  : Annotations._getAnnotationPayload(normalized),
        visible                     : normalized.visible !== false
    };
};

Annotations.toStorageAnnotation = (modality, annotationId, annotation) => {
    if (modality === "measurements" && THOTH.MSR?.toCanonicalMeasurement) {
        return THOTH.MSR.toCanonicalMeasurement(annotationId, annotation);
    }

    if (modality === "semantic_annotations" && THOTH.SemAnnotations?.toCanonicalAnnotation) {
        return THOTH.SemAnnotations.toCanonicalAnnotation(annotationId, annotation);
    }

    return Annotations.normalize(annotation);
};

Annotations.toStorageExportAnnotation = (modality, annotationId, annotation) => {
    const normalized = Annotations.toStorageAnnotation(modality, annotationId, annotation);

    return Annotations.toExportAnnotation(normalized);
};


// Collections

Annotations.getCollection = (modelId, modality) => {
    if (!MODALITIES[modality]) return undefined;

    return THOTH.SceneStore?.getModelCollection(modelId, modality);
};

Annotations.get = (modelId, modality, annotationId) => {
    const collection = Annotations.getCollection(modelId, modality);
    if (!collection || annotationId === undefined) return undefined;

    return collection[annotationId];
};

Annotations.getModelId = (modality, annotationId) => {
    if (!MODALITIES[modality] || annotationId === undefined) return undefined;

    const models = THOTH.SceneStore?.getScene()?.models || {};
    for (const modelId in models) {
        const model = models[modelId] || {};
        const collection = model.annotations?.[modality] || model[modality];
        if (collection && collection[annotationId] !== undefined) return modelId;
    }

    return undefined;
};

Annotations.create = (modelId, modality, annotation) => {
    const prefix = Annotations._getOperationPrefix(modality);
    if (!prefix) return false;

    const value = Annotations.toStorageAnnotation(modality, annotation?.id, annotation);
    const id    = value.id;
    const target = Annotations._makeTarget(modelId, modality, id);

    return Annotations._applyCollectionOperation(`${prefix}.create`, target, value);
};

Annotations.update = (modelId, modality, annotationId, data) => {
    const prefix = Annotations._getOperationPrefix(modality);
    if (!prefix) return false;

    const resolvedModelId = modelId ?? Annotations.getModelId(modality, annotationId);
    const prevValue = Annotations.clone(Annotations.get(resolvedModelId, modality, annotationId));
    if (!prevValue) return false;

    const value = Annotations.toStorageAnnotation(modality, annotationId, {
        ...prevValue,
        ...Annotations._clone(data),
        id: annotationId
    });
    const target = Annotations._makeTarget(resolvedModelId, modality, annotationId);

    return Annotations._applyCollectionOperation(`${prefix}.update`, target, value, prevValue);
};

Annotations.delete = (modelId, modality, annotationId) => {
    const prefix = Annotations._getOperationPrefix(modality);
    if (!prefix) return false;

    const resolvedModelId = modelId ?? Annotations.getModelId(modality, annotationId);
    const prevValue = Annotations.clone(Annotations.get(resolvedModelId, modality, annotationId));
    if (!prevValue) return false;

    const target = Annotations._makeTarget(resolvedModelId, modality, annotationId);

    return Annotations._applyCollectionOperation(`${prefix}.delete`, target, null, prevValue);
};

Annotations.setVisible = (modelId, modality, annotationId, visible) => {
    const prefix = Annotations._getOperationPrefix(modality);
    if (!prefix) return false;

    const resolvedModelId = modelId ?? Annotations.getModelId(modality, annotationId);
    const prevValue = Annotations.clone(Annotations.get(resolvedModelId, modality, annotationId));
    if (!prevValue) return false;

    const value = Annotations.toStorageAnnotation(modality, annotationId, {
        ...prevValue,
        id     : annotationId,
        visible: Boolean(visible)
    });
    const target = Annotations._makeTarget(resolvedModelId, modality, annotationId, "visible");

    return Annotations._applyCollectionOperation(`${prefix}.update`, target, value, prevValue);
};

Annotations.getExportData = (modelId, modality) => {
    const collection = Annotations.getCollection(modelId, modality);
    if (!collection) return {};

    let output = {};
    for (const annotationId in collection) {
        const annotation = collection[annotationId];
        if (!annotation || annotation.trash === true) continue;

        output[annotationId] = Annotations.toStorageExportAnnotation(modality, annotationId, annotation);
    }

    return output;
};


export default Annotations;
