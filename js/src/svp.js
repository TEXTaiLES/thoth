/*===========================================================================

    THOTH
    Semantic Viewpoint Components

    Authors:
        Stelios Alvanos (steliosalvanos@gmail.com)
        Apostolos Kastritsis   

===========================================================================*/
let SVP = {};



SVP.readColmap = (modelName) => {
    const modelURL = THOTH.Models.getModelURL(modelName); 
    if (!modelURL) return Promise.resolve(null);
    
    const colmapPath = ATON.Utils.resolveCollectionURL(
        modelURL.split('/').slice(0, -1).join('/') + "/colmap/images.txt"
    );
    
    return fetch(colmapPath + '?' + new Date().getTime())
        .then(res => {
            if (!res.ok) throw new Error("Colmap retrieval failed: " + res.status);
            return res.text()
        })
        .then(text => {
            const colmapCameras = text.split('\n').filter(line => line.includes('jpg'));
            const colmapMap = new Map();
            for (const cam of colmapCameras) {
                const [id, ...vals] = cam.split(" ");
                colmapMap.set(id, vals);
            }
            return colmapMap;
        })
        .catch(err => {
            console.error("Failed to load " + colmapPath + ": " + err);
            THOTH.FE.showToast("No COLMAP txt detected")
            return null;
        });
};
// read text concerning camera parameters
SVP.readCameraFile = (modelName) => {
    const modelURL = THOTH.Models.getModelURL(modelName);
    const camPath = ATON.Utils.resolveCollectionURL(
        modelURL.split('/').slice(0, -1).join('/') + "/colmap/cameras.txt"
    );

    return fetch(camPath + '?' + new Date().getTime())
        .then(res => res.text())
        .then(text => {
            const lines = text.split('\n').filter(l => l && !l.startsWith('#'));

            // assuming single camera
            const parts = lines[0].split(/\s+/);
            const width  = parseFloat(parts[2]);
            const height = parseFloat(parts[3]);
            const f      = parseFloat(parts[4]);
            const fov = SVP.computeFOV(f, height);
            return { width, height, f, fov };
        });
};

// Build

SVP.buildVPNodes = (vpMap, modelName) => {
    // Delete existing first
    SVP.deleteSVPNodes(modelName);

    // Read camera txt and get FOV
    SVP.currentFOV=null;
    THOTH.SVP.readCameraFile(modelName).then(cam => {
     SVP.currentFOV = cam.fov;
    });
    
    // Create viewpoints
    const viewpoints = new ATON.Node(
        `${modelName}Viewpoints`,
        ATON.NTYPES.UI,
    );
    SVP.viewpoints = SVP.viewpoints || {}; 
    SVP.viewpoints[modelName] = {};

    SVP.viewpointRoots = SVP.viewpointRoots || {};
    SVP.viewpointRoots[modelName] = viewpoints;
    
    for (const [id, vp] of vpMap) {
        const [qw, qx, qy, qz, tx, ty, tz, , image] = vp;
        
        // Convert to three coords
        const Q   = SVP.getQuatThree(qw, qx, qy, qz);
        const pos = SVP.getPosThree(Q, tx,ty, tz);
        //fix axis and orientaiton
        const Rfix = new THREE.Quaternion().setFromEuler(
        new THREE.Euler( Math.PI / 2,0,-Math.PI));
        Q.premultiply(Rfix);
        pos.applyQuaternion(Rfix);
        // Get image url
        // const modelURL = THOTH.Models.modelMap.get(modelName).url;
        const modelURL=THOTH.Models.getModelURL(modelName);
        //const imageURL = modelURL.split('/').slice(0, -1).join('/') + "/images/" + image;
        const imageURL = ATON.Utils.resolveCollectionURL(modelURL.split('/').slice(0, -1).join('/') + "/images/" + image);
        // Get target
        //const target = SVP.createTarget(Q, pos);
        const box = new THREE.Box3().setFromObject(THOTH.Models.modelMap.get(modelName));
        const center = box.getCenter(new THREE.Vector3());

        // Create pov node
        new ATON.POV(`${modelName}_vp_${id}`)
            .setPosition(pos.x, pos.y, pos.z)
            //.setTarget(target.x, target.y, target.z)
            .setTarget(center.x, center.y, center.z)
            .setFOV(SVP.currentFOV);
            
        // Create semantic node
        const semNode = SVP.createSVPNode(`${modelName}_vp_${id}`, pos);
        semNode.attachTo(`${modelName}Viewpoints`);
        semNode.image = ATON.Utils.resolveCollectionURL(imageURL);
        
        // Add to SVP map for convenience
        SVP.viewpoints[modelName][id] = semNode;
    };
    // Attach to model
    // viewpoints.attachTo(THOTH.Models.modelMap.get(modelName).modelData);
    viewpoints.attachTo(THOTH.Models.modelMap.get(modelName));    
};

SVP.createSVPNode = (id, pos) => {
    // Create Sphere geometry
    const radius = 0.2;

    const matSTD = new THREE.MeshStandardMaterial({
        color      : new THREE.Color(0xffffff),
        metalness  : 0.1,
        transparent: true,
        roughness  : 0.4
    });    
    
    const geom = new THREE.SphereGeometry(radius, 16, 12);
    const mesh = new THREE.Mesh(geom, matSTD);

    mesh.renderOrder        = 1;
    mesh.material.depthTest = true;

    // Create node
    const N = new ATON.Node(id, ATON.NTYPES.UI);
    N.add(mesh);
    N.setPickable(true);
    N.setOpacity(0.7);
    N.setPosition(pos.x, pos.y, pos.z);
    //N.orientToCamera();
    N.dirtyBound();
    N.setOnHover(() => {
        N.setOpacity(0.8);
        N.setScale(1.6);
    });
    N.setOnLeave(() => {
        N.setOpacity(0.7);
        N.setScale(1.0);
    });
    N.setOnSelect(() => {
        ATON.Nav.requestPOVbyID(id, 0.5);
        THOTH.FE.showVPCard(id);
    });

    return N;
};

SVP.deleteSVPNodes = (modelName) => {

    const root = SVP.viewpointRoots?.[modelName];

    if (!root) {
        console.warn("No stored viewpoint root");
        return;
    }
    if (root.parent) {
        root.parent.remove(root);
    }
    root.traverse((obj) => {
        if (obj.isMesh) {
            obj.geometry?.dispose();

            if (Array.isArray(obj.material)) {
                obj.material.forEach(m => m?.dispose?.());
            } else {
                obj.material?.dispose?.();
            }
        }
    });

    delete SVP.viewpointRoots[modelName];
    delete SVP.viewpoints?.[modelName];
};


// Visualization

SVP.toggleVPNodes = (modelName) => {
    if (!modelName) {
        const modelNames = Object.keys(SVP.viewpoints);
        for (const name of modelNames) {
            SVP.toggleVPNodes(name);
        }
        return;
    }
    const viewpoints = SVP.viewpoints?.[modelName];
    if (viewpoints === undefined) return;
    for (const vp in viewpoints) {
        let isVisible = viewpoints[vp].visible;
        viewpoints[vp].toggle(!isVisible);
    }
};

SVP.resizeVPNodes = (scale) => {
    for (const modelName in SVP.viewpoints) {
        const viewpoints = SVP.viewpoints[modelName];
        for (const vp in viewpoints) {
            viewpoints[vp].setScale(scale);
        }
    }
};

// Utils

SVP.getQuatThree = (qw, qx, qy, qz) => {
    return new THREE.Quaternion(
        parseFloat(qx),
        parseFloat(qy),
        parseFloat(qz),
        parseFloat(qw)
    ).invert();
};
SVP.getPosThree = (Q, tx, ty, tz) => {
    const t = new THREE.Vector3(
        parseFloat(tx),
        parseFloat(ty),
        parseFloat(tz)
    );
   
    return t.applyQuaternion(Q).multiplyScalar(-1);
};
/* colmap uses: X right, Y down, Z forward
Three.js uses: X right, Y up, Z backward
*/
/*
SVP.getPosThree = (Q, tx, ty, tz) => {
    const process = (v) => {
        const s = 10 ** 4;
        return parseFloat(v) * s / s;
    };
    return new THREE.Vector3(
        -process(tx),
        process(tz),
        process(ty)
    ).applyQuaternion(Q)
};
*/
SVP.createTarget = (Q, pos) => {
    const forward = new THREE.Vector3(0, -1, 0).applyQuaternion(Q).normalize();
    const length  = 10;
    return pos.clone().addScaledVector(forward, length);
};
//three.js using uses vertical fov
//compute fov(focal length->fov(degrees))
SVP.computeFOV = (f, height) => {
    const fovRad = 2 * Math.atan((height / 2) / f);
    return THREE.MathUtils.radToDeg(fovRad);
};

export default SVP;