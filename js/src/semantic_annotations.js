/*===========================================================================

    THOTH
    Semantic annotation functionalities

===========================================================================*/
import Label from "./measurements.label.js"

let SemAnnotations = {};



// Setup

SemAnnotations.setup = () => {
    SemAnnotations.semMap     = new Map();
    SemAnnotations.semNodeMap = new Map();

    SemAnnotations.nodes = SemAnnotations.createAnnotationNodes();
    SemAnnotations.modelNodeMap = new Map();
    SemAnnotations.tempNode = null;

    SemAnnotations.enabled = false;
    SemAnnotations.paused  = false;

    SemAnnotations.labelScaleFactor = 0.05;
    SemAnnotations.lastSceneScale   = null;
    SemAnnotations.isSceneLoading   = true;
    SemAnnotations.defaultPointColor = 0xffffff;
    SemAnnotations.selectedPointColor = 0xff0000;
    SemAnnotations.currentAnnotation = null;

    ATON.on("SceneJSONLoaded", () => {
        SemAnnotations.isSceneLoading = true;
        SemAnnotations.refreshAnnotationVisibility();
    });

    ATON.on("AllNodeRequestsCompleted", () => {
        SemAnnotations.isSceneLoading = false;
        SemAnnotations.refreshMarkerScales();
        SemAnnotations.refreshAnnotationVisibility();
    });
};


SemAnnotations.parseAnnotations = (annotations, modelId) => {
    if (annotations === undefined) return;

    for (const id in annotations) {
        const annotation = SemAnnotations.normalizeAnnotation({
            ...annotations[id],
            id      : annotations[id]?.id ?? id,
            model_id: modelId ?? annotations[id]?.model_id
        });
        SemAnnotations.semMap.set(id, annotation);
        THOTH.SceneStore?.setModelCollectionItem?.(
            annotation.model_id,
            "semantic_annotations",
            id,
            SemAnnotations.toCanonicalAnnotation(id, annotation)
        );
        THOTH.FE.addSemAnnotation(id);
        SemAnnotations.addAnnotationSem(id);
    }
};


// Utils

SemAnnotations.cloneAnnotation = (annotation) => {
    if (!annotation) return annotation;

    return structuredClone(annotation);
};

SemAnnotations.normalizeAnnotation = (annotation) => {
    if (!annotation) return annotation;

    let point = annotation.point ||
        SemAnnotations.fromCanonicalPoint(annotation.annotation?.point, annotation.model_id);
    const coordinateSpace = annotation.coordinate_space || annotation.annotation?.coordinate_space;
    if (coordinateSpace !== "model_local" && !annotation.point && annotation.annotation?.point) {
        point = SemAnnotations.pointWorldToModelLocal(annotation.model_id, point);
    }
    const normalized = THOTH.Annotations?.createBaseAnnotation(annotation.id, {
        ...annotation,
        annotation: {
            ...(annotation.annotation || {}),
            coordinate_space: "model_local",
            point           : SemAnnotations.toCanonicalPoint(point)
        }
    }) || structuredClone(annotation);

    normalized.point = SemAnnotations.normalizePoint(point);
    normalized.model_id = annotation.model_id;
    normalized.annotation = {
        ...(normalized.annotation || {}),
        coordinate_space: "model_local",
        point           : SemAnnotations.toCanonicalPoint(normalized.point)
    };

    if (!normalized.name) normalized.name = `Semantic ${normalized.id}`;
    if (normalized.visible === undefined) normalized.visible = true;
    if (normalized.trash === undefined) normalized.trash = false;
    if (normalized.description === undefined) normalized.description = "";

    return normalized;
};

SemAnnotations.normalizePoint = (point) => {
    return THOTH.Annotations.normalizePoint(point);
};

SemAnnotations.toCanonicalPoint = (point) => {
    return THOTH.Annotations.toCanonicalPoint(point);
};

SemAnnotations.fromCanonicalPoint = (point, modelId) => {
    return THOTH.Annotations.fromCanonicalPoint(point, modelId);
};

SemAnnotations.toCanonicalAnnotation = (annotationId, data = {}) => {
    const point = data.point || SemAnnotations.fromCanonicalPoint(data.annotation?.point, data.model_id);

    return THOTH.Annotations?.createBaseAnnotation(annotationId, {
        ...data,
        id        : data.id ?? annotationId,
        annotation: {
            ...(data.annotation || {}),
            coordinate_space: "model_local",
            point           : SemAnnotations.toCanonicalPoint(point)
        }
    }) || {
        id        : data.id ?? annotationId,
        annotation: {
            coordinate_space: "model_local",
            point           : SemAnnotations.toCanonicalPoint(point)
        },
        visible: data.visible !== false
    };
};

SemAnnotations.getModelNode = (modelId, create = false) => {
    return THOTH.Annotations.getModelNode(modelId, create);
};

SemAnnotations._coordsToVector3 = (coords) => {
    return THOTH.Annotations._coordsToVector3(coords);
};

SemAnnotations.worldToModelLocal = (modelId, coords) => {
    return THOTH.Annotations.worldToModelLocal(modelId, coords);
};

SemAnnotations.modelLocalToWorld = (modelId, coords) => {
    return THOTH.Annotations.modelLocalToWorld(modelId, coords);
};

SemAnnotations.pointWorldToModelLocal = (modelId, point) => {
    return THOTH.Annotations.pointWorldToModelLocal(modelId, point);
};

SemAnnotations.getPointModel = (point) => {
    return THOTH.Annotations.getPointModel(point);
};

SemAnnotations.getPointModelId = (point) => {
    return THOTH.Annotations.getPointModelId(point);
};

SemAnnotations.getPointMesh = (point) => {
    return THOTH.Annotations.getPointMesh(point);
};

SemAnnotations.getLabelScale = () => {
    const sceneScale = THOTH.sceneScale;
    if (!Number.isFinite(sceneScale)) return null;
    return sceneScale * SemAnnotations.labelScaleFactor;
};

SemAnnotations.applyLabelScale = (label) => {
    if (!label) return;

    const scale = SemAnnotations.getLabelScale();
    if (scale === null) {
        label.setScale(0);
        label.setOpacity(0);
        return;
    }

    label.setScale(scale);
    label.setOpacity(1);
};

SemAnnotations.refreshLabelScales = () => {
    const sceneScale = THOTH.sceneScale;
    if (!Number.isFinite(sceneScale)) return;
    if (SemAnnotations.lastSceneScale === sceneScale) return;
    SemAnnotations.lastSceneScale = sceneScale;

    for (const node of SemAnnotations.semNodeMap.values()) {
        const label = node.children.find(child => child instanceof Label);
        if (label) SemAnnotations.applyLabelScale(label);
    }
};

SemAnnotations.getPointMarkerScale = (point) => {
    return THOTH.Annotations.getPointMarkerScale(point);
};

SemAnnotations.applyPointMarkerScale = (marker, point) => {
    return THOTH.Annotations.applyPointMarkerScale(marker, point);
};

SemAnnotations.refreshMarkerScales = () => {
    for (const [annotationId, node] of SemAnnotations.semNodeMap.entries()) {
        const annotation = SemAnnotations.semMap.get(annotationId);
        if (!node || !annotation?.point) continue;

        const marker = node.children.find(child => child.isMesh);
        SemAnnotations.applyPointMarkerScale(marker, annotation.point);
    }
};

SemAnnotations.refreshAnnotationVisibility = () => {
    for (const [id, annotation] of SemAnnotations.semMap.entries()) {
        const node = SemAnnotations.semNodeMap.get(id);
        if (!node || !annotation) continue;

        const shouldShow = !SemAnnotations.isSceneLoading && annotation.trash !== true && annotation.visible !== false;
        if (shouldShow) node.show();
        else node.hide();
    }
};

SemAnnotations.getAnnotationKey = (annotationId) => {
    if (SemAnnotations.semMap.has(annotationId)) return annotationId;

    for (const key of SemAnnotations.semMap.keys()) {
        if (String(key) === String(annotationId)) return key;
    }

    return annotationId;
};

SemAnnotations.getAnnotation = (annotationId) => {
    return SemAnnotations.semMap.get(SemAnnotations.getAnnotationKey(annotationId));
};

SemAnnotations._syncAnnotationPointCoordinates = (annotation) => {
    if (!annotation?.point) return;

    annotation.point = SemAnnotations.normalizePoint(annotation.point);
    annotation.annotation = {
        ...(annotation.annotation || {}),
        coordinate_space: "model_local",
        point           : SemAnnotations.toCanonicalPoint(annotation.point)
    };
};


// Geometries

SemAnnotations.createAnnotationNodes = () => {
    return new Map();
};

SemAnnotations.getModelAnnotationNode = (modelId) => {
    if (!modelId) return null;
    if (SemAnnotations.modelNodeMap.has(modelId)) {
        const node = SemAnnotations.modelNodeMap.get(modelId);
        if (node?.parent) return node;

        SemAnnotations.modelNodeMap.delete(modelId);
        SemAnnotations.nodes.delete(modelId);
    }

    const model = SemAnnotations.getModelNode(modelId, true);
    if (!model) return null;

    const node = new ATON.Node(`semanticAnnotations_${modelId}`, ATON.NTYPES.UI);
    node.attachTo(model);
    SemAnnotations.modelNodeMap.set(modelId, node);
    SemAnnotations.nodes.set(modelId, node);

    return node;
};

SemAnnotations.createPointFromHit = () => {
    return THOTH.Annotations.createPointFromHit() ?? null;
};

SemAnnotations.createPointSem = (point) => {
    const geometry = new THREE.SphereGeometry(1, 16, 12);
    const material = ATON.MatHub.getMaterial("measurement").clone();
    const pointSem = new THREE.Mesh(geometry, material);

    pointSem.renderOrder = ATON.RO_SUI;
    pointSem.position.copy(point.coords);
    pointSem.userData.thothMarker = "semantic-point";
    pointSem.userData.defaultColor = material.color?.clone() || new THREE.Color(SemAnnotations.defaultPointColor);
    SemAnnotations.applyPointMarkerScale(pointSem, point);

    return pointSem;
};

SemAnnotations.createLabelSem = (annotationId) => {
    const annotation = SemAnnotations.getAnnotation(annotationId);
    if (!annotation) return;

    const point = annotation.point;
    const label = new Label("", annotation.name || `Semantic ${annotationId}`);
    label.setPosition(point.coords.x, point.coords.y, point.coords.z);
    SemAnnotations.applyLabelScale(label);

    return label;
};

SemAnnotations.addTempAnnotationSem = (point) => {
    SemAnnotations.clearTempAnnotationSem();
    SemAnnotations.tempNode = SemAnnotations.createPointSem(point);
    const modelNode = SemAnnotations.getModelAnnotationNode(SemAnnotations.getPointModelId(point));
    if (modelNode) modelNode.add(SemAnnotations.tempNode);
};

SemAnnotations.clearTempAnnotationSem = () => {
    if (!SemAnnotations.tempNode) return;

    if (SemAnnotations.tempNode.parent) {
        SemAnnotations.tempNode.parent.remove(SemAnnotations.tempNode);
    }
    SemAnnotations.tempNode = null;
};

SemAnnotations.addAnnotationSem = (annotationId) => {
    if (annotationId === undefined) return;

    const annotationKey = SemAnnotations.getAnnotationKey(annotationId);
    const annotation = SemAnnotations.semMap.get(annotationKey);
    if (!annotation) return;
    const modelNode = SemAnnotations.getModelAnnotationNode(annotation.model_id || SemAnnotations.getPointModelId(annotation.point));
    if (!modelNode) return;

    const oldNode = SemAnnotations.semNodeMap.get(annotationKey);
    if (oldNode?.parent) oldNode.parent.remove(oldNode);

    const pointSem = SemAnnotations.createPointSem(annotation.point);
    const label    = SemAnnotations.createLabelSem(annotationKey);
    const node     = new ATON.Node(`semanticAnnotation${annotationKey}`, ATON.NTYPES.UI);

    node.add(pointSem);
    node.add(label);
    node.setPickable(true);
    node.setOnSelect(() => {
        THOTH.Annotations?.select?.("semantic_annotations", annotationKey);
        THOTH.UI.modalSemAnnotationDetails(annotationKey);
    });

    SemAnnotations.semNodeMap.set(annotationKey, node);
    node.attachTo(modelNode);

    SemAnnotations.refreshMarkerScales();
    SemAnnotations.refreshAnnotationVisibility();
    return node;
};

SemAnnotations.updateAnnotationSem = (annotationId) => {
    SemAnnotations.addAnnotationSem(annotationId);
};


// Management

SemAnnotations.createAnnotationData = (annotationId, point, data = {}) => {
    return SemAnnotations.normalizeAnnotation({
        id         : annotationId,
        model_id   : data.model_id || SemAnnotations.getPointModelId(point),
        name       : data.name || `Semantic ${annotationId}`,
        description: data.description || "",
        related_rgb_images          : data.related_rgb_images || [],
        related_multispectral_images: data.related_multispectral_images || [],
        related_artefacts           : data.related_artefacts || [],
        annotation  : data.annotation || {},
        point      : SemAnnotations.normalizePoint(point),
        visible    : data.visible !== false,
        trash      : false
    });
};

SemAnnotations.addAnnotation = (annotationId, annotationData) => {
    if (annotationId === undefined || !annotationData) return;

    const existingAnnotation = SemAnnotations.getAnnotation(annotationId);
    if (existingAnnotation !== undefined) {
        if (existingAnnotation.trash === true) SemAnnotations.resurrectAnnotation(annotationId, annotationData);
        else alert(`Semantic annotation id conflict ${annotationId}`);
        return;
    }

    const annotation = SemAnnotations.normalizeAnnotation(annotationData);
    SemAnnotations.semMap.set(annotationId, annotation);
    SemAnnotations.clearTempAnnotationSem();
    SemAnnotations.addAnnotationSem(annotationId);
    THOTH.FE.addSemAnnotation(annotationId);
};

SemAnnotations.updateAnnotation = (annotationId, data) => {
    if (annotationId === undefined || !data) return;

    const annotationKey = SemAnnotations.getAnnotationKey(annotationId);
    const annotation = SemAnnotations.semMap.get(annotationKey);
    if (!annotation) return;

    const normalized = SemAnnotations.normalizeAnnotation({
        ...annotation,
        ...data
    });

    Object.assign(annotation, normalized);
    if (data.point) annotation.point = SemAnnotations.normalizePoint(data.point);
    SemAnnotations._syncAnnotationPointCoordinates(annotation);

    SemAnnotations.updateAnnotationSem(annotationKey);

    const controller = THOTH.FE.semMap.get(annotationKey);
    if (controller?.nameBtn) {
        controller.nameBtn.textContent = annotation.name;
    }

    THOTH.FE.toggleControllerVisibility(controller, annotation.visible);
};

SemAnnotations.deleteAnnotation = (annotationId) => {
    if (annotationId === undefined) return;

    const annotationKey = SemAnnotations.getAnnotationKey(annotationId);
    const annotation = SemAnnotations.semMap.get(annotationKey);
    if (!annotation) return;

    if (THOTH.Annotations?.isActive?.("semantic_annotations", annotationKey, annotation.model_id)) {
        THOTH.Annotations.clearActive();
    }

    annotation.trash = true;
    SemAnnotations.hideAnnotation(annotationKey);
    THOTH.FE.deleteSemAnnotation(annotationKey);
};

SemAnnotations.resurrectAnnotation = (annotationId, annotationData) => {
    if (annotationId === undefined) return;

    const annotationKey = SemAnnotations.getAnnotationKey(annotationId);
    const annotation = SemAnnotations.semMap.get(annotationKey);
    if (!annotation) return;

    Object.assign(annotation, SemAnnotations.normalizeAnnotation(annotationData));
    annotation.trash = false;
    annotation.visible = annotation.visible !== false;

    SemAnnotations.updateAnnotationSem(annotationKey);
    THOTH.FE.addSemAnnotation(annotationKey);
};


// Visibility

SemAnnotations.hideAnnotation = (annotationId) => {
    const annotationKey = SemAnnotations.getAnnotationKey(annotationId);
    const annotation = SemAnnotations.semMap.get(annotationKey);
    const node = SemAnnotations.semNodeMap.get(annotationKey);
    if (!annotation || !node) return;

    annotation.visible = false;
    node.hide();
};

SemAnnotations.showAnnotation = (annotationId) => {
    const annotationKey = SemAnnotations.getAnnotationKey(annotationId);
    const annotation = SemAnnotations.semMap.get(annotationKey);
    const node = SemAnnotations.semNodeMap.get(annotationKey);
    if (!annotation || !node) return;

    annotation.visible = true;
    node.show();
};

SemAnnotations.toggleVisibility = (annotationId) => {
    const annotationKey = SemAnnotations.getAnnotationKey(annotationId);
    const annotation = SemAnnotations.semMap.get(annotationKey);
    const node = SemAnnotations.semNodeMap.get(annotationKey);
    if (!annotation || !node) return;

    if (annotation.visible !== false) SemAnnotations.hideAnnotation(annotationKey);
    else SemAnnotations.showAnnotation(annotationKey);

    THOTH.FE.toggleControllerVisibility(
        THOTH.FE.semMap.get(annotationKey),
        annotation.visible
    );
};

SemAnnotations.clearAnnotationHighlight = (clearUI = true) => {
    if (SemAnnotations.currentAnnotation != null) {
        const prevNode = SemAnnotations.semNodeMap?.get(SemAnnotations.currentAnnotation);
        if (prevNode) {
            prevNode.traverse(child => {
                if (child.userData?.thothMarker === "semantic-point") {
                    if (child.userData.defaultColor) child.material.color.copy(child.userData.defaultColor);
                    else child.material.color.set(SemAnnotations.defaultPointColor);
                }
            });
        }
    }

    SemAnnotations.currentAnnotation = null;
    if (clearUI) {
        THOTH.FE?.handleElementHighlight(null, THOTH.FE?.semMap);
    }
};

SemAnnotations.clearHighlight = (clearUI = true) => {
    if (THOTH.Annotations?.getActive?.()?.modality === "semantic_annotations") {
        THOTH.Annotations.clearActive({
            refreshSceneTree: clearUI
        });
        return;
    }

    SemAnnotations.clearAnnotationHighlight(clearUI);
};

SemAnnotations.applyAnnotationHighlight = (annotationId) => {
    SemAnnotations.clearAnnotationHighlight(false);

    const annotationKey = SemAnnotations.getAnnotationKey(annotationId);
    SemAnnotations.currentAnnotation = annotationKey;

    const node = SemAnnotations.semNodeMap.get(annotationKey);
    if (!node) return;

    node.traverse(child => {
        if (child.userData?.thothMarker === "semantic-point") {
            child.material.color.set(SemAnnotations.selectedPointColor);
        }
    });
};

SemAnnotations.highlightAnnotation = (annotationId) => {
    if (THOTH.Annotations?.select) {
        return THOTH.Annotations.select("semantic_annotations", annotationId);
    }

    SemAnnotations.applyAnnotationHighlight(annotationId);
    return true;
};


// Export

SemAnnotations.getExportData = () => {
    const annotationObjects = {};

    for (const [id, annotation] of SemAnnotations.semMap.entries()) {
        if (!annotation || annotation.trash === true) continue;
        annotationObjects[id] = SemAnnotations.toCanonicalAnnotation(id, annotation);
    }

    return annotationObjects;
};


// Activation

SemAnnotations.activate = () => {
    THOTH.Toolbox.deactivate();
    THOTH.MSR.deactivate();
    SemAnnotations.enabled = true;
};

SemAnnotations.deactivate = () => {
    SemAnnotations.enabled = false;
    SemAnnotations.clearTempAnnotationSem();
};

SemAnnotations.pause = () => SemAnnotations.paused = true;
SemAnnotations.resume = () => SemAnnotations.paused = false;


export default SemAnnotations
