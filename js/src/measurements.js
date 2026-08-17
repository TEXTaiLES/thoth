/*===========================================================================

    THOTH
    Measurement functionalities

    Authors: 
        Stelios Alvanos (steliosalvanos@gmail.com)
        Apostolos Kastritsis

===========================================================================*/
import Label from "./measurements.label.js"

let MSR = {};



// Setup

MSR.setup = () => {
    // Create measurement map for easy access
    MSR.msrMap    = new Map();
    MSR.msrSemMap = new Map();

    MSR.line  = MSR.createMeasurementLine();
    MSR.nodes = MSR.createMeasurementNodes();
    MSR.modelNodeMap = new Map();

    MSR.tempNode = null;
    MSR.points   = [];

    MSR.enabled = false;
    MSR.paused  = false;

    MSR.meshCache = new WeakMap();  //cache meshes
    MSR.pathCache = new WeakMap();  //cache paths
    MSR.exactMeshLoads = new WeakMap();

    MSR.labelScaleFactor = 0.05;
    MSR.lastSceneScale = null;
    MSR.isSceneLoading = true;

    // MSR.distanceType = MSR.distanceType || "euclidean";
    MSR.distanceType = "euclidean";//default
    MSR.lastMeasurementId = null;
    MSR.lastMeasurementPoints = null;
    MSR.currentMeasurementLine =null;
    MSR.defaultEuclideanLineColor  = 0xffffff; //white
    MSR.defaultGeodesicLineColor  = 0xffffff; // white
    MSR.defaultPointColor = 0xffffff;
    MSR.selectedLineColor = 0xff0000;//red
    //MSR.selectedLineColor = 0xffff00; // highlight color (yellow)
    //0xff0000 red
    //MSR.lastMeasurementPoints = [];

    ATON.on("SceneJSONLoaded", () => {
        MSR.isSceneLoading = true;
        MSR.refreshMeasurementVisibility();
    });

    ATON.on("AllNodeRequestsCompleted", () => {
        MSR.isSceneLoading = false;
        MSR.refreshMarkerScales();
        MSR.refreshMeasurementVisibility();
    });
};


MSR.parseMeasurements = (measurements, modelId) => {
    if (measurements === undefined) return;

    for (const id in measurements) {
        const measurement = MSR.normalizeMeasurement(id, {
            ...measurements[id],
            model_id: modelId ?? measurements[id]?.model_id
        });
        if (measurement?.points?.length) {
            measurement.points = measurement.points.map(MSR.normalizePoint);
        }
        MSR.msrMap.set(id, measurement);
        THOTH.SceneStore?.setModelCollectionItem?.(
            measurement.model_id,
            "measurements",
            id,
            MSR.toCanonicalMeasurement(id, measurement)
        );
        THOTH.FE.addMsr(id);
        MSR.addMeasurementSem(id);
    }
};


// UTILS

MSR.getLabelScale = () => {
    const sceneScale = THOTH.sceneScale;
    if (!Number.isFinite(sceneScale)) return null;
    return sceneScale * MSR.labelScaleFactor;
};

MSR.applyLabelScale = (label) => {
    if (!label) return;
    const scale = MSR.getLabelScale();
    if (scale === null) {
        label.setScale(0);
        label.setOpacity(0);
        return;
    }
    label.setScale(scale);
    label.setOpacity(1);
};

MSR.refreshLabelScales = () => {
    const sceneScale = THOTH.sceneScale;
    if (!Number.isFinite(sceneScale)) return;
    if (MSR.lastSceneScale === sceneScale) return;
    MSR.lastSceneScale = sceneScale;

    for (const node of MSR.msrSemMap.values()) {
        const label = node.children.find(child => child instanceof Label);
        if (label) MSR.applyLabelScale(label);
    }
};

MSR.getPointMarkerScale = (point) => {
    const model = MSR.getPointModel(point) ?? MSR.getPointMesh(point);
    let modelScale = model ? THOTH.Utils.getModelScale(model) : THOTH.sceneScale;

    if (!Number.isFinite(modelScale) || modelScale <= 0) {
        modelScale = Number.isFinite(THOTH.sceneScale) && THOTH.sceneScale > 0
            ? THOTH.sceneScale
            : 1;
    }

    return modelScale * 0.01;
};

MSR.applyPointMarkerScale = (marker, point) => {
    if (!marker || !point) return;

    const scale = MSR.getPointMarkerScale(point);
    marker.scale.set(scale, scale, scale);
};

MSR.refreshMarkerScales = () => {
    for (const [measurementId, node] of MSR.msrSemMap.entries()) {
        const measurement = MSR.msrMap.get(measurementId);
        if (!node || !measurement?.points) continue;

        const markers = node.children.filter(child => child.isMesh);
        MSR.applyPointMarkerScale(markers[0], measurement.points[0]);
        MSR.applyPointMarkerScale(markers[1], measurement.points[1]);
    }
};

MSR.refreshMeasurementVisibility = () => {
    for (const [id, measurement] of MSR.msrMap.entries()) {
        const node = MSR.msrSemMap.get(id);
        if (!node || !measurement) continue;

        const shouldShow = !MSR.isSceneLoading && measurement.trash !== true && measurement.visible !== false;
        if (shouldShow) node.show();
        else node.hide();
    }
};

MSR.normalizePoint = (point) => {
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

MSR.toCanonicalPoint = (point) => {
    const normalized = MSR.normalizePoint(point);
    const coords = normalized?.coords || normalized || {};

    return {
        x      : Number(coords.x ?? 0),
        y      : Number(coords.y ?? 0),
        z      : Number(coords.z ?? 0),
        face_id: normalized?.faceId ?? normalized?.face_id ?? null
    };
};

MSR.fromCanonicalPoint = (point, modelId) => {
    if (!point) return undefined;

    return MSR.normalizePoint({
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

MSR.toCanonicalMeasurement = (measurementId, data = {}) => {
    let points = data.points;
    if (!points?.length) points = [data.point1, data.point2].filter(Boolean);
    if (!points?.length) {
        points = [
            MSR.fromCanonicalPoint(data.annotation?.point1, data.model_id),
            MSR.fromCanonicalPoint(data.annotation?.point2, data.model_id)
        ].filter(Boolean);
    }

    const point1 = points[0] || MSR.fromCanonicalPoint(data.annotation?.point1, data.model_id);
    const point2 = points[1] || MSR.fromCanonicalPoint(data.annotation?.point2, data.model_id);
    const distanceType = data.distanceType ||
        data.distance_type ||
        data.annotation?.distance_type ||
        data.annotation?.distanceType ||
        "euclidean";
    const distance = Number(data.distance ?? data.annotation?.distance ?? 0);

    return THOTH.Annotations?.createBaseAnnotation(measurementId, {
        ...data,
        id        : data.id ?? measurementId,
        annotation: {
            ...(data.annotation || {}),
            coordinate_space: "model_local",
            distance        : distance,
            distance_type   : distanceType,
            point1          : MSR.toCanonicalPoint(point1),
            point2          : MSR.toCanonicalPoint(point2)
        }
    }) || {
        id        : data.id ?? measurementId,
        annotation: {
            coordinate_space: "model_local",
            distance        : distance,
            distance_type   : distanceType,
            point1          : MSR.toCanonicalPoint(point1),
            point2          : MSR.toCanonicalPoint(point2)
        },
        visible: data.visible !== false
    };
};

MSR.normalizeMeasurement = (measurementId, data = {}) => {
    const annotation = data.annotation || {};
    const coordinateSpace = data.coordinate_space || annotation.coordinate_space;
    const shouldConvertLegacy = coordinateSpace !== "model_local" &&
        !data.points &&
        !data.point1 &&
        !data.point2 &&
        (annotation.point1 || annotation.point2);
    let point1 = data.point1 || MSR.fromCanonicalPoint(annotation.point1, data.model_id);
    let point2 = data.point2 || MSR.fromCanonicalPoint(annotation.point2, data.model_id);
    let points = data.points || [point1, point2].filter(Boolean);
    let path = data.path;

    if (shouldConvertLegacy) {
        points = points.map(point => MSR.pointWorldToModelLocal(data.model_id, point));
        point1 = points[0];
        point2 = points[1];
        if (Array.isArray(path)) {
            path = path.map(point => MSR.worldToModelLocal(data.model_id, point));
        }
    }
    const distanceType = data.distanceType ||
        data.distance_type ||
        annotation.distance_type ||
        annotation.distanceType ||
        "euclidean";
    const distance = Number(data.distance ?? annotation.distance ?? 0);
    const canonical = MSR.toCanonicalMeasurement(measurementId, {
        ...data,
        distance,
        distanceType,
        points
    });

    const base = THOTH.Annotations?.createBaseAnnotation(measurementId, canonical) || {
        id                            : measurementId,
        name                          : data.name || "",
        description                   : data.description || "",
        related_rgb_images            : data.related_rgb_images || [],
        related_multispectral_images  : data.related_multispectral_images || [],
        related_artefacts             : data.related_artefacts || [],
        annotation                    : canonical.annotation || {},
        visible                       : data.visible !== false
    };

    return {
        ...base,
        model_id    : data.model_id,
        name        : base.name || `Measurement ${measurementId}`,
        distanceType: distanceType,
        distance    : distance,
        points      : points.map(MSR.normalizePoint),
        path        : path,
        trash       : data.trash === true
    };
};

MSR.getMeasurementKey = (measurementId) => {
    if (MSR.msrMap.has(measurementId)) return measurementId;

    for (const key of MSR.msrMap.keys()) {
        if (String(key) === String(measurementId)) return key;
    }

    return measurementId;
};

MSR.getMeasurement = (measurementId) => {
    return MSR.msrMap.get(MSR.getMeasurementKey(measurementId));
};

MSR._syncMeasurementPointCoordinates = (measurement) => {
    if (!measurement?.points?.length) return;

    measurement.points = measurement.points.map(MSR.normalizePoint);
    measurement.annotation = {
        ...(measurement.annotation || {}),
        coordinate_space: "model_local",
        distance        : Number(measurement.distance ?? measurement.annotation?.distance ?? 0),
        distance_type   : measurement.distanceType || measurement.annotation?.distance_type || "euclidean",
        point1          : MSR.toCanonicalPoint(measurement.points[0]),
        point2          : MSR.toCanonicalPoint(measurement.points[1])
    };
};

MSR.getModelNode = (modelId, create = false) => {
    if (!modelId) return null;

    return THOTH.Models?.modelMap?.get(modelId) ||
        ATON.getSceneNode?.(modelId) ||
        (create ? ATON.getOrCreateSceneNode?.(modelId) : null);
};

MSR._coordsToVector3 = (coords) => {
    if (coords instanceof THREE.Vector3) return coords.clone();

    return new THREE.Vector3(
        Number(coords?.x ?? coords?.[0] ?? 0),
        Number(coords?.y ?? coords?.[1] ?? 0),
        Number(coords?.z ?? coords?.[2] ?? 0)
    );
};

MSR.worldToModelLocal = (modelId, coords) => {
    const model = MSR.getModelNode(modelId);
    const point = MSR._coordsToVector3(coords);
    if (!model) return point;

    model.updateMatrixWorld(true);
    return model.worldToLocal(point);
};

MSR.modelLocalToWorld = (modelId, coords) => {
    const model = MSR.getModelNode(modelId);
    const point = MSR._coordsToVector3(coords);
    if (!model) return point;

    model.updateMatrixWorld(true);
    return model.localToWorld(point);
};

MSR.pointWorldToModelLocal = (modelId, point) => {
    if (!point) return point;

    const normalized = MSR.normalizePoint(point);
    return {
        ...normalized,
        coords: MSR.worldToModelLocal(modelId || MSR.getPointModelId(normalized), normalized.coords)
    };
};

MSR.getPointModel = (point) => {
    if (!point?.meshId) return null;
    return THOTH.Models?.modelMap?.get(point.meshId) ?? null;
};

MSR.getPointModelId = (point) => {
    if (!point) return undefined;
    if (point.meshId) return point.meshId;
    if (point.mesh) return THOTH.Models?.getParent(point.mesh) ?? point.mesh.name;

    return undefined;
};

MSR.getPointMesh = (point) => {
    if (!point) return null;
    if (point.mesh) return point.mesh;

    const model = MSR.getPointModel(point);
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


// Geometries

MSR.createMeasurementLine = () => {
    const line_ = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    //const mline = new THREE.Line(line_, ATON.MatHub.getMaterial("measurement"));
    const baseMat = ATON.MatHub.getMaterial("measurement");
    const mat = baseMat.clone(); 
    const mline = new THREE.Line(line_, mat);   
    mline.renderOrder = ATON.RO_SUI;
    mline.visible     = false;

    ATON._rootUI.add(mline);

    return mline;
};

MSR.createMeasurementNodes = () => {
    return new Map();
};

MSR.getModelMeasurementNode = (modelId) => {
    if (!modelId) return null;
    if (MSR.modelNodeMap.has(modelId)) {
        const node = MSR.modelNodeMap.get(modelId);
        if (node?.parent) return node;

        MSR.modelNodeMap.delete(modelId);
        MSR.nodes.delete(modelId);
    }

    const model = MSR.getModelNode(modelId, true);
    if (!model) return null;

    const node = new ATON.Node(`measurements_${modelId}`, ATON.NTYPES.UI);
    node.attachTo(model);
    MSR.modelNodeMap.set(modelId, node);
    MSR.nodes.set(modelId, node);

    return node;
};


//  Management

MSR.addMeasurementPoint = () => {
    // Get face id from ATON
    if (!ATON._hitsScene || ATON._hitsScene.length === 0) return undefined;
    const hit    = ATON._hitsScene[0];
    const idx    = hit.faceIndex;
    const mesh   = hit.object;
    // const mesh   = THOTH.hoveredMesh;

    const meshId = THOTH.Models?.getParent(mesh) ?? mesh.name;
    const coords = MSR.worldToModelLocal(meshId, hit.point);

    const mPoint = {
        "meshId" : meshId,
        "meshName": mesh.name,
        "faceId"  : idx,
        "coords"  : coords
    };

    if (MSR.points.length === 1 && MSR.getPointModelId(MSR.points[0]) !== meshId) {
        THOTH.FE.showToast("Measurements cannot span different models.");
        return undefined;
    }

    MSR.points.push(mPoint);
    MSR.addMeasurementPointSem(mPoint);

    if (MSR.points.length === 2) {
        THOTH.fire("createMeasurement");
        MSR.clearMeasurementPoints();
    }
};

MSR.createMeasurementData = (measurementId, point1, point2, options = {}) => {
    const distanceType = options.distanceType || options.annotation?.distance_type;
    if (!distanceType) {
        console.warn("Missing distanceType", options);
        return;
    }

    if (distanceType === "euclidean") {
        return MSR.normalizeMeasurement(measurementId, {
            description : options.description || "",
            distanceType: distanceType,
            distance    : MSR.getEuclideanDistance(point1, point2),
            points      : [point1, point2],
            model_id    : options.model_id,
            trash       : false,
            name        : options.name || `Measurement ${measurementId}`,
            visible     : true
        });
    }

    if (distanceType !== "geodesic" && distanceType !== "geodesicExact") {
        console.warn("Unsupported distanceType", distanceType);
        return;
    }

    // Collaboration, undo/redo, and scene loading already carry a computed path.
    if (Array.isArray(options.path)) {
        return MSR.normalizeMeasurement(measurementId, {
            description : options.description || "",
            distanceType: distanceType,
            distance    : options.distance,
            points      : [point1, point2],
            model_id    : options.model_id,
            path        : options.path.map(point => MSR._coordsToVector3(point)),
            trash       : false,
            name        : options.name || `Measurement ${measurementId}`,
            visible     : true
        });
    }

    // New exact measurements are asynchronous and are created by
    // createExactGeodesicMeasurement().
    if (distanceType === "geodesicExact") return;

    const mesh = MSR.getPointMesh(point1);
    const secondMesh = MSR.getPointMesh(point2);
    if (!mesh || !secondMesh) {
        THOTH.FE.showToast("Invalid mesh for geodesic");
        return;
    }
    if (mesh !== secondMesh) {
        THOTH.FE.showToast("Geodesic requires both points on same mesh");
        return;
    }

    const { vertices } = MSR.buildMeshGraph(mesh);
    const modelId = options.model_id || MSR.getPointModelId(point1);
    const startWorldPoint = MSR.modelLocalToWorld(modelId, point1.coords);
    const endWorldPoint = MSR.modelLocalToWorld(modelId, point2.coords);
    const startVertex = MSR.getNearestVertexIndex(mesh, startWorldPoint);
    const endVertex = MSR.getNearestVertexIndex(mesh, endWorldPoint);
    if (startVertex === -1 || endVertex === -1) {
        THOTH.FE.showToast("Invalid vertex indices");
        return;
    }

    const path = MSR.getGeodesicPath(mesh, startVertex, endVertex);
    if (!path?.length) {
        THOTH.FE.showToast("Geodesic path not found!");
        return;
    }

    const worldPoints = MSR.pathToPoints(mesh, path);
    return MSR.normalizeMeasurement(measurementId, {
        description : options.description || "",
        distanceType: distanceType,
        distance    : MSR.computePathLength(vertices, path),
        points      : [point1, point2],
        model_id    : options.model_id,
        path        : worldPoints.map(point => MSR.worldToModelLocal(modelId, point)),
        trash       : false,
        name        : options.name || `Measurement ${measurementId}`,
        visible     : true
    });
};

MSR.addMeasurement = (measurementId, point1, point2,  options = {}) => {
    if (measurementId === undefined) return;
    if (point1 === undefined || point2 === undefined) return;

    const measurement = MSR.getMeasurement(measurementId);

    // Resolve id conflict
    if (measurement !== undefined) {
        if (measurement.trash === true) MSR.resurrectMeasurement(measurementId);
        else alert(`Measurement id conflict ${measurementId}`);

        return;
    }

    const measurementData = MSR.createMeasurementData(measurementId, point1, point2, options);
    if (!measurementData) return;

    // Append to Map
    MSR.msrMap.set(measurementId, measurementData);

    // Update SUI
    MSR.addMeasurementSem(measurementId);

    // Update FE
    THOTH.FE.addMsr(measurementId);

    // store last measurement for recompute
    MSR.lastMeasurementId = measurementId;
    MSR.lastMeasurementPoints = [point1, point2];
};
MSR.deleteMeasurement = (measurementId) => {
    if (measurementId === undefined) return;

    const measurementKey = MSR.getMeasurementKey(measurementId);
    const measurement = MSR.msrMap.get(measurementKey);
    if (!measurement) return;
    if (THOTH.Annotations?.isActive?.("measurements", measurementKey, measurement.model_id)) {
        THOTH.Annotations.clearActive();
    }
    measurement.trash = true;
    MSR.hideMeasurement(measurementKey);

    // Update FE
    THOTH.FE.deleteMsr(measurementKey);
};

MSR.updateMeasurement = (measurementId, data) => {
    if (measurementId === undefined || !data) return;

    const measurementKey = MSR.getMeasurementKey(measurementId);
    const measurement = MSR.msrMap.get(measurementKey);
    if (!measurement) return;

    const nextMeasurement = MSR.normalizeMeasurement(measurementKey, {
        ...measurement,
        ...data
    });

    MSR.msrMap.set(measurementKey, nextMeasurement);
    MSR._syncMeasurementPointCoordinates(nextMeasurement);
    MSR.renameMeasurement(measurementKey, nextMeasurement.name);
    MSR.refreshMeasurementVisibility();
    THOTH.FE.toggleControllerVisibility(
        THOTH.FE.msrMap.get(measurementKey),
        nextMeasurement.visible !== false
    );
};

MSR.resurrectMeasurement = (measurementId) => {
    if (measurementId === undefined) return;

    const measurementKey = MSR.getMeasurementKey(measurementId);
    const measurement = MSR.msrMap.get(measurementKey);
    if (!measurement.trash) return;

    measurement.trash = false;
    //MSR.removeMeasurementSem(measurementId);
   // MSR.addMeasurement(measurementId);
    MSR.showMeasurement(measurementKey);
    measurement.visible=true;
    
    // Update FE
    THOTH.FE.addMsr(measurementKey);
};

MSR.updateMeasurementLabel = (measurementId, distance) => {
    const measurementKey = MSR.getMeasurementKey(measurementId);
    const node = MSR.msrSemMap.get(measurementKey);
    if (!node) return;

    const label = node.children.find(child => child instanceof Label);
    if (!label) {
        console.warn("Label not found for measurement", measurementKey);
        return;
    }

    label.setText(distance.toFixed(2));
};

MSR.getExactGeodesicMeshData = (mesh, modelId, tolerance = 1e-5) => {
    const position = mesh?.geometry?.getAttribute?.("position");
    if (!position || position.itemSize < 3 || position.count < 3) {
        throw new Error("Exact geodesic requires a triangular position geometry.");
    }

    const geometryIndex = mesh.geometry.getIndex?.();
    const indexCount = geometryIndex?.count ?? position.count;
    if (indexCount < 3 || indexCount % 3 !== 0) {
        throw new Error("Exact geodesic requires a triangle index count divisible by three.");
    }

    const vertices = [];
    const faces = [];
    const weldedVertices = new Map();
    const triangles = new Set();
    const edgeCounts = new Map();
    const model = MSR.getModelNode(modelId);
    mesh.updateMatrixWorld(true);
    model?.updateMatrixWorld?.(true);
    const meshToModel = model
        ? model.matrixWorld.clone().invert().multiply(mesh.matrixWorld)
        : mesh.matrixWorld.clone();
    const transformedPosition = new THREE.Vector3();

    const getSourceIndex = offset => geometryIndex ? geometryIndex.getX(offset) : offset;
    const getWeldedIndex = sourceIndex => {
        transformedPosition.fromBufferAttribute(position, sourceIndex).applyMatrix4(meshToModel);
        const { x, y, z } = transformedPosition;
        if (![x, y, z].every(Number.isFinite)) {
            throw new Error("Exact geodesic mesh contains non-finite vertices.");
        }

        const hash = [x, y, z]
            .map(value => Math.round(value / tolerance))
            .join(":");
        if (weldedVertices.has(hash)) return weldedVertices.get(hash);

        const weldedIndex = vertices.length / 3;
        weldedVertices.set(hash, weldedIndex);
        vertices.push(x, y, z);
        return weldedIndex;
    };
    const addEdge = (first, second) => {
        const key = first < second ? `${first}:${second}` : `${second}:${first}`;
        edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
    };

    for (let offset = 0; offset < indexCount; offset += 3) {
        const first = getWeldedIndex(getSourceIndex(offset));
        const second = getWeldedIndex(getSourceIndex(offset + 1));
        const third = getWeldedIndex(getSourceIndex(offset + 2));
        if (first === second || second === third || first === third) continue;

        const triangleKey = [first, second, third].sort((a, b) => a - b).join(":");
        if (triangles.has(triangleKey)) continue;

        const ax = vertices[first * 3];
        const ay = vertices[first * 3 + 1];
        const az = vertices[first * 3 + 2];
        const abx = vertices[second * 3] - ax;
        const aby = vertices[second * 3 + 1] - ay;
        const abz = vertices[second * 3 + 2] - az;
        const acx = vertices[third * 3] - ax;
        const acy = vertices[third * 3 + 1] - ay;
        const acz = vertices[third * 3 + 2] - az;
        const nx = aby * acz - abz * acy;
        const ny = abz * acx - abx * acz;
        const nz = abx * acy - aby * acx;
        if (nx * nx + ny * ny + nz * nz < 1e-20) continue;

        triangles.add(triangleKey);
        faces.push(first, second, third);
        addEdge(first, second);
        addEdge(second, third);
        addEdge(third, first);
    }

    if (faces.length === 0) throw new Error("Exact geodesic mesh has no valid triangles.");
    for (const count of edgeCounts.values()) {
        if (count > 2) {
            throw new Error("Mesh contains non-manifold edges. Exact geodesic cannot be computed.");
        }
    }

    return { vertices, faces };
};

MSR.getExactGeodesicMeshId = (mesh, modelId) => {
    mesh.userData = mesh.userData || {};
    if (!mesh.userData.thothExactGeodesicId) {
        mesh.userData.thothExactGeodesicId = `${modelId || "model"}:${mesh.uuid || mesh.name || "mesh"}`;
    }
    return mesh.userData.thothExactGeodesicId;
};

MSR.prepareExactGeodesicMesh = (mesh, modelId, force = false) => {
    if (!mesh) return Promise.reject(new Error("Exact geodesic mesh is unavailable."));
    if (force) MSR.exactMeshLoads.delete(mesh);
    if (MSR.exactMeshLoads.has(mesh)) return MSR.exactMeshLoads.get(mesh);

    const loading = (async () => {
        const meshId = MSR.getExactGeodesicMeshId(mesh, modelId);
        const meshData = MSR.getExactGeodesicMeshData(mesh, modelId);
        await THOTH.API.geodesicLoad({
            mesh_id : meshId,
            vertices: meshData.vertices,
            faces   : meshData.faces
        });
        return meshId;
    })();

    MSR.exactMeshLoads.set(mesh, loading);
    loading.catch(() => {
        if (MSR.exactMeshLoads.get(mesh) === loading) MSR.exactMeshLoads.delete(mesh);
    });
    return loading;
};

MSR.createExactGeodesicMeasurement = async (measurementId, point1, point2, options = {}) => {
    const mesh = MSR.getPointMesh(point1);
    const secondMesh = MSR.getPointMesh(point2);
    if (!mesh || mesh !== secondMesh) {
        throw new Error("Exact geodesic requires both points on the same mesh.");
    }

    const modelId = options.model_id || MSR.getPointModelId(point1);
    const firstLocalPoint = MSR._coordsToVector3(point1.coords);
    const secondLocalPoint = MSR._coordsToVector3(point2.coords);
    let meshId = await MSR.prepareExactGeodesicMesh(mesh, modelId);

    const query = () => THOTH.API.geodesicExact({
        mesh_id: meshId,
        x1     : firstLocalPoint.x,
        y1     : firstLocalPoint.y,
        z1     : firstLocalPoint.z,
        x2     : secondLocalPoint.x,
        y2     : secondLocalPoint.y,
        z2     : secondLocalPoint.z
    });

    let result;
    try {
        result = await query();
    }
    catch (error) {
        if (error.code !== "GEODESIC_MESH_NOT_FOUND") throw error;
        meshId = await MSR.prepareExactGeodesicMesh(mesh, modelId, true);
        result = await query();
    }

    if (!Number.isFinite(result.distance) || !Array.isArray(result.path) || result.path.length === 0) {
        throw new Error("Exact geodesic computation returned an invalid path.");
    }

    const modelLocalPath = result.path.map(point => MSR._coordsToVector3(point));

    return MSR.normalizeMeasurement(measurementId, {
        description : options.description || "",
        distanceType: "geodesicExact",
        distance    : result.distance,
        points      : [point1, point2],
        model_id    : modelId,
        path        : modelLocalPath,
        trash       : false,
        name        : options.name || `Measurement ${measurementId}`,
        visible     : true
    });
};


// SUI

MSR.createPointSem = (point) => {
    const material = ATON.MatHub.getMaterial("measurement").clone();
    const pointSem = new THREE.Mesh(ATON.Utils.geomUnitCube, material);

    pointSem.renderOrder = ATON.RO_SUI;
    pointSem.position.copy(point.coords);
    pointSem.userData.thothMarker = "measurement-point";
    pointSem.userData.defaultColor = material.color?.clone() || new THREE.Color(MSR.defaultPointColor);
    MSR.applyPointMarkerScale(pointSem, point);

    return pointSem;
};

MSR.createLineSem = (point1, point2) => {
    let line_ = null;
    if (point1 === undefined || point2 === undefined) {
        line_ = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    }
    else {
        line_ = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(point1.coords.x, point1.coords.y, point1.coords.z),
            new THREE.Vector3(point2.coords.x, point2.coords.y, point2.coords.z)
        ]);
    }
    const baseMat = ATON.MatHub.getMaterial("measurement");
    const mat = baseMat.clone();
    const mline = new THREE.Line(line_,mat);
   // const mline = new THREE.Line(line_, ATON.MatHub.getMaterial("measurement"));

    mline.renderOrder = ATON.RO_SUI;
    mline.visible = true;
    mline.userData.type = "euclidean-measurement-line";

    return mline;
};

MSR.addMeasurementPointSem = (point) => {
    if (point === undefined) return;

    const pointSem = MSR.createPointSem(point);
    const modelNode = MSR.getModelMeasurementNode(MSR.getPointModelId(point));
    if (!modelNode) return;

    if (MSR.tempNode === null) {
        MSR.tempNode = pointSem;
        modelNode.add(MSR.tempNode)
    }
    else {
        if (MSR.tempNode.parent) MSR.tempNode.parent.remove(MSR.tempNode);
        MSR.tempNode = null;
    }
};

MSR.createLabelSem = (measurementId) => {
    if (measurementId === undefined) return;

    const measurement = MSR.getMeasurement(measurementId);

    if (measurement === undefined) return;

    const point1 = measurement.points[0];
    const point2 = measurement.points[1];
    const distance = measurement.distance.toFixed(4);

    const label = new Label("", distance.toString());
    //const label = new Label("", "yo");
    label.setPosition(
        (point1.coords.x + point2.coords.x) * 0.5,
        (point1.coords.y + point2.coords.y) * 0.5,
        (point1.coords.z + point2.coords.z) * 0.5,
    );

    MSR.applyLabelScale(label);
  
    return label;
};

MSR.addMeasurementSem = (measurementId) => {
    if (measurementId === undefined) return;

    const measurementKey = MSR.getMeasurementKey(measurementId);
    const measurement = MSR.msrMap.get(measurementKey);

    if (!measurement) {
        console.warn("Measurement not found in msrMap:", measurementId);
        return;
    }
    if (measurement === undefined) return;
    const modelNode = MSR.getModelMeasurementNode(measurement.model_id || MSR.getPointModelId(measurement.points?.[0]));
    if (!modelNode) return;

    const oldNode = MSR.msrSemMap.get(measurementKey);
    if (oldNode?.parent) oldNode.parent.remove(oldNode);

    // Nodes
    const point1 = measurement.points[0];
    const point2 = measurement.points[1];
    const semPoint1 = MSR.createPointSem(point1);
    const semPoint2 = MSR.createPointSem(point2);

    let line;
    if (measurement.distanceType == "euclidean") {
        // Line
        line = MSR.createLineSem(point1, point2);
     }
    if (measurement.distanceType == "geodesic" || measurement.distanceType == "geodesicExact") {
        line  = MSR.drawGeodesicPath(measurement.path);
    }
    
    // Label
    const label = MSR.createLabelSem(measurementKey);

    // Add to node
    const node = new ATON.Node(`measurement${measurementKey}`, ATON.NTYPES.UI);
    node.add(semPoint1);
    node.add(semPoint2);
    node.add(label);
    node.add(line);
    node.setPickable(true);
    node.setOnHover(() => {
        const hoverScale = MSR.getLabelScale();
        if (hoverScale !== null) {
            label.setScale(hoverScale);
            label.setOpacity(0.8);
        }
        //label.setOpacity(0.0);
    });
    node.setOnSelect(() => {
        THOTH.Annotations?.select?.("measurements", measurementKey);
        THOTH.UI.modalMsrDetails(measurementKey);
    });
    node.setOnLeave(() => {
        //label.setScale(0.0);
       // label.setOpacity(0);
    });

    // Add to map
    MSR.msrSemMap.set(measurementKey, node);

    // Add to SUI
    node.attachTo(modelNode);
    MSR.refreshMarkerScales();
    MSR.refreshMeasurementVisibility();
    return node; //added this
};


// Distance calculation

MSR.getEuclideanDistance = (point1, point2) => {
    if (point1 === undefined || point2 === undefined) return 0;
    const v1 = new THREE.Vector3(
        point1.coords.x,
        point1.coords.y,
        point1.coords.z,
    );
    const v2 = new THREE.Vector3(
        point2.coords.x,
        point2.coords.y,
        point2.coords.z,
    );
    const f = Math.pow(10, 2)
    return Math.round(v1.distanceTo(v2) * f) / f;
};

MSR.clearMeasurementPoints = () => {
    MSR.points = [];
};

//Geodesic distance 

//Build Graph for every mesh just once
MSR.buildMeshGraph = function (mesh) {
    if (MSR.meshCache.has(mesh)) {
        return MSR.meshCache.get(mesh);
    }
    const geometry = mesh.geometry;
    const pos = geometry.attributes.position;
    const index = geometry.index;

    const vertices = [];
    for (let i = 0; i < pos.count; i++) {
        vertices.push(new THREE.Vector3().fromBufferAttribute(pos, i));
    }

    const graph = new Map();

    function addEdge(a, b) {
        const w = vertices[a].distanceTo(vertices[b]);
        graph.get(a).push({ to: b, w });
        graph.get(b).push({ to: a, w });
    }

    for (let i = 0; i < pos.count; i++) {
        graph.set(i, []);
    }

    for (let i = 0; i < index.count; i += 3) {
        const a = index.getX(i);
        const b = index.getX(i + 1);
        const c = index.getX(i + 2);

        addEdge(a, b);
        addEdge(b, c);
        addEdge(c, a);
    }

    const data = { vertices, graph };
    MSR.meshCache.set(mesh, data);
    return data;
};

//Dikjstra with heuristics using euclidian distance

MSR.aStar = function (graph, vertices, start, goal) {
    const open = new Set([start]);
    const cameFrom = new Map();

    const gScore = new Map();
    const fScore = new Map();

    gScore.set(start, 0);
    fScore.set(start, vertices[start].distanceTo(vertices[goal]));

    function lowestFScore() {
        let best = null;
        let bestScore = Infinity;
        for (const n of open) {
            const s = fScore.get(n) ?? Infinity;
            if (s < bestScore) {
                bestScore = s;
                best = n;
            }
        }
        return best;
    }

    while (open.size > 0) {
        const current = lowestFScore();
        if (current === goal) {
            return MSR.reconstructPath(cameFrom, current);
        }

        open.delete(current);

        for (const edge of graph.get(current)) {
            const tentative = gScore.get(current) + edge.w;

            if (tentative < (gScore.get(edge.to) ?? Infinity)) {
                cameFrom.set(edge.to, current);
                gScore.set(edge.to, tentative);
                fScore.set(
                    edge.to,
                    tentative + vertices[edge.to].distanceTo(vertices[goal])
                );
                open.add(edge.to);
            }
        }
    }

    return null;
};

MSR.reconstructPath = function (cameFrom, current) {
    const path = [current];
    while (cameFrom.has(current)) {
        current = cameFrom.get(current);
        path.push(current);
    }
    return path.reverse();
};

//get cached geodesic path per mesh
MSR.getGeodesicPath = function (mesh, startVertex, endVertex) {
    let meshPaths = MSR.pathCache.get(mesh);
    if (!meshPaths) {
        meshPaths = new Map();
        MSR.pathCache.set(mesh, meshPaths);
    }

    const key = `${startVertex}-${endVertex}`;
    if (meshPaths.has(key)) {
        return meshPaths.get(key);
    }

    const { vertices, graph } = MSR.buildMeshGraph(mesh);
    const path = MSR.aStar(graph, vertices, startVertex, endVertex);

    meshPaths.set(key, path);
    return path;
};

//compute distamce from path
MSR.computePathLength = function (vertices, path) {
    let d = 0;
    for (let i = 0; i < path.length - 1; i++) {
        d += vertices[path[i]].distanceTo(vertices[path[i + 1]]);
    }
    return d;
};
//Convert path to world space points
MSR.pathToPoints = function (mesh, path) {
    const pos = mesh.geometry.attributes.position;
    return path.map(i =>
        new THREE.Vector3()
            .fromBufferAttribute(pos, i)
            .applyMatrix4(mesh.matrixWorld)
    );
};
//draw path as line
MSR.drawGeodesicPath = function (points) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
        color: 0xffffff,
        linewidth: 1
    });

    const line = new THREE.Line(geometry, material);
    line.userData.type = "geodesic-measurement-line";
    return line;
};

MSR.getNearestVertexIndex = (mesh, worldPoint) => {
    const pos = mesh.geometry.attributes.position;
    let closest = -1;
    let minDist = Infinity;

    const localPoint = mesh.worldToLocal(worldPoint.clone());

    for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(pos, i);
        const dist = v.distanceToSquared(localPoint);

        if (dist < minDist) {
            minDist = dist;
            closest = i;
        }
    }
    return closest;
};

// Visibility

MSR.hideMeasurement = (measurementId) => {
    if (measurementId === undefined) return;

    const measurementKey = MSR.getMeasurementKey(measurementId);
    const node = MSR.msrSemMap.get(measurementKey);
    const measurement = MSR.msrMap.get(measurementKey);

    if (!node || !measurement) return;

    measurement.visible = false;
    node.hide();
};

MSR.showMeasurement = (measurementId) => {
    if (measurementId === undefined) return;

    const measurementKey = MSR.getMeasurementKey(measurementId);
    const node = MSR.msrSemMap.get(measurementKey);
    const measurement = MSR.msrMap.get(measurementKey);

    if (!node || !measurement) return;

    node.show();
    measurement.visible = true;
};

MSR.toggleVisibility = (measurementId) => {
    if (measurementId === undefined) return;

    const measurementKey = MSR.getMeasurementKey(measurementId);
    const measurement = MSR.msrMap.get(measurementKey);
    if (!measurement) return;

    if (THOTH.Annotations) {
        const applied = THOTH.Annotations.setVisible(
            THOTH.Annotations.getModelId("measurements", measurementId),
            "measurements",
            measurementId,
            measurement.visible === false
        );
        if (applied) return;
    }

    if (measurement.visible !== false) MSR.hideMeasurement(measurementKey);
    else MSR.showMeasurement(measurementKey);
};

MSR.clearMeasurementHighlight = (clearUI = true) => {
    if (MSR.currentMeasurementLine != null) {
        const prevNode = MSR.msrSemMap?.get(MSR.currentMeasurementLine);
        if (prevNode) {
            prevNode.traverse(child => {
                if (child.userData?.type === "euclidean-measurement-line") {
                    child.material.color.set(MSR.defaultEuclideanLineColor);
                }
                if (child.userData?.type === "geodesic-measurement-line") {
                    child.material.color.set(MSR.defaultGeodesicLineColor);
                }
                if (child.userData?.thothMarker === "measurement-point") {
                    if (child.userData.defaultColor) child.material.color.copy(child.userData.defaultColor);
                    else child.material.color.set(MSR.defaultPointColor);
                }
            });
        }
    }

    MSR.currentMeasurementLine = null;
    if (clearUI) {
        THOTH.FE?.handleElementHighlight(null, THOTH.FE?.msrMap);
    }
};

MSR.clearHighlight = (clearUI = true) => {
    if (THOTH.Annotations?.getActive?.()?.modality === "measurements") {
        THOTH.Annotations.clearActive({
            refreshSceneTree: clearUI
        });
        return;
    }

    MSR.clearMeasurementHighlight(clearUI);
};

MSR.applyMeasurementHighlight = (measurementId) => {
    MSR.clearMeasurementHighlight(false);

    const measurementKey = MSR.getMeasurementKey(measurementId);
    MSR.currentMeasurementLine = measurementKey;

    const node = MSR.msrSemMap.get(measurementKey);
    if (!node) return;

    node.traverse(child => {
        if (child.userData?.type === "euclidean-measurement-line") {
            child.material.color.set(MSR.selectedLineColor);
        }
        if (child.userData?.type === "geodesic-measurement-line") {
            child.material.color.set(MSR.selectedLineColor);
        }
        if (child.userData?.thothMarker === "measurement-point") {
            child.material.color.set(MSR.selectedLineColor);
        }
    });
};

MSR.highlightMeasurement = (measurementId) => {
    if (THOTH.Annotations?.select) {
        return THOTH.Annotations.select("measurements", measurementId);
    }

    MSR.applyMeasurementHighlight(measurementId);
    return true;
};

MSR.renameMeasurement = (measurementId, newName) => {
    if (measurementId === undefined) return;

    const measurementKey = MSR.getMeasurementKey(measurementId);
    const measurement = MSR.msrMap.get(measurementKey);
    if (!measurement) return;

    measurement.name = newName;

    const controller = THOTH.FE.msrMap.get(measurementKey);

    if (controller?.nameBtn) {
        controller.nameBtn.textContent = newName;
    }
};


// Export 

MSR.getExportData = () => {
    const measurementObjects = {};
    for (const [id, measurement] of MSR.msrMap.entries()) {
        if (!measurement || measurement.trash === true) continue;
        measurementObjects[id] = MSR.toCanonicalMeasurement(id, measurement);
    }
    return measurementObjects;
};

// Activation

MSR.activate = () => {
    THOTH.Toolbox.deactivate();
    MSR.enabled = true;
};

MSR.deactivate = () => {
    MSR.enabled = false;
    MSR.clearMeasurementPoints();
};


MSR.pause = () => MSR.paused = true;
MSR.resume = () => MSR.paused = false;


export default MSR
