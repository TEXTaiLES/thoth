/*===========================================================================

    THOTH
    Measurement functionalities

    Author: steliosalvanos@gmail.com

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

   // MSR.distanceType = "euclidean"; // default
   // MSR.distanceType = MSR.distanceType || "euclidean";
    MSR.distanceType = "geodesic";
    MSR.lastMeasurementId = null;
    MSR.lastMeasurementPoints = null;
    //MSR.lastMeasurementPoints = [];
};

MSR.update = () => {
    if (MSR.points.length === 0) return;
    
    //
};

MSR.parseMeasurements = (measurements) => {
    if (measurements === undefined) return;
    
    for (const id in measurements) {
        const measurement = measurements[id];
        MSR.msrMap.set(Number(id), measurement);
        MSR.addMeasurementSem(Number(id));
    }
};

  
// Geometries

MSR.createMeasurementLine = () => {
    const line_ = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const mline = new THREE.Line(line_, ATON.MatHub.getMaterial("measurement"));
    
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
console.log("MSR click", MSR.enabled, MSR.paused);
    const hit    = ATON._hitsScene[0];
    const idx    = hit.faceIndex;
    const coords = hit.point;
   // const mesh   = THOTH.hoveredMesh;
    const mesh = hit.object;

    const mPoint = {
        "mesh"  : mesh,
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
    
    // Build measurement data
    /*
    const description   = "description";
    const distanceType  = "euclidean";
    const distance = MSR.getEuclideanDistance(point1, point2);
    const measurementData = {
        id          : measurementId,
        description : description,
        distanceType: distanceType,
        distance    : distance,
        points      : [point1, point2],
        trash       : false
    };
    */
    const distanceType = MSR.distanceType; 
    let measurementData = null; 
   
if (distanceType === "euclidean") {

    const description   = "description";
   // const distanceType  = "euclidean";

    const distance = MSR.getEuclideanDistance(point1, point2);

    measurementData = {
        id          : measurementId,
        description : description,
        distanceType: distanceType,
        distance    : distance,
        points      : [point1, point2],
        trash       : false
    };
    MSR.updateResultUI(distance, distanceType);  
}
else if (distanceType === "geodesic") {
    const mesh = point1.mesh;

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
    console.warn("Invalid vertex indices");
    return;
}
//Only allow geodesic when both points are on the same mesh
    if (point1.mesh !== point2.mesh) {
    console.warn("Geodesic requires both points on the same mesh");
    //added this, else fallback to euclidian
    console.warn("should fallback to euclidian");
    return;
}
        console.log("Start face:", point1.faceId, "End face:", point2.faceId);
        console.log("Vertices count:", vertices.length);
        console.log(point1.mesh.uuid, point2.mesh.uuid);
    const path = MSR.getGeodesicPath(mesh, startVertex, endVertex);
    if (!path || path.length === 0) {
        console.warn("Geodesic path not found");
        return;
    }
    if (path) {
        const distance = MSR.computePathLength(vertices, path);
        const description   = "description";
        //const distanceType  = "geodesic";
        measurementData = {
        id          : measurementId,
        description : description,
        distanceType: distanceType,
        distance    : distance,
        points      : [point1, point2],
        trash       : false
    };
        // draw geodesic line in scene
        const worldPoints = MSR.pathToPoints(mesh, path);
        //const geoLine = MSR.drawGeodesicPath(node, worldPoints); // attach to node
        MSR.drawGeodesicPath(ATON._mainRoot, worldPoints);
        MSR.updateResultUI(distance, distanceType);  

    }
}

    // Append to Map
    MSR.msrMap.set(measurementId, measurementData);

    // Update SUI
    MSR.addMeasurementSem(measurementId);

    // attach new SUI node
/*    const node = MSR.addMeasurementSem(measurementId);
    // If geodesic, draw line on that node
if (distanceType === "geodesic" && path && path.length > 0) {
    const worldPoints = MSR.pathToPoints(mesh, path);
    MSR.drawGeodesicPath(node, worldPoints);}
    */
    //added this
    // store last measurement for recompute
    MSR.lastMeasurementId = measurementId;
   // MSR.lastMeasurementNode = node;
    MSR.lastMeasurementPoints = [point1, point2];
};

MSR.deleteMeasurement = (measurementId) => {
    if (measurementId === undefined ) return;

    const measurement = MSR.msrMap.get(measurementId);
    
    measurement.trash = true;
    MSR.hideMeasurement(measurementId);
};

MSR.resurrectMeasurement = (measurementId) => {
    if (measurementId === undefined) return;
    
    const measurement = MSR.msrMap.get(measurementId);
    if (!measurement.trash) return;

    measurement.trash = false;
    MSR.showMeasurement(measurementId);
};

MSR.recomputeLastMeasurement = () => {
    const id = MSR.lastMeasurementId;
    if (id === undefined) return;

    const m = MSR.msrMap.get(id);
    if (!m) return;

    const [p1, p2] = m.points;
    if (!p1 || !p2) return;

    let distance = 0;
    let pathPoints = null;

    if (MSR.distanceType === "euclidean") {
        distance = MSR.getEuclideanDistance(p1, p2);
    }

    if (MSR.distanceType === "geodesic") {
        if (p1.mesh !== p2.mesh) {
            console.warn("Geodesic requires same mesh");
            return;
        }

        const mesh = p1.mesh;
        const { vertices } = MSR.buildMeshGraph(mesh);

        const vStart = MSR.getNearestVertexIndex(mesh, p1.coords);
        const vEnd   = MSR.getNearestVertexIndex(mesh, p2.coords);

        if (vStart === -1 || vEnd === -1) return;

        const path = MSR.getGeodesicPath(mesh, vStart, vEnd);
        if (!path) {
            console.warn("No geodesic path");
            return;
        }

        distance = MSR.computePathLength(vertices, path);
        pathPoints = MSR.pathToPoints(mesh, path);
    }

    // update data
    m.distance = distance;
    m.distanceType = MSR.distanceType;
    m.path = pathPoints;

    // update UI panel
    MSR.updateResultUI(distance, MSR.distanceType);
};

//not used
/*
MSR.rebuildMeasurementSem = (id, point1, point2) => {
    const node = MSR.msrSemMap.get(id);
    if (node) {
        MSR.nodes.remove(node);
        MSR.msrSemMap.delete(id);
    }

    // Re-add measurement with current distance type
    MSR.addMeasurement(id, point1, point2);
};
*/
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
    const s = 0.1;
    
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
        line_ = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...point1.coords), new THREE.Vector3(...point2.coords)]);
    } 

    const mline = new THREE.Line(line_, ATON.MatHub.getMaterial("measurement"));
    
    mline.renderOrder = ATON.RO_SUI;
    mline.visible = true;
    
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

    const point1   = measurement.points[ 0];
    const point2   = measurement.points[1];
    const distance = measurement.distance;
    
    const label = new Label("", distance.toString());
    label.setPosition(
        (point1.coords.x + point2.coords.x) * 0.5,
        (point1.coords.y + point2.coords.y) * 0.5,
        (point1.coords.z + point2.coords.z) * 0.5,
    );
    label.setScale(1.0); 
     
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
    
    // Line
    const line = MSR.createLineSem(point1, point2);
/*
    //adding geodesic line recomputaiton
    let line;

if (measurement.distanceType === "geodesic" && measurement.path) {
    const geom = new THREE.BufferGeometry().setFromPoints(measurement.path);
    line = new THREE.Line(geom, ATON.MatHub.getMaterial("measurement"));
    line.renderOrder = ATON.RO_SUI;
} else {
    line = MSR.createLineSem(point1, point2);
}
*/
    // Label
    const label = MSR.createLabelSem(measurementId);
    
    // Add to node
    const node = new ATON.Node(`measurement${measurementId}`, ATON.NTYPES.UI);
    node.add(semPoint1);
    node.add(semPoint2);
    //node.add(label);
    node.add(line);
    node.setPickable(true);
    node.setOnHover(() => {
        label.setScale(12);
        //label.setOpacity(0.8);
        label.setOpacity(0.0);
    });
    node.setOnSelect(() => {
    });
    node.setOnLeave(() => {
        label.setScale(10);
        label.setOpacity(0.5);
    });
    
    // Add to map
    MSR.msrSemMap.set(measurementId, node);
    
    // Add to SUI
    node.attachTo(MSR.nodes);
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
MSR.drawGeodesicPath = function (scene, points) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
        color: 0xff0000,
        linewidth: 5
    });

    const line = new THREE.Line(geometry, material);
    scene.add(line);
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
//updates ui with distance measurements
MSR.updateResultUI = (distance, distanceType) => {
    if (!MSR.elResult) return;  // reference to the container
    MSR.elResult.textContent = `${distanceType} distance: ${distance.toFixed(2)}`;
};

// Visibility

MSR.hideMeasurement = (measurementId) => {
    if (measurementId === undefined) return;

    const node = MSR.msrSemMap.get(measurementId);
    
    node.hide();
};

MSR.showMeasurement = (measurementId) => {
    if (measurementId === undefined) return;
    
    const node = MSR.msrSemMap.get(measurementId);
    
    node.show();
};

MSR.toggleVisibility = (measurementId) => {
    if (measurementId === undefined) return;

    const measurement = MSR.msrMap.get(measurementId);

    if (measurement === undefined) return;

    if (measurement.visible) {
        MSR.hideMeasurement(measurementId);
    }
    else {
        MSR.showMeasurement(measurementId);
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


/*
MSR.updateResultUI = (distance, type) => {
    if (!MSR.resultLabel) return;

    if (distance === null || distance === undefined) {
        MSR.resultLabel.setText(`${type.toUpperCase()}: -`);
    } else {
        MSR.resultLabel.setText(
            `${type.toUpperCase()}: ${distance.toFixed(2)}`
        );
    }
};
*/
// Activation

MSR.activate = () => {
    THOTH.Toolbox.deactivate();
    MSR.enabled = true;
};

MSR.deactivate = () => {
    MSR.enabled = false;
    MSR.clearMeasurementPoints();
};


MSR.pause  = () => MSR.paused = true;
MSR.resume = () => MSR.paused = false;


export default MSR