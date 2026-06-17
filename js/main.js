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


THOTH.scene_id = THOTH.params.get('scene_id');


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
    THOTH.loadConfig();

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
            THOTH.Toolbox.setup();
            // Init measurements
            THOTH.MSR.setup();
            // Init semantic annotations
            THOTH.SemAnnotations.setup();
            // Init front end 
            THOTH.FE.setup();
            THOTH.FE.setupToolboxElements();
            
            // Load scene
            THOTH.loadScene(THOTH.scene_id)
        })
    })
};

THOTH.loadConfig = () => {
    ATON.REQ.get(
        "../../a/thoth/config.json",
        data => {
            THOTH.config = data;
            THOTH.API.setup(data.endpoints);
            ATON.fire("ConfigLoaded");
        },
        err => ATON.UI.showModal("Error loading config" + err)
    );
};

THOTH.loadScene = (scene_id) => {
    if (scene_id === undefined) return;

    ATON.SceneHub._bLoading = true;
    console.log("Loading scene: " + THOTH.scene_id)
    
    if (THOTH.API.scene /*change to correct variable*/) {
        fetch(endpoint, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${THOTH.config.authKey}`,
                "Accept"       : "application/json"
            }
        })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            return response.json()
        })
        .then(data => {
            console.log(data)
            const scene = JSON.parse(data.scenes[0].content)
            
            ATON.SceneHub.currData = scene;
            ATON.SceneHub.currID = scene_id;
            ATON.SceneHub._bLoading = false;
    
            ATON.SceneHub.parseScene(scene);
    
            ATON.REQ.get("user", (u) => {
                if (u === false) THOTH.setAuthState(null);
                else THOTH.onLogin(u);
            })
            ATON.fire("SceneJSONLoaded", scene_id);
        })
        .catch(err => {
            console.error("Fetch error:", err)
        });        
    }
    else {
        ATON.SceneHub.load(
            THOTH.config.ATONSceneUrl + THOTH.scene_id,
            THOTH.scene_id,
            () => {
                ATON.REQ.get("user", (u) => {
                    if (u === false) THOTH.setAuthState(null);
                    else THOTH.onLogin(u);
                });
            }
        );
    }
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
    exportLink.download = `${THOTH.scene_id || "scene"}.json`;
    exportLink.click();
    URL.revokeObjectURL(exportUrl);
    THOTH.FE.showToast("Scene JSON downloaded locally.");
};

THOTH.getExportData = () => {
    return {
        models: THOTH.SceneStore.getExportData().models,
        collaborative: THOTH.collaborative
    };
};

THOTH.getModelMetadataExportData = (modelId) => {
    return THOTH.SceneStore.getModelMetadataExportData(modelId);
};

THOTH.downloadModelMetadata = (modelId) => {
    const payload = THOTH.getModelMetadataExportData(modelId);
    if (!payload) {
        THOTH.FE.showToast(`No metadata found for ${modelId}`);
        return false;
    }

    const exportJson = JSON.stringify(payload, null, 2);
    const exportBlob = new Blob([exportJson], { type: "application/json" });
    const exportUrl = URL.createObjectURL(exportBlob);
    const exportLink = document.createElement("a");

    exportLink.href = exportUrl;
    exportLink.download = `${modelId || "model"}_metadata.json`;
    exportLink.click();
    URL.revokeObjectURL(exportUrl);
    THOTH.FE.showToast("Model metadata downloaded locally.");

    return true;
};

THOTH.exportModelMetadata = async (modelId) => {
    const payload = THOTH.getModelMetadataExportData(modelId);
    if (!payload) {
        THOTH.FE.showToast(`No metadata found for ${modelId}`);
        return {
            ok   : false,
            error: "No metadata found"
        };
    }

    const response = await THOTH.API.post("metadata", payload);
    if (!response.ok) {
        THOTH.FE.showToast(response.error || "Metadata export failed");
        return response;
    }

    THOTH.FE.showToast("Metadata exported successfully!");
    return response;
};


// User 

THOTH.onLogin = (u) => {
    THOTH.setAuthState(u);

    // Allow events
    THOTH.Events.setupPhotonEvents();
    THOTH.Events.setupSelectionEvents();
    THOTH.Events.setupModelEvents();
    THOTH.Events.setupMeasurementEvents();
    THOTH.Events.setupSemanticAnnotationEvents();
    THOTH.Events.setupToolboxEvents();
    
    // Update FE
    THOTH.FE.setupToolboxElements();
    
    // Join collaborative
    if (THOTH.collaborative) ATON.Photon.connect();
};

