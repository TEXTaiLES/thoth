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
THOTH.collaborative = false;


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
            THOTH.API.setup(data);
            ATON.fire("ConfigLoaded");
        },
        err => ATON.UI.showModal("Error loading config" + err)
    );
};

THOTH.loadScene = async (scene_id) => {
    if (scene_id === undefined) return;

    ATON.SceneHub._bLoading = true;
    console.log("Loading scene: " + THOTH.scene_id)
    
    if (THOTH.API.hasEndpoint("scene")) {
        const response = await THOTH.API.get("scene", {
            scene_id: scene_id
        });

        if (!response.ok) {
            ATON.SceneHub._bLoading = false;
            THOTH.FE?.showToast?.(response.error || "Scene endpoint failed");
            console.error("Scene endpoint failed:", response.error);
            return;
        }

        const scene = THOTH._parseSceneEndpointResponse(response.data);
        if (!scene) {
            ATON.SceneHub._bLoading = false;
            THOTH.FE?.showToast?.("Scene endpoint returned invalid content");
            return;
        }

        ATON.SceneHub.currData = scene;
        ATON.SceneHub.currID = scene_id;
        ATON.SceneHub._bLoading = false;

        ATON.SceneHub.parseScene(scene);
        THOTH._syncAuthUser();
        ATON.fire("SceneJSONLoaded", scene_id);
        return;
    }

    THOTH._loadSceneFallback(scene_id);
};

THOTH._loadSceneFallback = (scene_id) => {
    ATON.SceneHub.load(
        THOTH.config.ATONSceneUrl + scene_id,
        scene_id,
        () => THOTH._syncAuthUser()
    );
};

THOTH._syncAuthUser = () => {
    ATON.REQ.get("user", (u) => {
        if (u === false) THOTH.setAuthState(null);
        else THOTH.onLogin(u);
    });
};

THOTH._parseSceneEndpointResponse = (data) => {
    const rawContent = data?.content ??
        data?.scene?.content ??
        data?.scenes?.[0]?.content ??
        data;

    if (typeof rawContent === "string") {
        try {
            return JSON.parse(rawContent);
        }
        catch (err) {
            console.error("Invalid scene JSON:", err);
            return null;
        }
    }

    if (rawContent && typeof rawContent === "object") return rawContent;

    return null;
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

THOTH.exportChanges = async () => {
    if (!THOTH.requireAuth("export changes")) return;

    console.log("Exporting changes...");

    const payload = THOTH.getExportData();
    const response = THOTH.API.hasEndpoint("scene")
        ? await THOTH._exportSceneEndpoint(payload)
        : await THOTH._exportSceneFallback(payload);

    if (!response.ok) {
        THOTH.FE.showToast(response.error || "Scene export failed");
        return response;
    }

    THOTH.FE.showToast("Scene exported successfully.");
    return response;
};

THOTH.getExportData = () => {
    return {
        models: THOTH.SceneStore.getExportData().models,
        collaborative: THOTH.collaborative === true
    };
};

THOTH.downloadSceneJSON = () => {
    const payload = THOTH.getExportData();
    return THOTH._downloadJSON(
        payload,
        `${THOTH.scene_id || "scene"}.json`,
        "Scene JSON downloaded locally."
    );
};

THOTH._downloadJSON = (payload, filename, message) => {
    const exportJson = JSON.stringify(payload, null, 2);
    const exportBlob = new Blob([exportJson], { type: "application/json" });
    const exportUrl = URL.createObjectURL(exportBlob);
    const exportLink = document.createElement("a");

    exportLink.href = exportUrl;
    exportLink.download = filename;
    exportLink.click();
    URL.revokeObjectURL(exportUrl);

    if (message) THOTH.FE.showToast(message);
    return true;
};

THOTH._exportSceneEndpoint = (payload) => {
    return THOTH.API.put("scene", {
        scene_id: THOTH.scene_id,
        body    : {
            content: payload
        }
    });
};

THOTH._exportSceneFallback = async (payload) => {
    if (!THOTH.scene_id) {
        return {
            ok   : false,
            error: "Missing scene id"
        };
    }

    const sceneUrl = THOTH.config.ATONSceneUrl + THOTH.scene_id;
    const resetResponse = await THOTH._patchAtonScene(sceneUrl, {
        mode: "DEL",
        data: {
            models       : {},
            collaborative: {}
        }
    });
    if (!resetResponse.ok) return resetResponse;

    return THOTH._patchAtonScene(sceneUrl, {
        mode: "ADD",
        data: payload
    });
};

THOTH._patchAtonScene = async (sceneUrl, body) => {
    try {
        const response = await fetch(new URL(sceneUrl, window.location.href).toString(), {
            method : "PATCH",
            headers: THOTH.API._buildHeaders(),
            body   : JSON.stringify(body)
        });
        const contentType = response.headers.get("content-type") || "";
        const data = contentType.includes("application/json")
            ? await response.json()
            : await response.text();

        if (!response.ok) {
            return {
                ok    : false,
                error : data || response.statusText,
                status: response.status
            };
        }

        return {
            ok    : true,
            data  : data,
            status: response.status
        };
    }
    catch (err) {
        return {
            ok   : false,
            error: err?.message || String(err)
        };
    }
};

THOTH.getModelDataExportData = (modelId) => {
    const model = THOTH.SceneStore.getModelExportData(modelId);
    if (!model) return;

    const artefact = model.artefact || {};

    return {
        "artefact.Title": modelId,
        data_type       : "json",
        artefact_data   : {
            artefact_data: {
                "artefact.title"      : artefact.title || modelId,
                "artefact.glb_file"   : artefact.gltf_file || "",
                "artefact.description": artefact.description || "",
                "artefact.owner"      : artefact.owner || "",
                "artefact.keywords"   : Array.isArray(artefact.keywords) ? artefact.keywords : [],
                "artefact.copyright"  : artefact.copyright || ""
            },
            annotations: {
                "artefact.annotations": model.annotations || {}
            },
            sensorial_data: THOTH.getModelSensorialExportData(model),
            artefact_metadata: {
                "artefact.metadata": model.metadata || {}
            }
        }
    };
};

THOTH.getModelSensorialExportData = (model = {}) => {
    const sensors = Array.isArray(model.sensors) ? model.sensors : [];
    if (sensors.length === 0) {
        return {
            related_sensor_id: "",
            latest_reading   : {}
        };
    }

    const sensor = sensors[0];
    if (typeof sensor !== "object" || sensor === null) {
        return {
            related_sensor_id: String(sensor),
            latest_reading   : {}
        };
    }

    return {
        ...sensor,
        related_sensor_id: sensor.related_sensor_id || sensor.sensor_id || sensor.id || "",
        latest_reading   : sensor.latest_reading || {}
    };
};

THOTH.downloadModelData = (modelId) => {
    const payload = THOTH.getModelDataExportData(modelId);
    if (!payload) {
        THOTH.FE.showToast(`No model data found for ${modelId}`);
        return false;
    }

    return THOTH._downloadJSON(
        payload,
        `${modelId || "model"}_artefact_data.json`,
        "Model data downloaded locally."
    );
};

THOTH.exportModelData = async (modelId) => {
    if (!THOTH.requireAuth("export model changes")) {
        return {
            ok   : false,
            error: "Authentication required"
        };
    }

    const payload = THOTH.getModelDataExportData(modelId);
    if (!payload) {
        THOTH.FE.showToast(`No model data found for ${modelId}`);
        return {
            ok   : false,
            error: "No model data found"
        };
    }

    const response = await THOTH.API.putArtefactData(modelId, payload.artefact_data);
    if (!response.ok) {
        THOTH.FE.showToast(response.error || "Model data export failed");
        return response;
    }

    THOTH.FE.showToast("Model data exported successfully!");
    return response;
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

    return THOTH._downloadJSON(
        payload,
        `${modelId || "model"}_metadata.json`,
        "Model metadata downloaded locally."
    );
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

    const response = await THOTH.API.putMetadata(modelId, payload);
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

