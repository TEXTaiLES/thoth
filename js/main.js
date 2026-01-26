/*===========================================================================

    THOTH
    Launch Point

    Author: steliosalvanos@gmail.com

===========================================================================*/
import UI from "./src/ui.js";
import Utils from "./src/utils.js";
import Toolbox from "./src/toolbox.js";
import History from "./src/history.js";
import Events from "./src/events.js";
import SVP from "./src/svp.js";
import Layers from "./src/layers.js";
import Models from "./src/models.js";
import FE from "./src/fe.js";
import MD from "./src/metadata.js";
import Collab from "./src/collab.js";
import MSR from "./src/measurements.js";


// Realize 
let THOTH = ATON.App.realize();
window.THOTH = THOTH;


// Import
THOTH.UI      = UI;
THOTH.Utils   = Utils;
THOTH.Toolbox = Toolbox;
THOTH.History = History;
THOTH.Events  = Events;
THOTH.SVP     = SVP;
THOTH.Models  = Models;
THOTH.Layers  = Layers;
THOTH.FE      = FE;
THOTH.MD      = MD;
THOTH.Collab  = Collab;
THOTH.MSR     = MSR;


THOTH.BASE_URL        = "../thoth";
THOTH.PATH_RES_ICONS  = `${THOTH.BASE_URL}/js/res/icons/`;
THOTH.PATH_RES_SCHEMA = `${THOTH.BASE_URL}/js/res/schema/`;


THOTH.sid = THOTH.params.get('s');
THOTH.mid = THOTH.params.get('m');
// THOTH.oid = THOTH.params.get('id');



// Init 

THOTH.setup = () => {
    // Realize base ATON and add base UI events
    ATON.realize();
    ATON.UI.addBasicEvents();
    
    // Model parser
    ATON.SceneHub.addSceneParser("scenegraph", scenegraph => {
        THOTH.Models.parseSceneGraph(scenegraph)
    });
    // Layer parsers
    ATON.SceneHub.addSceneParser("layers", layers => {
        THOTH.Layers.parseLayers(layers);
    });
    // Metadata parser
    ATON.SceneHub.addSceneParser("sceneMetadata", data => {
        THOTH.MD.parseSceneMetadata(data);
    });
    // Measurement parser
    ATON.SceneHub.addSceneParser("measurements", measurements => {
        THOTH.MSR.parseMeasurements(measurements);
    });

    // Load config
    ATON.REQ.get(
        "../../a/thoth/config.json",
        data => {
            THOTH.config = data;
            ATON.fire("ConfigLoaded");
        },
        err => ATON.UI.showModal("Error loading schema" + err)
    );
    
    ATON.SceneHub.addSceneParser("scenegraph", scenegraph => {
        THOTH.Models.parseSceneGraph(scenegraph)
    });
    // Init layers
    ATON.SceneHub.addSceneParser("layers", layers => {
        THOTH.Layers.parseLayers(layers);
    });
    // Init scene metadata
    ATON.SceneHub.addSceneParser("sceneMetadata", data => {
        THOTH.MD.parseSceneMetadata(data);
    });
    // Init collaborative
    ATON.SceneHub.addSceneParser("collaborative", data => {
        THOTH.Collab.parseCollab(data);
    });

    ATON.on("AllFlaresReady", () =>{
        ATON.on("ConfigLoaded", () => {
            // Init layers
            THOTH.Layers.setup();
            // Init models
            THOTH.Models.setup();
            // Init metadata
            THOTH.MD.setup();
            // Init history
            THOTH.History.setup();
            // Init events
            THOTH.Events.setup();
            // Init toolbox
            THOTH.Toolbox.setup(THOTH.config.toolboxDefaults);
            // Init measurements
            THOTH.MSR.setup();
            // Init front end 
            THOTH.FE.setup();

            // if (THOTH.oid) {
            //     get({



            //     }).then(scene)
            // }
            
            if (THOTH.sid) {
                ATON.SceneHub.load(
                    THOTH.config.baseSceneUrl + THOTH.sid,
                    THOTH.sid,
                    () => {
                        THOTH.initData = ATON.SceneHub.currData;
                        ATON.REQ.get("user", (u) => {
                            if (u === false) THOTH.UI.modalUser();
                            else THOTH.onLogin(u);
                        });
                    }
                );
            }
            else if (THOTH.mid) {
                //
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

THOTH.highlightAllLayers = () => {
    // All layers
    for (const [ , layer] of THOTH.Layers.layerMap) {
        if (layer.trash) return;
        if (layer.visible === false) return;
        
        const selection      = layer.selection;
        const highlightColor = THOTH.Utils.hex2rgb(layer.highlightColor);
        for (const modelName of Object.keys(selection)) {
            for (const meshName of Object.keys(selection[modelName])) {
                THOTH.highlightSelection(
                    selection[modelName][meshName],
                    highlightColor,
                    modelName,
                    meshName
                );
            }
        }
    }
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
    THOTH.highlightAllLayers();
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
    console.log("Exporting changes...");

    let A = THOTH.getExportData();
    
    // Remove all annotation objects and ADD them again with changes
    ATON.REQ.patch(
        THOTH.config.baseSceneUrl + THOTH.sid,
        {
            data: THOTH.initData,
            mode: "DEL"
        },
        () => {},
        err => {
            console.log(err);
            return;
        } 
    );

    // Patch changes
    ATON.REQ.patch(
        THOTH.config.baseSceneUrl + THOTH.sid,
        {
            data: A,
            mode: "ADD"
        }, 
        () => {
            THOTH.FE.showToast("Changes exported successfully!")
            // Update for next export;
            THOTH.initData = A;
        },
        (err) => console.log(err)
    )

};

THOTH.exportToHestia = async () => {
    console.log("Exporting to Hestia");

    const endpoint = THOTH.config.endpoint;
    const token    = THOTH.config.token;

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
    let A = structuredClone(THOTH.initData);
    console.log(A)
    // Model data
    A.scenegraph = THOTH.Models.getExportData();
    // Layer data
    A.layers = THOTH.Layers.getExportData();
    // Scene metadata
    A.sceneMetadata = structuredClone(THOTH.sceneMetadata);

    return A;
};


// User 

THOTH.onLogin = (u) => {
    // Allow events
    THOTH.Events.setupPhotonEvents();
    THOTH.Events.setupLayerEvents();
    THOTH.Events.setupModelEvents();
    THOTH.Events.setupMeasurementEvents();
    if (THOTH.config.toolbox) THOTH.Events.setupToolboxEvents();
    
    // Update FE
    THOTH.FE.setupToolboxElements();
    
    // Join collaborative
    if (THOTH.collaborative) ATON.Photon.connect();
};
