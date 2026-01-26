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

    const hit    = ATON._hitsScene[0];
    const idx    = hit.faceIndex;
    const coords = hit.point;
    const mesh   = THOTH.hoveredMesh;

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
    const description   = "description";
    const distanceType  = "euclidean";
    const distance      = MSR.getEuclideanDistance(point1, point2);

    const measurementData = {
        id          : measurementId,
        description : description,
        distanceType: distanceType,
        distance    : distance,
        points      : [point1, point2],
        trash       : false
    };

    // Append to Map
    MSR.msrMap.set(measurementId, measurementData);

    // Update SUI
    MSR.addMeasurementSem(measurementId);
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


// SUI

MSR.createPointSem = (point) => {
    const s = 1;
    
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
    label.setScale(10.0); 
     
    return label;
};

MSR.addMeasurementSem = (measurementId) => {
    if (measurementId === undefined) return;
    
    const measurement = MSR.msrMap.get(measurementId);
    
    if (measurement === undefined) return;
    
    // Nodes
    const point1 = measurement.points[0];
    const point2 = measurement.points[1];
    const semPoint1 = MSR.createPointSem(point1);
    const semPoint2 = MSR.createPointSem(point2);
    
    // Line
    const line = MSR.createLineSem(point1, point2);

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
        label.setScale(12);
        label.setOpacity(0.8);
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