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

Annotations._isObject = (value) => {
    return value !== null && typeof value === "object" && !Array.isArray(value);
};

Annotations._normalizeRelation = (relation) => {
    if (!Annotations._isObject(relation)) {
        const id = relation === undefined || relation === null ? "" : String(relation);

        return {
            id  : id,
            name: id,
            url : ""
        };
    }

    const id = String(
        relation.id ??
        relation.name ??
        relation.title ??
        relation.image_name ??
        relation.url ??
        relation.image_url ??
        relation.gltf_file ??
        ""
    );
    const url = typeof relation.url === "string"
        ? relation.url
        : typeof relation.image_url === "string"
            ? relation.image_url
            : relation.gltf_file || relation.path || relation.src || "";

    return {
        ...structuredClone(relation),
        id  : id,
        name: relation.name || relation.title || relation.image_name || id,
        url : url
    };
};

Annotations._normalizeRelations = (relations) => {
    if (!Array.isArray(relations)) return [];

    return relations
        .map(Annotations._normalizeRelation)
        .filter(relation => relation.id);
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
        ? structuredClone(data.annotation)
        : {};

    for (const key in data) {
        if (SHARED_FIELDS.has(key)) continue;
        if (RUNTIME_FIELDS.has(key)) continue;
        if (TOP_LEVEL_RUNTIME_FIELDS.has(key)) continue;
        if (data[key]?.trash === true) continue;

        payload[key] = structuredClone(data[key]);
    }

    return Annotations._stripRuntime(payload);
};

Annotations.normalizePoint = (point) => {
    if (!point) return point;

    if (!point.meshId && point.mesh) {
        const meshId = THOTH.Models?.getParent(point.mesh) ?? point.mesh.name;
        point.meshId = meshId;
        point.meshName = point.mesh.name;
        delete point.mesh;
    }
    if (!point.coords && point.x !== undefined) {
        point.coords = new THREE.Vector3(
            Number(point.x),
            Number(point.y),
            Number(point.z)
        );
    }
    if (point.face_id !== undefined && point.faceId === undefined) {
        point.faceId = point.face_id;
    }

    return point;
};

Annotations.toCanonicalPoint = (point) => {
    const normalized = Annotations.normalizePoint(point);
    const coords = normalized?.coords || normalized || {};

    return {
        x      : Number(coords.x ?? 0),
        y      : Number(coords.y ?? 0),
        z      : Number(coords.z ?? 0),
        face_id: normalized?.faceId ?? normalized?.face_id ?? null
    };
};

Annotations.fromCanonicalPoint = (point, modelId) => {
    if (!point) return undefined;

    return Annotations.normalizePoint({
        meshId  : point.meshId || point.mesh_id || modelId,
        meshName: point.meshName || point.mesh_name,
        faceId  : point.face_id ?? point.faceId ?? null,
        coords  : new THREE.Vector3(
            Number(point.x ?? point.coords?.x ?? 0),
            Number(point.y ?? point.coords?.y ?? 0),
            Number(point.z ?? point.coords?.z ?? 0)
        )
    });
};

Annotations.getModelNode = (modelId, create = false) => {
    if (!modelId) return null;

    return THOTH.Models?.modelMap?.get(modelId) ||
        ATON.getSceneNode?.(modelId) ||
        (create ? ATON.getOrCreateSceneNode?.(modelId) : null);
};

Annotations._coordsToVector3 = (coords) => {
    if (coords instanceof THREE.Vector3) return coords.clone();

    return new THREE.Vector3(
        Number(coords?.x ?? coords?.[0] ?? 0),
        Number(coords?.y ?? coords?.[1] ?? 0),
        Number(coords?.z ?? coords?.[2] ?? 0)
    );
};

Annotations.worldToModelLocal = (modelId, coords) => {
    const model = Annotations.getModelNode(modelId);
    const point = Annotations._coordsToVector3(coords);
    if (!model) return point;

    model.updateMatrixWorld(true);
    return model.worldToLocal(point);
};

Annotations.modelLocalToWorld = (modelId, coords) => {
    const model = Annotations.getModelNode(modelId);
    const point = Annotations._coordsToVector3(coords);
    if (!model) return point;

    model.updateMatrixWorld(true);
    return model.localToWorld(point);
};

Annotations.pointWorldToModelLocal = (modelId, point) => {
    if (!point) return point;

    const normalized = Annotations.normalizePoint(point);
    return {
        ...normalized,
        coords: Annotations.worldToModelLocal(
            modelId || Annotations.getPointModelId(normalized),
            normalized.coords
        )
    };
};

Annotations.createPointFromHit = () => {
    if (!ATON._hitsScene || ATON._hitsScene.length === 0) return undefined;

    const hit = ATON._hitsScene[0];
    const mesh = hit.object;
    const meshId = THOTH.Models?.getParent(mesh) ?? mesh.name;
    const coords = Annotations.worldToModelLocal(meshId, hit.point);

    return {
        meshId  : meshId,
        meshName: mesh.name,
        faceId  : hit.faceIndex,
        coords  : coords
    };
};

Annotations.getPointModel = (point) => {
    if (!point?.meshId) return null;
    return THOTH.Models?.modelMap?.get(point.meshId) ?? null;
};

Annotations.getPointModelId = (point) => {
    if (!point) return undefined;
    if (point.meshId) return point.meshId;
    if (point.mesh) return THOTH.Models?.getParent(point.mesh) ?? point.mesh.name;

    return undefined;
};

Annotations.getPointMesh = (point) => {
    if (!point) return null;
    if (point.mesh) return point.mesh;

    const model = Annotations.getPointModel(point);
    if (!model) return null;
    if (model.isMesh) return model;

    if (point.meshName) {
        let found = null;
        model.traverse(node => {
            if (!found && node.isMesh && node.name === point.meshName) {
                found = node;
            }
        });
        if (found) return found;
    }

    let first = null;
    model.traverse(node => {
        if (!first && node.isMesh) {
            first = node;
        }
    });
    return first;
};

Annotations.getPointMarkerScale = (point) => {
    const model = Annotations.getPointModel(point) ?? Annotations.getPointMesh(point);
    let modelScale = model ? THOTH.Utils.getModelScale(model) : THOTH.sceneScale;

    if (!Number.isFinite(modelScale) || modelScale <= 0) {
        modelScale = Number.isFinite(THOTH.sceneScale) && THOTH.sceneScale > 0
            ? THOTH.sceneScale
            : 1;
    }

    return modelScale * 0.01;
};

Annotations.applyPointMarkerScale = (marker, point) => {
    if (!marker || !point) return;

    const scale = Annotations.getPointMarkerScale(point);
    marker.scale.set(scale, scale, scale);
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
    const base = Annotations._isObject(data) ? structuredClone(data) : {};

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
    return Annotations.createBaseAnnotation(annotation?.id, annotation);
};

Annotations.clone = (annotation) => {
    return structuredClone(annotation);
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
        ...structuredClone(data),
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
