/*===========================================================================

    THOTH
    Scene model management

    Authors: 
        Stelios Alvanos (steliosalvanos@gmail.com)

===========================================================================*/
import {TransformControls} from "./transform_controls.js";
let Models = {};

// Setup

Models.setup = () => {
    // Create model map for easy access
    Models.modelMap = new Map();
    Models.tempNode = null;
    Models.gizNode;

};

Models.parseSceneGraph = (sg) => {
    if (sg === undefined) return;

    const nodes = sg.nodes;
    const edges = sg.edges;

    // nodes
    for (const nid in nodes) {

        const N = nodes[nid];
        const G = ATON.getOrCreateSceneNode(nid).removeChildren();
        ATON.SceneHub._applyJSONTransformToNode(N.transform, G);

        let urls = N.urls;
        if (urls) {
            if (Array.isArray(urls)) {
                urls.forEach(u => {
                    G.load(u, () => Models.onLoad(G));
                });
            }
            else {
                G.load(urls, () => Models.onLoad(G));
            }
        }
        
        if (N.toYup) G.setYup();
    }
    // edges
    for (const parid in edges) {
        const children = edges[parid];
        
        const P = ATON.getSceneNode(parid);
        
        if (P !== undefined) {
            for (const c in children){
                const  childid = children[c];
                const  C = ATON.getSceneNode(childid);
                if (C !== undefined) C.attachTo(P);
            } 
        }
    }
    // after connection
    for (const nid in nodes) {
        const N = ATON.getSceneNode(nid);
        Models.modelMap.set(nid, N);
    }
};

Models.onLoad = (model) => {
    model.traverse(N => {
        if (N.isMesh) {
            Models.initMeshColors(N);
        }
    });
    THOTH.FE.addModel(model.name);
    THOTH.updateVisibility();
};


// Utils

Models.getModelURL = (modelName) => {
    if (!modelName) return;

    const model = Models.modelMap.get(modelName);
    if (model === undefined) return;
    
    const url = Object.keys(model._reqURLs)[0];
    return url;
};

Models.getParent = (object) => {
    let parent = object?.parent;

    while (parent) {
        if (parent.type !== "Mesh" && parent.type !== "Group" && parent.type !== "Object3D") {
            return parent.name;
        }
        parent = parent.parent;
    }

    return null;
};

Models.getModelMeshes = (modelName) => {
    if (!modelName) return;
    const model = Models.modelMap.get(modelName);
    if (model === undefined) return;
    
    const meshes = new Map()
    model.traverse(N => {
        if (N.isMesh) {
            meshes.set(N.name, N);
        }
    })
    return meshes;
};

Models.getModelTransforms = (modelName) => {
    if (!modelName) return;
    const model = Models.modelMap.get(modelName);

    return {
        position: [
            Number(model.position.x),
            Number(model.position.y), 
            Number(model.position.z)
        ],
        rotation: [
            Number(model.rotation.x),
            Number(model.rotation.y), 
            Number(model.rotation.z)
        ]
    };
};


// Model Management

Models.addModelFromURL = (modelURL) => {
    if (!modelURL) return;

    // modelURL can act as modelName
    const modelName = modelURL.split('/').filter(Boolean).pop();
    
    if (ATON.getSceneNode(modelName) !== undefined) {
        Models.resurrectModel(modelName);
        return;
    }

    // Create node
    const N = ATON.createSceneNode(modelName);
    ATON.SceneHub._applyJSONTransformToNode(modelName, N);

    N.load(modelURL, () => {
        N.attachToRoot();
        Models.onLoad(N);
    });

    Models.modelMap.set(modelName, N);
};

Models.deleteModel = (modelName) => {
    if (!modelName) return;

    const model = Models.modelMap.get(modelName);
    
    // Dettach node
    if (model.parent) model.parent.remove(model);
    
    // Update FE
    THOTH.FE.deleteModel(modelName);
};

Models.resurrectModel = (modelName) => {
    if (!modelName) return;

    // Reattach to root
    const model = Models.modelMap.get(modelName);
    model.attachToRoot();
    
    // Update FE
    THOTH.FE.addModel(modelName);
};

Models.initMeshColors = (mesh) => {
    // Bounds Tree
    if (!mesh.geometry.boundsTree) {
        mesh.geometry.computeBoundsTree();
    }

    // Color properties for face selection
    mesh.material.vertexColors = true;
    mesh.material.needsUpdate  = true;

    // Vertex colors
    if (!mesh.geometry.attributes.color) {
        const defaultColor = new THREE.Color(0xffffff);
        let colorArray = new Float32Array(mesh.geometry.attributes.position.count * 3);
        for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
            colorArray[i * 3 + 0] = defaultColor.r;
            colorArray[i * 3 + 1] = defaultColor.g;
            colorArray[i * 3 + 2] = defaultColor.b;
        }
        let colorAttr = new THREE.BufferAttribute(colorArray, 3);
        mesh.geometry.setAttribute('color', colorAttr);
    }
};


// Visibility

Models.showModelMeshes = (modelName) => {
    if (modelName === undefined) return;
    
    const meshes = Models.getModelMeshes(modelName);
    const model  = Models.modelMap.get(modelName);
    
    if (meshes === undefined) return;
    
    for (const [, mesh] in meshes) {
        mesh.visible = true;
    }
    model.visible = true;
}; 

Models.hideModelMeshes = (modelName) => {
    if (modelName === undefined) return;
    
    const meshes = Models.getModelMeshes(modelName);
    const model  = Models.modelMap.get(modelName);
    
    if (meshes === undefined) return;
    
    for (const [, mesh] in meshes) {
        mesh.visible = false;
    }
    model.visible = false;
};

Models.toggleVisibility = (modelName) => {
    if (modelName === undefined) return;

    const model = Models.modelMap.get(modelName);
    const modelController = THOTH.FE?.modelMap.get(modelName);

    if (model === undefined) return;

    if (model.visible) {
        Models.hideModelMeshes(modelName);
        model.visible = false;
        THOTH.FE.toggleControllerVisibility(modelController, false);
    }
    else {
        Models.showModelMeshes(modelName);
        model.visible = true;
        THOTH.FE.toggleControllerVisibility(modelController, true);
    }
};  


// Transforms 

Models.modelTransformPos = (modelName, value) => {
    if (modelName === undefined) return;

    const model = Models.modelMap.get(modelName);
    model.position.set(Number(value.x), Number(value.y), Number(value.z));
      if (THOTH.transform && THOTH.transform.object === model) {
        THOTH.transform.updateMatrixWorld(true);
    }
};

Models.modelTransformRot = (modelName, value) => {
    if (modelName === undefined) return;

    const model = Models.modelMap.get(modelName);
    model.rotation.set(Number(value.x), Number(value.y), Number(value.z));
      if (THOTH.transform && THOTH.transform.object === model) {
        THOTH.transform.updateMatrixWorld(true);
    }
};

//add transform controls to scene node
Models.addTransformControls = () => {
    THOTH.transform = new TransformControls(
            ATON.Nav._camera,
            ATON._renderer.domElement
        );

   const gizmoNode = new ATON.Node("transformGizmo");
   ATON._mainRoot.add(gizmoNode);
   gizmoNode.add(THOTH.transform);
};


// Export

Models.getExportData = () => {
    let scenegraph = {};
    
    scenegraph.nodes = {};
    scenegraph.edges = {};
    scenegraph.edges["."] = [];
    for (const [modelName, model] of Models.modelMap.entries()) {
        if (model.parent === null) continue;
        
        const urls = [Models.getModelURL(modelName)];
        const transforms = Models.getModelTransforms(modelName);
        
        // Nodes
        scenegraph.nodes[modelName] = {};
        scenegraph.nodes[modelName].urls = urls;
        scenegraph.nodes[modelName].transform = transforms;
        
        // Edges
        scenegraph.edges["."].push(modelName);
    }

    return scenegraph;
};


export default Models;