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

    MSR.tempNode = null;
    MSR.points   = [];

    MSR.enabled = false;
    MSR.paused  = false;

    MSR.meshCache = new WeakMap();  //cache meshes
    MSR.pathCache = new WeakMap();  //cache paths

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
        MSR.refreshMeasurementVisibility();
    });
};

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

MSR.refreshMeasurementVisibility = () => {
    for (const [id, measurement] of MSR.msrMap.entries()) {
        const node = MSR.msrSemMap.get(id);
        if (!node || !measurement) continue;

        const shouldShow = !MSR.isSceneLoading && measurement.trash !== true && measurement.visible !== false;
        if (shouldShow) node.show();
        else node.hide();
    }
};

MSR.update = () => {
    if (MSR.points.length === 0) return;

    //
};

MSR.parseMeasurements = (measurements) => {
    if (measurements === undefined) return;

    for (const id in measurements) {
        const measurement = measurements[id];
        if (measurement?.points?.length) {
            measurement.points = measurement.points.map(MSR.normalizePoint);
        }
        MSR.msrMap.set(Number(id), measurement);
        MSR.addMeasurementSem(Number(id));
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
    return point;
};

MSR.getPointModel = (point) => {
    if (!point?.meshId) return null;
    return THOTH.Models?.modelMap?.get(point.meshId) ?? null;
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
    const nodes = new ATON.Node("test", ATON.NTYPES.UI);

    ATON._mainRoot.add(nodes);

    return nodes;
};


//  Management

MSR.addMeasurementPoint = () => {
    // Get face id from ATON
    if (!ATON._hitsScene || ATON._hitsScene.length === 0) return undefined;
    const hit    = ATON._hitsScene[0];
    const idx    = hit.faceIndex;
    const coords = hit.point;
    const mesh   = hit.object;
    // const mesh   = THOTH.hoveredMesh;

    const meshId = THOTH.Models?.getParent(mesh) ?? mesh.name;

    const mPoint = {
        "meshId": meshId,
        "meshName": mesh.name,
        "faceId": idx,
        "coords": coords
    };

    MSR.points.push(mPoint);
    MSR.addMeasurementPointSem(mPoint);

    if (MSR.points.length === 2) {
        THOTH.fire("createMeasurement");
        MSR.clearMeasurementPoints();
    }
};

MSR.addMeasurement = (measurementId, point1, point2) => {
    if (measurementId === undefined) return;
    if (point1 === undefined || point2 === undefined) return;

    const measurement = MSR.msrMap.get(measurementId);

    // Resolve id conflict
    if (measurement !== undefined) {
        if (measurement.trash === true) MSR.resurrectMeasurement(measurementId);
        else alert(`Measurement id conflict ${measurementId}`);

        return;
    }

    const distanceType = MSR.distanceType;
    let measurementData = null;

    if (distanceType === "euclidean") {

        const description = "description";
        const name = "";
        // const distanceType  = "euclidean";

        const distance = MSR.getEuclideanDistance(point1, point2);

        measurementData = {
            id: measurementId,
            description: description,
            distanceType: distanceType,
            distance: distance,
            points: [point1, point2],
            trash: false,
            name:  `Measurement ${measurementId}`,
            visible: true
        };
    }
    else if (distanceType === "geodesic") {
        const mesh = MSR.getPointMesh(point1);
        const mesh2 = MSR.getPointMesh(point2);

        if (!mesh || !mesh2) {
            THOTH.FE.showToast("Invalid mesh for geodesic");
            return;
        }

        const { vertices } = MSR.buildMeshGraph(mesh);

        //const startVertex = point1.faceId;
        //const endVertex   = point2.faceId;
        const startVertex = MSR.getNearestVertexIndex(
            mesh,
            point1.coords
        );
        const endVertex = MSR.getNearestVertexIndex(
            mesh,
            point2.coords
        );
        if (startVertex === -1 || endVertex === -1) {
            THOTH.FE.showToast("Invalid vertex indices");
            return;
        }
        // Only allow geodesic when both points are on the same mesh
        if (mesh !== mesh2) {
            THOTH.FE.showToast("Geodesic requires both points on the same mesh");        
            return;
        }
        const path = MSR.getGeodesicPath(mesh, startVertex, endVertex);
        if (!path || path.length === 0) {
             THOTH.FE.showToast("Geodesic path not found!");     
            return;
        }
        if (path) {
            const distance = MSR.computePathLength(vertices, path);
            const description = "description";
            //const name = "";
            const worldPoints = MSR.pathToPoints(mesh, path);
            //const distanceType  = "geodesic";
            measurementData = {
                id: measurementId,
                description: description,
                distanceType: distanceType,
                distance: distance,
                points: [point1, point2],
                path: worldPoints,
                trash: false,
                name:  `Measurement ${measurementId}`,
                visible: true
            };
        }
    }
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

    const measurement = MSR.msrMap.get(measurementId);

    measurement.trash = true;
    MSR.hideMeasurement(measurementId);

    // Update FE
    THOTH.FE.deleteMsr(measurementId);
};

MSR.resurrectMeasurement = (measurementId) => {
    if (measurementId === undefined) return;

    const measurement = MSR.msrMap.get(measurementId);
    if (!measurement.trash) return;

    measurement.trash = false;
    MSR.showMeasurement(measurementId);
    
    // Update FE
    THOTH.FE.addMsr(measurementId);
};

MSR.updateMeasurementLabel = (measurementId, distance) => {
    const node = MSR.msrSemMap.get(measurementId);
    if (!node) return;

    const label = node.children.find(child => child instanceof Label);
    if (!label) {
        console.warn("Label not found for measurement", measurementId);
        return;
    }

    label.setText(distance.toFixed(2));
};


// SUI

MSR.createPointSem = (point) => {
    const model = MSR.getPointModel(point) ?? MSR.getPointMesh(point);
    const modelScale = model ? THOTH.Utils.getModelScale(model) : 1;
    // s = modelscale * percentage_factor
    const s = modelScale * 0.01;

    const pointSem = new THREE.Mesh(ATON.Utils.geomUnitCube, ATON.MatHub.getMaterial("measurement"));

    pointSem.renderOrder = ATON.RO_SUI;
    pointSem.position.copy(point.coords);
    pointSem.scale.set(s, s, s);

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

    if (MSR.tempNode === null) {
        MSR.tempNode = pointSem;
        MSR.nodes.add(MSR.tempNode)
    }
    else {
        MSR.nodes.remove(MSR.tempNode);
        MSR.tempNode = null;
    }
};

MSR.createLabelSem = (measurementId) => {
    if (measurementId === undefined) return;

    const measurement = MSR.msrMap.get(measurementId);

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

    const measurement = MSR.msrMap.get(measurementId);

    if (!measurement) {
        console.warn("Measurement not found in msrMap:", measurementId);
        return;
    }
    if (measurement === undefined) return;

    // Nodes
    const point1 = measurement.points[0];
    const point2 = measurement.points[1];
    const semPoint1 = MSR.createPointSem(point1);
    const semPoint2 = MSR.createPointSem(point2);

    let line;
    if (MSR.distanceType == "euclidean") {
        // Line
        line = MSR.createLineSem(point1, point2);
     }
    if (MSR.distanceType == "geodesic") {
        line  = MSR.drawGeodesicPath(measurement.path);
    }
    
    // Label
    const label = MSR.createLabelSem(measurementId);

    // Add to node
    const node = new ATON.Node(`measurement${measurementId}`, ATON.NTYPES.UI);
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
    });
    node.setOnLeave(() => {
        //label.setScale(0.0);
       // label.setOpacity(0);
    });

    // Add to map
    MSR.msrSemMap.set(measurementId, node);

    // Add to SUI
    node.attachTo(MSR.nodes);
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

    const node = MSR.msrSemMap.get(measurementId);
    const measurement = MSR.msrMap.get(measurementId);

    if (!node || !measurement) return;

    measurement.visible = false;
    node.hide();
};

MSR.showMeasurement = (measurementId) => {
    if (measurementId === undefined) return;

    const node = MSR.msrSemMap.get(measurementId);
    const measurement = MSR.msrMap.get(measurementId);

    if (!node || !measurement) return;

    node.show();
    measurement.visible = false;
};

MSR.toggleVisibility = (measurementId) => {
    if (measurementId === undefined) return;

    const measurement = MSR.msrMap.get(measurementId);
    const node = MSR.msrSemMap.get(measurementId);

    if (!node || !measurement) return;
    //if (measurement === undefined) return;
    const isVisible = node.visible;

    if (isVisible) {
        MSR.hideMeasurement(measurementId);
    }
    else {
        MSR.showMeasurement(measurementId);
    }
        // Keep data synced
    measurement.visible = !isVisible;

    // Optional UI feedback
    THOTH.FE.toggleControllerVisibility(
        THOTH.FE.msrMap.get(measurementId),
        measurement.visible
    );
};

MSR.highlightMeasurement = (measurementId) => {
    // Reset previous
    if (MSR.currentMeasurementLine !== null) {
        const prevNode = MSR.msrSemMap.get(MSR.currentMeasurementLine);
        if (prevNode) {
            prevNode.traverse(child => {
                if (child.userData?.type === "euclidean-measurement-line") {
                    child.material.color.set(MSR.defaultEuclideanLineColor);
                }
                if (child.userData?.type === "geodesic-measurement-line") {
                    child.material.color.set(MSR.defaultGeodesicLineColor);
                }
            });
        }
    }
    // Set new active
    MSR.currentMeasurementLine = measurementId;

    const node = MSR.msrSemMap.get(measurementId);
    if (!node) return;

    node.traverse(child => {
        if (child.userData?.type === "euclidean-measurement-line") {
            child.material.color.set(MSR.selectedLineColor);
        }
        if (child.userData?.type === "geodesic-measurement-line") {
            child.material.color.set(MSR.selectedLineColor);
        }
    });
};

MSR.renameMeasurement = (measurementId, newName) => {
    if (measurementId === undefined) return;
    
    const measurement = MSR.msrMap.get(measurementId);
    if (!measurement) return;

    measurement.name = newName;

    const controller = THOTH.FE.msrMap.get(measurementId);

    if (controller?.nameBtn) {
        controller.nameBtn.textContent = newName;
    }
};


// Export 

MSR.getExportData = () => {
    const measurementObjects = {};
    for (const [id, measurement] of MSR.msrMap.entries()) {
        if (!measurement || measurement.trash === true) continue;
        measurementObjects[id] = measurement;
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