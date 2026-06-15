/*===========================================================================

    THOTH
    Launch Point

    Authors: 
        Stelios Alvanos (steliosalvanos@gmail.com)
        Ioannis Giannoukos
        Apostolos Kastritsis

===========================================================================*/
import UI                  from "./src/ui.js";
import Utils               from "./src/utils.js";
import Toolbox             from "./src/toolbox.js";
import History             from "./src/history.js";
import Events              from "./src/events.js";
import SVP                 from "./src/svp.js";
import Selections          from "./src/selections.js";
import Models              from "./src/models.js";
import FE                  from "./src/fe.js";
import MD                  from "./src/metadata.js";
import Collab              from "./src/collab.js";
import MSR                 from "./src/measurements.js";
import SemAnnotations      from "./src/semantic_annotations.js";
import {TransformControls} from "./src/transform_controls.js";
import SceneStore          from "./src/scene_store.js";
import Ops                 from "./src/operations.js";
import API                 from "./src/api_client.js";
import Auth                from "./src/auth.js";
import Artefacts           from "./src/artefacts.js";
import Transforms          from "./src/transforms.js";
import Annotations         from "./src/annotations.js";


// Realize 
let THOTH = ATON.App.realize();
window.THOTH = THOTH;


// Import
THOTH.UI             = UI;
THOTH.Utils          = Utils;
THOTH.Toolbox        = Toolbox;
THOTH.History        = History;
THOTH.Events         = Events;
THOTH.SVP            = SVP;
THOTH.Models         = Models;
THOTH.Selections     = Selections;
THOTH.FE             = FE;
THOTH.MD             = MD;
THOTH.Collab         = Collab;
THOTH.MSR            = MSR;
THOTH.SemAnnotations = SemAnnotations;
THOTH.TC             = TransformControls;
THOTH.SceneStore     = SceneStore;
THOTH.Ops            = Ops;
THOTH.API            = API;
THOTH.Auth           = Auth;
THOTH.Artefacts      = Artefacts;
THOTH.Transforms     = Transforms;
THOTH.Annotations    = Annotations;


THOTH.BASE_URL        = "../thoth";
THOTH.PATH_RES_ICONS  = `${THOTH.BASE_URL}/js/res/icons/`;
THOTH.PATH_RES_SCHEMA = `${THOTH.BASE_URL}/js/res/schema/`;


THOTH.sid = THOTH.params.get('s');
// THOTH.oid = THOTH.params.get('id');

THOTH.requireAuth = (actionName, onAllowed) => {
    return THOTH.Auth.requireAuth(actionName, onAllowed);
};

THOTH.isAuthenticated = () => {
    return THOTH.Auth.isAuthenticated();
};

THOTH.setAuthState = (user) => {
    THOTH.Auth.setAuthState(user);
};



// Init 

THOTH.setup = () => {
    // Realize base ATON and add base UI events
    ATON.realize();
    ATON.UI.addBasicEvents();
    THOTH.Auth.setup();
    THOTH.SceneStore.setup();
    
    // Canonical scene parser
    ATON.SceneHub.addSceneParser("models", models => {
        THOTH.SceneStore.parseScene({ models });
        THOTH.Models.parseModels(THOTH.SceneStore.getScene().models);
    });
    
    // Init collaborative
    ATON.SceneHub.addSceneParser("collaborative", data => {
        THOTH.Collab.parseCollab(data);
    });

    // Load config
    ATON.REQ.get(
        "../../a/thoth/config.json",
        data => {
            THOTH.config = data;
            THOTH.API.setup(data);
            ATON.fire("ConfigLoaded");
        },
        err => ATON.UI.showModal("Error loading schema" + err)
    );

    ATON.on("AllFlaresReady", () =>{
        ATON.on("ConfigLoaded", () => {
            // Init selections
            THOTH.Selections.setup();
            // Init models
            THOTH.Models.setup();
            // Init artefacts
            THOTH.Artefacts.setup();
            // Init metadata
            THOTH.MD.setup();
            // Init transforms
            THOTH.Transforms.setup();
            // Init shared annotation API
            THOTH.Annotations.setup();
            // Init history
            THOTH.History.setup();
            // Init operations
            THOTH.Ops.setup();
            // Init events
            THOTH.Events.setup();
            // Init toolbox
            THOTH.Toolbox.setup(THOTH.config.toolboxDefaults);
            // Init measurements
            THOTH.MSR.setup();
            // Init semantic annotations
            THOTH.SemAnnotations.setup();
            // Init front end 
            THOTH.FE.setup();
            THOTH.FE.setupToolboxElements();

            if (THOTH.sid) {
                ATON.SceneHub.load(
                    THOTH.config.baseSceneUrl + THOTH.sid,
                    THOTH.sid,
                    () => {
                        THOTH.initData = ATON.SceneHub.currData;
                        ATON.REQ.get("user", (u) => {
                            if (u === false) THOTH.setAuthState(null);
                            else THOTH.onLogin(u);
                        });

                    }
                );
            }
        })
    })
};

THOTH.update = () => {
    if (THOTH._bPauseQuery) return;
    
    THOTH._queryData = ATON._queryDataScene;
    
    THOTH.hoveredMesh  = THOTH._queryData?.o?.name;
    THOTH.hoveredModel = THOTH.Models.getParent(THOTH._queryData?.o);
};


// Visualization

THOTH.highlightSelection = (selection, highlightColor, modelName, meshName) => {
    if (selection === undefined || highlightColor === undefined||
        modelName === undefined || meshName === undefined) return;

    const meshes = THOTH.Models.getModelMeshes(modelName);
    const mesh   = meshes.get(meshName);

    if (mesh === undefined) return;

    const colorAttr = mesh.geometry.attributes.color;
    const indexAttr = mesh.geometry.index;
    const colors    = colorAttr.array;
    const stride    = colorAttr.itemSize;
    
    const r = highlightColor.r;
    const g = highlightColor.g; 
    const b = highlightColor.b;
    
    if (indexAttr) {
        const indices = indexAttr.array;
        for (const face of selection) {
            const face3 = face * 3;
            
            const idx0 = indices[face3] * stride;
            const idx1 = indices[face3 + 1] * stride;
            const idx2 = indices[face3 + 2] * stride;
            
            colors[idx0]     = r;
            colors[idx0 + 1] = g;
            colors[idx0 + 2] = b;
            
            colors[idx1]     = r;
            colors[idx1 + 1] = g;
            colors[idx1 + 2] = b;
            
            colors[idx2]     = r;
            colors[idx2 + 1] = g;
            colors[idx2 + 2] = b;
        }
    } else {
        const stride3 = stride * 3;
        for (const face of selection) {
            const faceStart = face * stride3;
            
            colors[faceStart]     = r;
            colors[faceStart + 1] = g;
            colors[faceStart + 2] = b;
            
            colors[faceStart + stride]     = r;
            colors[faceStart + stride + 1] = g;
            colors[faceStart + stride + 2] = b;
            
            colors[faceStart + stride * 2]     = r;
            colors[faceStart + stride * 2 + 1] = g;
            colors[faceStart + stride * 2 + 2] = b;
        }
    }
    
    colorAttr.needsUpdate = true;

};

THOTH.highlightAllSelections = () => {
    THOTH.Selections?.refreshAllHighlights();
};

THOTH.clearHighlights = () => {
    for (const modelName of THOTH.Models.modelMap.keys()) {
        const meshes = THOTH.Models.getModelMeshes(modelName);
        for (const mesh of meshes.values()) {
            const colorAttr  = mesh.geometry.attributes.color;
            
            if (!colorAttr) continue;

            const colorArray = colorAttr.array;
            for (let i=0; i < colorArray.length; i++) {
                colorArray[i] = 1;
            }
            colorAttr.needsUpdate = true;
        }
    }
};

THOTH.updateVisibility = () => {
    THOTH.clearHighlights();
    THOTH.highlightAllSelections();
};

THOTH.updateSceneScale = (model) => {
    const newModelScale = THOTH.Utils.getModelScale(model);
    
    // Naive computation
    if (THOTH.sceneScale === undefined) {
        THOTH.sceneScale = newModelScale;
    }
    else {
        THOTH.sceneScale = (THOTH.sceneScale + newModelScale) / 2;
    }
    console.log("Average object scale: " + THOTH.sceneScale);
    THOTH.Toolbox.setSelectorBaseRadius(0.01 * THOTH.sceneScale);
    THOTH.MSR?.refreshLabelScales();
    THOTH.MSR?.refreshMarkerScales();
    THOTH.MSR?.refreshMeasurementVisibility();
    THOTH.SemAnnotations?.refreshLabelScales();
    THOTH.SemAnnotations?.refreshMarkerScales();
    THOTH.SemAnnotations?.refreshAnnotationVisibility();
};


// Texture Maps

// TODO: update this for multi-mesh
THOTH.updateNormalMap = (path, mesh, intensity = 10) => {
    if (!path) return false;
    if (mesh === undefined) mesh = THOTH.Scene.mainMesh;

    THOTH.textureLoader.load(path, (tex)=>{
        const mat = mesh.material;

        if (mat.normalMap) {
            mat.normalMap.image = tex.image;
        }
        else {
            mat.normalMap       = tex;
            mat.normalMap.flipY = false;
            mat.normalMap.wrapS = mat.map.wrapS;
            mat.normalMap.wrapT = mat.map.wrapT;
            mat.normalScale.set(intensity, intensity);
            // mat.normalScale.set(intensity, -intensity);
        }
        mat.normalMap.needsUpdate   = true;
        mat.needsUpdate             = true;
        THOTH.updateVisibility(mesh);
    });
};

THOTH.removeNormalMap = (mesh) => {
    if (mesh === undefined) mesh = THOTH.Scene.mainMesh;
    const mat = mesh.material;

    if (mat.normalMap) {
        mat.normalMap.dispose();
        mat.normalMap = null;
        mat.needsUpdate = true;
        THOTH.updateVisibility(mesh);
    }
};

THOTH.updateTextureMap = (path, mesh) => {
    if (!path) return false;
    if (mesh === undefined) mesh = THOTH.Scene.mainMesh;

    THOTH.textureLoader.load(path, (tex)=>{
        const mat = mesh.material;

        if (mat.map) {
            mat.map.image = tex.image;
        }
        else {
            mat.map = tex;
            mat.map.wrapS = mat.map.wrapS;
            mat.map.wrapT = mat.map.wrapT;
        }
        mat.map.needsUpdate = true;
        mat.needsUpdate     = true;
        THOTH.updateVisibility(mesh);
    });
};


// Export

THOTH.exportChanges = () => {
    if (!THOTH.requireAuth("export changes")) return;

    console.log("Exporting changes...");

    let A = THOTH.getExportData();

    const exportJson = JSON.stringify(A, null, 2);
    const exportBlob = new Blob([exportJson], { type: "application/json" });
    const exportUrl = URL.createObjectURL(exportBlob);
    const exportLink = document.createElement("a");
    exportLink.href = exportUrl;
    exportLink.download = `${THOTH.sid || "scene"}.json`;
    exportLink.click();
    URL.revokeObjectURL(exportUrl);
    THOTH.FE.showToast("Scene JSON downloaded locally.");
    
    // Remove all annotation objects and ADD them again with changes
    // ATON.REQ.patch(
    //     THOTH.config.baseSceneUrl + THOTH.sid,
    //     {
    //         data: THOTH.initData,
    //         mode: "DEL"
    //     },
    //     () => {},
    //     err => {
    //         console.log(err);
    //         return;
    //     }
    // );

    // Patch changes
    // ATON.REQ.patch(
    //     THOTH.config.baseSceneUrl + THOTH.sid,
    //     {
    //         data: A,
    //         mode: "ADD"
    //     },
    //     () => {
    //         THOTH.FE.showToast("Changes exported successfully!");
    //         // Update for next export;
    //         THOTH.initData = A;
    //     },
    //     (err) => console.log(err)
    // );

};

THOTH.exportToHestia = async () => {
    if (!THOTH.requireAuth("export changes")) return {
        ok   : false,
        error: "Authentication required"
    };

    console.log("Exporting to Hestia");

    const endpoint = THOTH.config.hestiaEndpoint || THOTH.config.endpoint;
    const token    = THOTH.config.hestiaToken || THOTH.config.token;

    if (!endpoint) {
        THOTH.FE.showToast("Missing endpoint: scene_export");
        return {
            ok   : false,
            error: "Missing endpoint: scene_export"
        };
    }

    // FORM DATA
    const formData = new FormData();
    // Scene id
    formData.append("scene_id", THOTH.sid);
    // Model urls
    for (const modelName in THOTH.Models.modelMap) {
        formData.append("file", THOTH.Models.getModelURL(modelName));
    }
    // Payload
    const payload = THOTH.getExportData();
    formData.append("scene", JSON.stringify(payload));
    
    // POST
    const response = await fetch(endpoint, {
        method: "POST",
        header: {
            Authorization: `Bearer ${token}`,
        },
        body: formData
    });
    
    // RESPONSE
    if (!response.ok) {
        const text = await response.text;
        THOTH.FE.showToast(text)
        throw new Error(
            `Export failed (${response.status}): ${text}`
        );
    }
    else {
        THOTH.FE.showToast("Export successful!");
    }

    return response.json();
};

THOTH.getExportData = () => {
    return {
        models: THOTH.SceneStore.getExportData().models
    };
};


// User 

THOTH.onLogin = (u) => {
    THOTH.setAuthState(u);

    if (THOTH._mutationEventsReady) {
        THOTH.FE.setupToolboxElements();
        if (THOTH.collaborative) ATON.Photon.connect();
        return;
    }

    // Allow events
    THOTH.Events.setupPhotonEvents();
    THOTH.Events.setupSelectionEvents();
    THOTH.Events.setupModelEvents();
    THOTH.Events.setupMeasurementEvents();
    THOTH.Events.setupSemanticAnnotationEvents();
    if (THOTH.config.toolbox) THOTH.Events.setupToolboxEvents();
    
    // Update FE
    THOTH.FE.setupToolboxElements();
    THOTH._mutationEventsReady = true;
    
    // Join collaborative
    if (THOTH.collaborative) ATON.Photon.connect();
};

