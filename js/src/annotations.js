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
    "path",
    "path_cache",
    "mesh_cache",
    "temp_node",
    "runtime_cache"
]);

const RELATION_FIELDS = [
    "related_rgb_images",
    "related_multispectral_images",
    "related_artefacts"
];


// Setup

Annotations.setup = () => {
    Annotations.modalities = MODALITIES;
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
        model_id  : modelId || Annotations._getFallbackModelId(),
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
        annotation                    : Annotations._isObject(base.annotation) ? Annotations._clone(base.annotation) : {},
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
    return Annotations._stripRuntime(normalized);
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
        const collection = models[modelId]?.[modality];
        if (collection && collection[annotationId] !== undefined) return modelId;
    }

    return undefined;
};

Annotations.create = (modelId, modality, annotation) => {
    const prefix = Annotations._getOperationPrefix(modality);
    if (!prefix) return false;

    const value = Annotations.normalize(annotation);
    const id    = value.id;
    const target = Annotations._makeTarget(modelId, modality, id);

    return Annotations._applyCollectionOperation(`${prefix}.create`, target, value);
};

Annotations.update = (modelId, modality, annotationId, data) => {
    const prefix = Annotations._getOperationPrefix(modality);
    if (!prefix) return false;

    const resolvedModelId = modelId || Annotations.getModelId(modality, annotationId);
    const prevValue = Annotations.clone(Annotations.get(resolvedModelId, modality, annotationId));
    if (!prevValue) return false;

    const value = Annotations.normalize({
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

    const resolvedModelId = modelId || Annotations.getModelId(modality, annotationId);
    const prevValue = Annotations.clone(Annotations.get(resolvedModelId, modality, annotationId));
    if (!prevValue) return false;

    const target = Annotations._makeTarget(resolvedModelId, modality, annotationId);

    return Annotations._applyCollectionOperation(`${prefix}.delete`, target, null, prevValue);
};

Annotations.setVisible = (modelId, modality, annotationId, visible) => {
    const prefix = Annotations._getOperationPrefix(modality);
    if (!prefix) return false;

    const resolvedModelId = modelId || Annotations.getModelId(modality, annotationId);
    const prevValue = Annotations.clone(Annotations.get(resolvedModelId, modality, annotationId));
    if (!prevValue) return false;

    const value = Annotations.normalize({
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

        output[annotationId] = Annotations.toExportAnnotation(annotation);
    }

    return output;
};


export default Annotations;
