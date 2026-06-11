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
    SemAnnotations.tempNode = null;

    SemAnnotations.enabled = false;
    SemAnnotations.paused  = false;

    SemAnnotations.labelScaleFactor = 0.05;
    SemAnnotations.lastSceneScale   = null;
    SemAnnotations.isSceneLoading   = true;

    ATON.on("SceneJSONLoaded", () => {
        SemAnnotations.isSceneLoading = true;
        SemAnnotations.refreshAnnotationVisibility();
    });

    ATON.on("AllNodeRequestsCompleted", () => {
        SemAnnotations.isSceneLoading = false;
        SemAnnotations.refreshAnnotationVisibility();
    });
};


SemAnnotations.parseAnnotations = (annotations) => {
    if (annotations === undefined) return;

    for (const id in annotations) {
        const annotation = SemAnnotations.normalizeAnnotation(annotations[id]);
        SemAnnotations.semMap.set(Number(id), annotation);
        THOTH.FE.addSemAnnotation(Number(id));
        SemAnnotations.addAnnotationSem(Number(id));
    }
};


// Utils

SemAnnotations.cloneAnnotation = (annotation) => {
    if (!annotation) return annotation;

    return structuredClone(annotation);
};

SemAnnotations.normalizeAnnotation = (annotation) => {
    if (!annotation) return annotation;

    if (annotation.point) {
        annotation.point = SemAnnotations.normalizePoint(annotation.point);
    }

    if (annotation.visible === undefined) annotation.visible = true;
    if (annotation.trash === undefined) annotation.trash = false;
    if (annotation.description === undefined) annotation.description = "";

    return annotation;
};

SemAnnotations.normalizePoint = (point) => {
    if (!point) return point;

    if (!point.meshId && point.mesh) {
        const meshId = THOTH.Models?.getParent(point.mesh) ?? point.mesh.name;
        point.meshId = meshId;
        point.meshName = point.mesh.name;
        delete point.mesh;
    }

    return point;
};

SemAnnotations.getPointModel = (point) => {
    if (!point?.meshId) return null;
    return THOTH.Models?.modelMap?.get(point.meshId) ?? null;
};

SemAnnotations.getPointMesh = (point) => {
    if (!point) return null;
    if (point.mesh) return point.mesh;

    const model = SemAnnotations.getPointModel(point);
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

SemAnnotations.refreshAnnotationVisibility = () => {
    for (const [id, annotation] of SemAnnotations.semMap.entries()) {
        const node = SemAnnotations.semNodeMap.get(id);
        if (!node || !annotation) continue;

        const shouldShow = !SemAnnotations.isSceneLoading && annotation.trash !== true && annotation.visible !== false;
        if (shouldShow) node.show();
        else node.hide();
    }
};


// Geometries

SemAnnotations.createAnnotationNodes = () => {
    const nodes = new ATON.Node("semanticAnnotations", ATON.NTYPES.UI);
    ATON._mainRoot.add(nodes);
    return nodes;
};

SemAnnotations.createPointFromHit = () => {
    if (!ATON._hitsScene || ATON._hitsScene.length === 0) return null;

    const hit    = ATON._hitsScene[0];
    const mesh   = hit.object;
    const meshId = THOTH.Models?.getParent(mesh) ?? mesh.name;

    return {
        meshId  : meshId,
        meshName: mesh.name,
        faceId  : hit.faceIndex,
        coords  : hit.point
    };
};

SemAnnotations.createPointSem = (point) => {
    const model = SemAnnotations.getPointModel(point) ?? SemAnnotations.getPointMesh(point);
    const modelScale = model ? THOTH.Utils.getModelScale(model) : 1;
    const s = modelScale * 0.01;

    const geometry = new THREE.SphereGeometry(1, 16, 12);
    const material = ATON.MatHub.getMaterial("measurement");
    const pointSem = new THREE.Mesh(geometry, material);

    pointSem.renderOrder = ATON.RO_SUI;
    pointSem.position.copy(point.coords);
    pointSem.scale.set(s, s, s);

    return pointSem;
};

SemAnnotations.createLabelSem = (annotationId) => {
    const annotation = SemAnnotations.semMap.get(annotationId);
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
    SemAnnotations.nodes.add(SemAnnotations.tempNode);
};

SemAnnotations.clearTempAnnotationSem = () => {
    if (!SemAnnotations.tempNode) return;

    SemAnnotations.nodes.remove(SemAnnotations.tempNode);
    SemAnnotations.tempNode = null;
};

SemAnnotations.addAnnotationSem = (annotationId) => {
    if (annotationId === undefined) return;

    const annotation = SemAnnotations.semMap.get(annotationId);
    if (!annotation) return;

    const oldNode = SemAnnotations.semNodeMap.get(annotationId);
    if (oldNode?.parent) oldNode.parent.remove(oldNode);

    const pointSem = SemAnnotations.createPointSem(annotation.point);
    const label    = SemAnnotations.createLabelSem(annotationId);
    const node     = new ATON.Node(`semanticAnnotation${annotationId}`, ATON.NTYPES.UI);

    node.add(pointSem);
    node.add(label);
    node.setPickable(true);
    node.setOnSelect(() => THOTH.UI.modalSemAnnotationDetails(annotationId));

    SemAnnotations.semNodeMap.set(annotationId, node);
    node.attachTo(SemAnnotations.nodes);

    SemAnnotations.refreshAnnotationVisibility();
    return node;
};

SemAnnotations.updateAnnotationSem = (annotationId) => {
    SemAnnotations.addAnnotationSem(annotationId);
};


// Management

SemAnnotations.createAnnotationData = (annotationId, point, data = {}) => {
    return {
        id         : annotationId,
        name       : data.name || `Semantic ${annotationId}`,
        description: data.description || "",
        point      : SemAnnotations.normalizePoint(point),
        visible    : data.visible !== false,
        trash      : false
    };
};

SemAnnotations.addAnnotation = (annotationId, annotationData) => {
    if (annotationId === undefined || !annotationData) return;

    const existingAnnotation = SemAnnotations.semMap.get(annotationId);
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

    const annotation = SemAnnotations.semMap.get(annotationId);
    if (!annotation) return;

    annotation.name        = data.name;
    annotation.description = data.description;
    if (data.point) annotation.point = SemAnnotations.normalizePoint(data.point);

    if (data.visible !== undefined) annotation.visible = data.visible;

    SemAnnotations.updateAnnotationSem(annotationId);

    const controller = THOTH.FE.semMap.get(annotationId);
    if (controller?.nameBtn) {
        controller.nameBtn.textContent = annotation.name;
    }

    THOTH.FE.toggleControllerVisibility(controller, annotation.visible);
};

SemAnnotations.deleteAnnotation = (annotationId) => {
    if (annotationId === undefined) return;

    const annotation = SemAnnotations.semMap.get(annotationId);
    if (!annotation) return;

    annotation.trash = true;
    SemAnnotations.hideAnnotation(annotationId);
    THOTH.FE.deleteSemAnnotation(annotationId);
};

SemAnnotations.resurrectAnnotation = (annotationId, annotationData) => {
    if (annotationId === undefined) return;

    const annotation = SemAnnotations.semMap.get(annotationId);
    if (!annotation) return;

    Object.assign(annotation, SemAnnotations.normalizeAnnotation(annotationData));
    annotation.trash = false;
    annotation.visible = annotation.visible !== false;

    SemAnnotations.updateAnnotationSem(annotationId);
    THOTH.FE.addSemAnnotation(annotationId);
};


// Visibility

SemAnnotations.hideAnnotation = (annotationId) => {
    const annotation = SemAnnotations.semMap.get(annotationId);
    const node = SemAnnotations.semNodeMap.get(annotationId);
    if (!annotation || !node) return;

    annotation.visible = false;
    node.hide();
};

SemAnnotations.showAnnotation = (annotationId) => {
    const annotation = SemAnnotations.semMap.get(annotationId);
    const node = SemAnnotations.semNodeMap.get(annotationId);
    if (!annotation || !node) return;

    annotation.visible = true;
    node.show();
};

SemAnnotations.toggleVisibility = (annotationId) => {
    const annotation = SemAnnotations.semMap.get(annotationId);
    const node = SemAnnotations.semNodeMap.get(annotationId);
    if (!annotation || !node) return;

    if (annotation.visible !== false) SemAnnotations.hideAnnotation(annotationId);
    else SemAnnotations.showAnnotation(annotationId);

    THOTH.FE.toggleControllerVisibility(
        THOTH.FE.semMap.get(annotationId),
        annotation.visible
    );
};


// Export

SemAnnotations.getExportData = () => {
    const annotationObjects = {};

    for (const [id, annotation] of SemAnnotations.semMap.entries()) {
        if (!annotation || annotation.trash === true) continue;
        annotationObjects[id] = annotation;
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
