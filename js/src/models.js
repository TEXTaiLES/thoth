/*===========================================================================

    THOTH
    Scene model management

    Authors: 
        Stelios Alvanos (steliosalvanos@gmail.com)

===========================================================================*/
let Models = {};

// Setup

Models.setup = () => {
    // Create model map for easy access
    Models.modelMap = new Map();
    Models.tempNode = null;
    Models.gizNode;
    Models._pendingInitialFocusModelId = null;
    Models._hasFocusedInitialScene = false;

    ATON.on("SceneJSONLoaded", () => {
        Models._pendingInitialFocusModelId = null;
        Models._hasFocusedInitialScene = false;
    });

    ATON.on("AllNodeRequestsCompleted", () => {
        if (Models._hasFocusedInitialScene) return;
        if (!Models._pendingInitialFocusModelId) return;

        Models.focusModel(Models._pendingInitialFocusModelId, 0.5);
        Models._hasFocusedInitialScene = true;
        Models._pendingInitialFocusModelId = null;
    });
};

Models.parseModels = (models) => {
    if (models === undefined) return;

    const modelIds = Object.keys(models).filter(modelId => models[modelId]?.trash !== true);
    if (!Models._hasFocusedInitialScene && modelIds.length > 0) {
        Models._pendingInitialFocusModelId = modelIds[0];
    }

    for (const modelId of modelIds) {
        const modelData = models[modelId];

        THOTH.Artefacts?.parseModelArtefact(modelId, modelData.artefact);
        THOTH.Transforms?.parseModelTransform(modelId, modelData.transforms);
        THOTH.Selections?.parseSelections(modelId, modelData.selections);
        THOTH.MSR?.parseMeasurements(modelData.measurements, modelId);
        THOTH.SemAnnotations?.parseAnnotations(modelData.semantic_annotations, modelId);

        const modelURL = THOTH.Artefacts?.getModelURL(modelId);
        const G = ATON.getOrCreateSceneNode(modelId).removeChildren();
        Models._applyCanonicalTransforms(
            THOTH.Transforms?.getModelTransform(modelId) || modelData.transforms,
            G
        );

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

Models.onLoad = async (model, options = {}) => {
    console.log("[MODEL LOADED]", model?.name, model);
    model.traverse(N => {
        if (N.isMesh) {
            Models.initMeshColors(N);
        }
    });

    Models.refreshModelPicking(model);
    
    THOTH.updateSceneScale(model);
    THOTH.FE.addModel(model.name);
    THOTH.updateVisibility();

    if (options.focus === true) {
        Models.focusModel(model.name, options.duration);
    }
    //added this
     const meshes = [];
    model.traverse(N => {
        if (N.isMesh && N.geometry) meshes.push(N);
    });

    if (!meshes.length) {
        console.warn("No meshes found AFTER load (unexpected)");
        return;
    }
    console.log("[MODEL LOADED]", model?.name, model);
  //  console.log("[GEODESIC] mesh count:", meshes.length);
   // console.log("[GEODESIC] meshes:", meshes);
    
    const mesh = meshes[0];
    const model_id = model.name;

    const meshData = THOTH.MSR.getVerticesAndFaces(mesh);//mergedvertices
    const geo = mesh.geometry;

    const pos = geo.attributes.position;
    const idx = geo.index;

    console.log("ONLOAD: # vertices =", pos.count);
    console.log("ONLOAD:# faces =",idx.count);

    const safeData = THOTH.MSR.sanitizeGeodesicMesh(meshData.vertices, meshData.faces);

    console.log(" [SANITIZE] VERT COUNT:", safeData.vertices.length / 3);
    console.log("[SANITIZE] FACE COUNT:", safeData.faces.length / 3);

    const loadresult = await THOTH.API.geodesicLoad({
       model_id: model_id,
       vertices: safeData.vertices,
       faces: safeData.faces
       });

    if (options.focus === true) {
        Models.focusModel(model.name, options.duration);
    }
};

// Utils

Models.getModelURL = (modelName) => {
    if (!modelName) return;

    const model = Models.modelMap.get(modelName);
    if (model === undefined) {
        return THOTH.Artefacts?.getModelURL(modelName);
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

Models.focusModel = (modelName, duration = 0.5) => {
    if (!modelName) return false;

    const model = Models.modelMap.get(modelName) || ATON.getSceneNode(modelName);
    if (!model || !ATON.Nav?.requestPOVbyNode) return false;

    ATON.Nav.requestPOVbyNode(model, duration);
    ATON.focusOn3DView?.();
    return true;
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

Models.refreshModelPicking = (model) => {
    if (!model || !ATON.Utils?.updatePickGraph) return;

    const refresh = () => {
        if (!model.parent) return;

        ATON.Utils.updatePickGraph(model, model.type);
    };

    if (model.parent) {
        refresh();
        return;
    }

    const requestFrame = globalThis.requestAnimationFrame ||
        ((callback) => setTimeout(callback, 0));
    requestFrame(refresh);
};


// Model Management

Models.addModelFromURL = (modelURL, modelId, options = {}) => {
    if (!modelURL) return;

    // modelURL can act as modelName
    const modelName = modelId || modelURL.split('/').filter(Boolean).pop();
    THOTH.Artefacts?.parseModelArtefact(modelName, {
        gltf_file: modelURL
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
        Models.onLoad(N, {
            focus   : options.focus === true,
            duration: options.duration
        });
    });

    Models.modelMap.set(modelName, N);

    THOTH.fire("modelLoaded", N);
    
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
    
    for (const [, mesh] of meshes) {
        mesh.visible = true;
    }
    model.visible = true;
}; 

Models.hideModelMeshes = (modelName) => {
    if (modelName === undefined) return;
    
    const meshes = Models.getModelMeshes(modelName);
    const model  = Models.modelMap.get(modelName);
    
    if (meshes === undefined) return;
    
    for (const [, mesh] of meshes) {
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


Models.deactivateTransformControls = () => {
    THOTH.Transforms?.detachGizmo();
};

export default Models;
