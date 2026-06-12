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

        THOTH.SceneStore?.ensureModel(nid, {
            artefact: {
                gltf_file: Models._getNodeURL(N)
            },
            transforms: Models._canonicalTransformsFromSceneGraph(N.transform)
        });
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

Models.parseModels = (models) => {
    if (models === undefined) return;

    for (const modelId in models) {
        const modelData = models[modelId];
        if (modelData.trash === true) continue;

        const modelURL = Models._getArtefactURL(modelData.artefact);
        const G = ATON.getOrCreateSceneNode(modelId).removeChildren();
        Models._applyCanonicalTransforms(modelData.transforms, G);

        if (modelURL) {
            G.load(modelURL, () => {
                G.attachToRoot();
                Models.onLoad(G);
            });
        }
        else {
            G.attachToRoot();
        }

        Models.modelMap.set(modelId, G);
    }
};

Models.onLoad = (model) => {
    model.traverse(N => {
        if (N.isMesh) {
            Models.initMeshColors(N);
        }
    });
    
    THOTH.updateSceneScale(model);
    THOTH.FE.addModel(model.name);
    THOTH.updateVisibility();
};


// Utils

Models.getModelURL = (modelName) => {
    if (!modelName) return;

    const model = Models.modelMap.get(modelName);
    if (model === undefined) {
        return Models._getArtefactURL(
            THOTH.SceneStore?.getModel(modelName)?.artefact
        );
    }
    
    const url = Object.keys(model._reqURLs || {})[0];
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
        if (N.isMesh && N.name !== "") {
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
        scale: [1, 1, 1],
        rotation: [
            Number(model.rotation.x),
            Number(model.rotation.y), 
            Number(model.rotation.z)
        ]
    };
};

Models.getCanonicalModelTransforms = (modelName) => {
    if (!modelName) return;
    const model = Models.modelMap.get(modelName);
    if (!model) return;

    return {
        translation: {
            x: Number(model.position.x),
            y: Number(model.position.y),
            z: Number(model.position.z)
        },
        rotation: {
            x: Number(model.rotation.x),
            y: Number(model.rotation.y),
            z: Number(model.rotation.z)
        },
        scale: {
            x: Number(model.scale.x),
            y: Number(model.scale.y),
            z: Number(model.scale.z)
        }
    };
};

Models._getNodeURL = (nodeData) => {
    const urls = nodeData?.urls;

    if (Array.isArray(urls)) return urls[0];
    if (typeof urls === "string") return urls;

    return undefined;
};

Models._getArtefactURL = (artefact = {}) => {
    return artefact.gltf_file || artefact.url || artefact.path || artefact.src;
};

Models._canonicalTransformsFromSceneGraph = (transform = {}) => {
    const position = transform.translation || transform.position || [0, 0, 0];
    const rotation = transform.rotation || [0, 0, 0];
    const scale    = transform.scale || [1, 1, 1];

    return {
        translation: Models._vectorFromTransformValue(position, { x: 0, y: 0, z: 0 }),
        rotation: Models._vectorFromTransformValue(rotation, { x: 0, y: 0, z: 0 }),
        scale: Models._vectorFromTransformValue(scale, { x: 1, y: 1, z: 1 })
    };
};

Models._vectorFromTransformValue = (value, defaultValue) => {
    if (Array.isArray(value)) {
        return {
            x: Number(value[0] ?? defaultValue.x),
            y: Number(value[1] ?? defaultValue.y),
            z: Number(value[2] ?? defaultValue.z)
        };
    }

    if (value && typeof value === "object") {
        return {
            x: Number(value.x ?? defaultValue.x),
            y: Number(value.y ?? defaultValue.y),
            z: Number(value.z ?? defaultValue.z)
        };
    }

    return { ...defaultValue };
};

Models._applyCanonicalTransforms = (transforms = {}, model) => {
    const translation = Models._vectorFromTransformValue(
        transforms.translation,
        { x: 0, y: 0, z: 0 }
    );
    const rotation = Models._vectorFromTransformValue(
        transforms.rotation,
        { x: 0, y: 0, z: 0 }
    );
    const scale = Models._vectorFromTransformValue(
        transforms.scale,
        { x: 1, y: 1, z: 1 }
    );

    model.position.set(translation.x, translation.y, translation.z);
    model.rotation.set(rotation.x, rotation.y, rotation.z);
    model.scale.set(scale.x, scale.y, scale.z);
};


// Model Management

Models.addModelFromURL = (modelURL) => {
    if (!modelURL) return;

    // modelURL can act as modelName
    const modelName = modelURL.split('/').filter(Boolean).pop();
    THOTH.SceneStore?.ensureModel(modelName, {
        artefact: {
            gltf_file: modelURL
        }
    });
    
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
    THOTH.SceneStore?.deleteModel(modelName);
    
    // Dettach node
    if (model?.parent) model.parent.remove(model);
    
    // Update FE
    THOTH.FE.deleteModel(modelName);
};

Models.resurrectModel = (modelName) => {
    if (!modelName) return;

    // Reattach to root
    const model = Models.modelMap.get(modelName);
    const storeModel = THOTH.SceneStore?.getModel(modelName);
    if (storeModel) storeModel.trash = false;
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
    THOTH.SceneStore?.setModelField(
        modelName,
        "transforms",
        Models.getCanonicalModelTransforms(modelName)
    );
      if (THOTH.transform && THOTH.transform.object === model) {
        THOTH.transform.updateMatrixWorld(true);
    }
};

Models.modelTransformRot = (modelName, value) => {
    if (modelName === undefined) return;

    const model = Models.modelMap.get(modelName);
    model.rotation.set(Number(value.x), Number(value.y), Number(value.z));
    THOTH.SceneStore?.setModelField(
        modelName,
        "transforms",
        Models.getCanonicalModelTransforms(modelName)
    );
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

Models.deactivateTransformControls = () => {

    if (!THOTH.transform) return;

    THOTH.transform.detach();

    THOTH.transform.visible = false;

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
