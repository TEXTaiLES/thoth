/*===========================================================================

    THOTH
    Event handling

    Author: steliosalvanos@gmail.com

===========================================================================*/
//import * as THREE from "./three/three.module.js";
//import { TransformControls } from "./three/addons/controls/TransformControls.js";
import Models from "./models.js";
import {TransformControls} from "./TransformControls.js";
let Events = {};


Events.setup = () => {
    // Ease of access
    THOTH.on   = ATON.on;
    THOTH.fire = ATON.fire;
    
    THOTH.onPhoton   = ATON.Photon.on;
    THOTH.firePhoton = ATON.Photon.fire;

   // Events.setupTransformControls();
    //Events.setupModelEvents();

    Events.setupInputEL();
    Events.setupActiveEL();
    Events.setupWindowEL();

    Events.setupCollaborativeEvents();
    let transformStart = null;
};


// Event listeners

Events.setupInputEL = () => {
    let el = ATON._renderer.domElement;
    // Mouse down
    el.addEventListener("mousedown", (e) => {
        if (e.button === 0) {
            THOTH.fire("MouseLeftDown");
            THOTH._bLeftMouseDown = true;
        }
        if (e.button === 2) {
            THOTH.fire("MouseRightDown")
            THOTH._bRightMouseDown = true;
        }
    });
    // Mouse up
    el.addEventListener("mouseup", (e) => {
        if (e.button === 0) {
            THOTH.fire("MouseLeftUp");
            THOTH._bLeftMouseDown = false;
        }
        if (e.button === 2) {
            THOTH.fire("MouseRightUp")
            THOTH._bRightMouseDown = false;
        }
    });
    // Mouse move
    el.addEventListener("mousemove", (e) => {
        THOTH.fire("MouseMove", (e));
    });
    // Key down
    window.addEventListener("keydown", (e) => THOTH.fire("KeyDown", (e.code), false));
    // Discard existing keyup event since it doesn't support caps/other languages
    ATON.EventHub.clearEventHandlers("KeyUp");
    // Key up
    window.addEventListener("keyup", (e) => {
        THOTH.fire("KeyUp", (e.code), false);
    });
};

Events.setupActiveEL = () => {
    // Mouse left click
    THOTH.on("MouseLeftDown", () =>{
        // Measure
        if (THOTH.MSR.enabled) {
            THOTH.fire("addMeasurementPoint");
        }
        // Brush
        if (THOTH.Toolbox.brushEnabled) {
            if (!Events.activeLayerExists()) {
                THOTH.FE.showToast("No Layer Selected");
                return;
            }
            if (THOTH.Toolbox.tempSelection !== null) return;
            THOTH.fire("useBrush");
        }
        // Eraser
        if (THOTH.Toolbox.eraserEnabled) {
            if (!Events.activeLayerExists()) {
                THOTH.FE.showToast("No Layer Selected");
                return;
            }
            if (THOTH.Toolbox.tempSelection !== null) return;
            THOTH.fire("useEraser");
        }
        // Lasso
        if (THOTH.Toolbox.lassoEnabled) {
            if (!Events.activeLayerExists()) {
                THOTH.FE.showToast("No Layer Selected");
                return;
            }
            THOTH.fire("startLasso");
        }
    });
    THOTH.on("MouseLeftUp", () => {
        if (!Events.activeLayerExists()) return;
        
        // Brush
        if (THOTH.Toolbox.brushEnabled) {
            THOTH.fire("endBrush");
        }
        // Eraser
        if (THOTH.Toolbox.eraserEnabled) {
            THOTH.fire("endEraser");
        }
        // Lasso
        if (THOTH.Toolbox.lassoEnabled) {
            THOTH.fire("endLassoAdd");
        }
    });
    
    // Mouse right click
    THOTH.on("MouseRightDown", () => {
        // Brush
        if (THOTH.Toolbox.brushEnabled) {
            if (!Events.activeLayerExists()) {
                THOTH.FE.showToast("No Layer Selected");
                return;
            }
            THOTH.fire("startEraser");
        }
        // Eraser
        if (THOTH.Toolbox.eraserEnabled) {
            if (!Events.activeLayerExists()) {
                THOTH.FE.showToast("No Layer Selected");
                return;
            }
            THOTH.fire("startBrush");
        }
        // Lasso
        if (THOTH.Toolbox.lassoEnabled) {
            if (!Events.activeLayerExists()) {
                THOTH.FE.showToast("No Layer Selected");
                return;
            }
            THOTH.fire("startLasso");
        }
    });
    THOTH.on("MouseRightUp", (e) => {
        if (!Events.activeLayerExists()) return;

        // Brush
        if (THOTH.Toolbox.brushEnabled) {
            THOTH.fire("endEraser");
        }
        // Eraser
        if (THOTH.Toolbox.eraserEnabled) {
            THOTH.fire("endBrush");
        }
        // Lasso
        if (THOTH.Toolbox.lassoEnabled) {
            THOTH.fire("endLassoDel");
        }
    });

    // Mouse move
    THOTH.on("MouseMove", (e) => {
        if (!THOTH.Toolbox.enabled && !THOTH.MSR.enabled) return;

        if (e.preventDefault) e.preventDefault();

        THOTH.Toolbox.moveSelector();
        THOTH.Toolbox.getPixelPointerCoords(e);
        
        if (!Events.activeLayerExists()) return;
        
        if (THOTH._bLeftMouseDown) {
            // Brush
            if (THOTH.Toolbox.brushEnabled) {
                THOTH.fire("useBrush");
            }
            // Eraser
            if (THOTH.Toolbox.eraserEnabled) {
                THOTH.fire("useEraser");
            }
            // Lasso
            if (THOTH.Toolbox.lassoEnabled) {
                THOTH.fire("updateLasso");
            }
        }
        
        if (THOTH._bRightMouseDown) {
            // Brush
            if (THOTH.Toolbox.brushEnabled) {
                THOTH.fire("useEraser");
            }
            // Eraser
            if (THOTH.Toolbox.eraserEnabled) {
                THOTH.fire("useBrush");
            }
            // Lasso
            if (THOTH.Toolbox.lassoEnabled) {
                THOTH.fire("updateLasso");
            }
        }
    });
    
    // Key
    THOTH.on("KeyDown", (k) => {
        // Ignore if modal
        if (ATON.UI._bModal) return;

        // History
        if (k === "KeyZ") {
            if (THOTH._bCtrlDown) THOTH.History.undo();
        }
        if (k === "KeyY") {
            if (THOTH._bCtrlDown) THOTH.History.redo();
        }

        // Shift
        if (k === "ShiftLeft") {
            THOTH._bShiftDown = true;
        }
        // Ctrl
        if (k === "ControlLeft") {
            THOTH._bCtrlDown = true;
        }

    });
    THOTH.on("KeyUp", (k) => {
        // Shift
        if (k === "ShiftLeft") {
            THOTH._bShiftDown = false;
        }
        // Ctrl
        if (k === "ControlLeft") {
            THOTH._bCtrlDown = false;
        }

        // Nav
        if (k === "Space") {
            if (THOTH.Toolbox.paused) {
                ATON.Nav.setUserControl(false);
                THOTH.Toolbox.resume();
            }
            if (THOTH.MSR.paused) {
                ATON.Nav.setUserControl(false);
                THOTH.MSR.resume();
            }
        }
    });
};

Events.setupWindowEL = () => {
    let w = window;

    // Resizes
    w.addEventListener('resize', () => {
        ATON.Nav._camera.aspect = w.innerWidth / w.innerHeight;
        ATON.Nav._camera.updateProjectionMatrix();
        ATON._renderer.setSize(w.innerWidth, w.innerHeight);
    }, false);

    w.addEventListener("blur", () => {
        // maybe?
    });
};


// Events

Events.setupMeasurementEvents = () => {
    THOTH.on("selectMeasure", () => {
        THOTH.MSR.activate();
        THOTH.Toolbox.deactivate();
        THOTH.FE.handleElementHighlight('measure', THOTH.FE.toolMap);
        THOTH.FE.handleToolOptions('measure');
       // ATON.Nav.setUserControl(false);
    });
    THOTH.on("addMeasurementPoint", () => {
        if (!THOTH.MSR.enabled || THOTH.MSR.paused) return;
        if (THOTH._queryData === undefined) return;
        
        THOTH.MSR.addMeasurementPoint();
    });
    // Create measurement
    THOTH.on("createMeasurement", () => {
        const msrId = THOTH.Utils.getFirstUnusedKey(THOTH.MSR.msrMap);
        const point1 = THOTH.MSR.points[0];
        const point2 = THOTH.MSR.points[1];

        // Local
        THOTH.MSR.addMeasurement(msrId, point1, point2);
        // Photon
        THOTH.firePhoton("createMeasurement", {
            id    : msrId,
            point1: point1,
            point2: point2
        });
        // History
        THOTH.History.pushAction({
            type  : THOTH.History.ACTIONS.ADD_MEASUREMENT,
            id    : msrId,
            value: {
                point1: point1,
                point2: point2
            }
        });
    });
    THOTH.on("deleteMeasurement", (msrId) => {
        // Local
        THOTH.MSR.deleteMeasurement(msrId);
        // Photon
        THOTH.firePhoton("deleteMeasurement", msrId);
        // History
        THOTH.History.pushAction({
            type : THOTH.History.ACTIONS.DEL_MEASUREMENT,
            id   : msrId,
            value: {
                point1: point1,
                point2: point2,
            }
        }); 
    });
};

Events.setupLayerEvents = () => {
    // Create/Delet
    THOTH.on("createLayer", () => {
        const layerId = THOTH.Utils.getFirstUnusedKey(THOTH.Layers.layerMap);
        // Local
        THOTH.Layers.createLayer(layerId);
        // Photon
        THOTH.firePhoton("createLayer", layerId);
        // History
        THOTH.History.pushAction({
            type: THOTH.History.ACTIONS.CREATE_LAYER,
            id  : layerId
        });
    });
    THOTH.on("deleteLayer", (layerId) => {
        // Local
        THOTH.Layers.deleteLayer(layerId);
        // Photon
        THOTH.firePhoton("deleteLayer", layerId);
        // History
        THOTH.History.pushAction({
            type: THOTH.History.ACTIONS.DELETE_LAYER,
            id  : layerId
        });
    });
    // Edit layer data
    THOTH.on("editLayerMetadata", (l) => {
        const layerId  = l.id;
        const data     = l.data;
        const prevData = l.prevData;
        
        // Local
        THOTH.MD.editLayerMetadata(layerId, data);
        // Photon
        THOTH.firePhoton("editLayerMetadata", ({
            id   : layerId,
            value: data
        }));
        // History
        THOTH.History.pushAction({
            type     : THOTH.History.ACTIONS.EDIT_METADATA_LAYER,
            id       : layerId,
            value    : data,
            prevValue: prevData
        });
    });
    THOTH.on("renameLayer", (l) => {
        const id   = l.id;
        const data = l.data;

        // Local
        THOTH.Layers.renameLayer(id, data);
        // Photon
        THOTH.firePhoton("renameLayer", ({
            id   : id,
            value: data
        }));
        // History
        THOTH.History.pushAction({
            type     : THOTH.History.ACTIONS.RENAME_LAYER,
            id       : l.id,
            value    : l.data,
            prevValue: l.prevData,
        });
    });
    THOTH.on("editSceneMetadata", (l) => {
        const data     = l.data;
        const prevData = l.prevData;

        // Local event
        THOTH.MD.editSceneMetadata(data);
        // Photon event
        THOTH.firePhoton("editSceneMetadata", data);
        // History 
        THOTH.History.pushAction({
            type     : THOTH.History.ACTIONS.EDIT_METADATA_SCENE,
            value    : data,
            prevValue: prevData
        });
    });

    // Layer keybinds
    THOTH.on("KeyDown", (k) => {
        // Ignore if modal
        if (ATON.UI._bModal) return;

        // Layers
        if (k.startsWith("Digit")) {
            const id = Number(k.replace("Digit", ""));
            if (THOTH._bShiftDown) THOTH.UI.modalLayerDetails(id);
            else THOTH.Layers.setActiveLayer(id);
        }
        if (k === "KeyN") {
            if (THOTH._bShiftDown) THOTH.fire("createLayer");
            else THOTH.fire("selectNone");
        }
        if (k === "KeyS") {
            if (THOTH._bShiftDown) THOTH.UI.modalSceneMetadata();
        }
    });
};

Events.setupModelEvents = () => {
    // Keybinds
    THOTH.on("KeyDown", (k) => {
        // Ignore if modal
        if (ATON.UI._bModal) return;

        // Models
        if (k === "KeyA") {
            if (THOTH._bShiftDown) THOTH.UI.modalAddModel();
        }
        if (k === "KeyE") {
            if (THOTH._bShiftDown) THOTH.UI.modalExport();
        }
    });

    // Add/Delete
    THOTH.on("addModel", (id) => {
        // Local
        THOTH.Models.addModelFromURL(id);
        // Photon
        THOTH.firePhoton("addModel", id);
        // History
        THOTH.History.pushAction({
            type: THOTH.History.ACTIONS.ADD_MODEL,
            id  : id
        });
    });
    THOTH.on("deleteModel", (id) => {
        // Local
        THOTH.Models.deleteModel(id);
        // Photon
        THOTH.firePhoton("deleteModels", id);
        // History
        THOTH.History.pushAction({
            type: THOTH.History.ACTIONS.DEL_MODEL,
            id  : id
        });
    });
    // Transform
    THOTH.on("modelTransformPos", (l) => {
        const pos = THOTH.Models.modelMap.get(l.modelName).position
        const prevValue = {
            x: pos.x,
            y: pos.y,
            z: pos.z
        };
        // Local
        THOTH.Models.modelTransformPos(l.modelName, l.value);
        // Photon
        THOTH.firePhoton("modelTransformPos", (l));
        // History
        THOTH.History.pushAction({
            type     : THOTH.History.ACTIONS.TRANSFORM_MODEL_POS,
            id       : l.modelName,
            value    : l.value,
            prevValue: prevValue
        });
    }); 
    THOTH.on("modelTransformRot", (l) => {
        const rot = THOTH.Models.modelMap.get(l.modelName).rotation;
        const prevValue = {
            x: rot.x,
            y: rot.y,
            z: rot.z
        };
        // Local
        THOTH.Models.modelTransformRot(l.modelName, l.value);
        // Photon
        THOTH.firePhoton("modelTransformRot", (l));
        // History
        THOTH.History.pushAction({
            type     : THOTH.History.ACTIONS.TRANSFORM_MODEL_ROT,
            id       : l.modelName,
            value    : l.value,
            prevValue: prevValue
        });
    }); 
    //select model
    THOTH.on("selectModel", (modelName) => {
        const selmodel  = THOTH.Models.modelMap.get(modelName);
        if (!selmodel) {
            console.warn("model not found");
        return;
        }    
        if (!THOTH.transform) {
            THOTH.Models.addTransformControls(modelName);
            Events.setupTransformControls(modelName);
            //Disable camera controls while dragging
            THOTH.transform.addEventListener("dragging-changed", (event) => {
            ATON.Nav._controls.enabled = !event.value;
            });
        }
        //THOTH.transform.attach(selmodel.children[0]);
        THOTH.transform.attach(selmodel);
        //prevent it from being hidden inside geometry
        THOTH.transform.traverse(o => {
            if (o.material) {
                o.material.depthTest = false;
                o.material.transparent = false;
                o.material.opacity = 1;
            }
        });
        THOTH.transform.visible = true;
        THOTH.transform.setSize(1,1,1);
        THOTH.transform.updateMatrixWorld(true);
    });
};
//
Events.setupTransformControls = (ModelName) => {

    //let transformStart = null;

    THOTH.transform.addEventListener("mouseDown", () => {

        const obj = THOTH.transform.object;
        if (!obj) return;

        Events.transformStart = {
            position: {
                x: obj.position.x,
                y: obj.position.y,
                z: obj.position.z
            },
            rotation: {
                x: obj.rotation.x,
                y: obj.rotation.y,
                z: obj.rotation.z
            }
        };
    });

    THOTH.transform.addEventListener("change", () => {

        const obj = THOTH.transform.object;
        if (!obj) return;

        THOTH.UI.syncTransformUI(obj);
    });

    //MUSTFIX: HISTORY PUSHES AND UNDO DURING DRAGGING

    THOTH.transform.addEventListener("mouseUp", () => {

    const obj = THOTH.transform.object;
    if (!obj || !Events.transformStart) return;
   // if (!obj) return;

    const modelName = obj.name;
    const mode = THOTH.transform.getMode();

    if (mode === "translate") {

        const newPos = {
            x: obj.position.x,
            y: obj.position.y,
            z: obj.position.z
        };

        THOTH.Models.modelTransformPos(modelName, newPos);

        THOTH.firePhoton("modelTransformPos", {
            modelName: modelName,
            value: newPos
        });

        THOTH.History.pushAction({
            type: THOTH.History.ACTIONS.TRANSFORM_MODEL_POS,
            id: modelName,
            value: newPos,
            prevValue: Events.transformStart.position
        });

    }
    if (mode === "rotate") {

        const newRot = {
            x: obj.rotation.x,
            y: obj.rotation.y,
            z: obj.rotation.z
        };

        THOTH.Models.modelTransformRot(modelName, newRot);

        THOTH.firePhoton("modelTransformRot", {
            modelName: modelName,
            value: newRot
        });

        THOTH.History.pushAction({
            type: THOTH.History.ACTIONS.TRANSFORM_MODEL_ROT,
            id: modelName,
            value: newRot,
            prevValue: Events.transformStart.rotation
        });
    }
    console.log("History push:", Events.transformStart, obj.position);
    Events.transformStart = null;

});

};
Events.setupToolboxEvents = () => {
    // Resize
    window.addEventListener('resize', () => {
        THOTH.Toolbox.resizeLassoCanvas();
    }, false);

    // Keybinds
    THOTH.on("KeyDown", (k) => {
        if (ATON.UI._bModal) return;

        // Tools
        if (k === "KeyM") {
            THOTH.fire("selectMeasure");
        }
        if (k === "KeyB") {
            THOTH.fire("selectBrush");
        }
        if (k === "KeyE") {
            THOTH.fire("selectEraser");
        }
        if (k === "KeyL") {
            THOTH.fire("selectLasso");
        }
        if (k === "BracketLeft") {
            THOTH.Toolbox.decreaseSelectorSize();
            // Todo update the ui as well
        }
        if (k === "BracketRight") {
            THOTH.Toolbox.increaseSelectorSize();
        }

        if (k === "Space") {
            if (THOTH.Toolbox.enabled || THOTH.MSR.enabled) {
                ATON.Nav.setUserControl(true);

                THOTH.Toolbox.pause();
                THOTH.Toolbox.cleanupLasso();

                THOTH.MSR.pause();
                THOTH.MSR.clearMeasurementPoints();
            }
        }
    });
    THOTH.on("KeyUp", (k) => {
        if (k === "Space") {
            if (THOTH.Toolbox.paused) {
                ATON.Nav.setUserControl(false);
                THOTH.Toolbox.resume();
            }
            if (THOTH.MSR.paused) {
                ATON.Nav.setUserControl(false);
                THOTH.MSR.resume();
            }
        }
    });
    
    // Select tool
    THOTH.on("selectBrush", () => {
        THOTH.Toolbox.activateBrush();
        THOTH.MSR.deactivate();
        ATON.Nav.setUserControl(false);
        THOTH.FE.handleToolOptions('brush');
        THOTH.FE.handleElementHighlight('brush', THOTH.FE.toolMap);
    });
    THOTH.on("selectEraser", () => {
        THOTH.Toolbox.activateEraser();
        THOTH.MSR.deactivate();
        ATON.Nav.setUserControl(false);
        THOTH.FE.handleToolOptions('eraser');
        THOTH.FE.handleElementHighlight('eraser', THOTH.FE.toolMap);
    });
    THOTH.on("selectLasso", () => {
        THOTH.Toolbox.activateLasso();
        THOTH.MSR.deactivate();
        ATON.Nav.setUserControl(false);
        THOTH.FE.handleToolOptions('lasso');
        THOTH.FE.handleElementHighlight('lasso', THOTH.FE.toolMap);
    });
    THOTH.on("selectNone", () => {
        THOTH.Toolbox.deactivate();
        THOTH.MSR.deactivate();
        ATON.Nav.setUserControl(true);
        THOTH.FE.handleToolOptions('no_tool');
        THOTH.FE.handleElementHighlight('no_tool', THOTH.FE.toolMap);
    });

    // Use tool
    THOTH.on("useBrush", () => {
        if (!THOTH.Toolbox.enabled || THOTH.Toolbox.paused) return;
        
        if (THOTH.Toolbox.tempSelection === null) {
            THOTH.Toolbox.tempSelection = {};
        }
        
        if (THOTH._queryData === undefined) return;
        
        THOTH.Toolbox.brushActive();
    });
    THOTH.on("endBrush", () => {
        if (!THOTH.Toolbox.enabled || THOTH.Toolbox.paused) return;
        if (THOTH.Toolbox.tempSelection === null) return;
        
        // Get only faces that don't already belong to layer
        const layerId   = THOTH.Layers.activeLayer.id;
        const selection = THOTH.Toolbox.endBrush();
        
        if (Object.keys(selection).length === 0) return;

        // Local
        THOTH.Layers.addToSelection(layerId, selection);
        // Photon
        THOTH.firePhoton("addToSelection", {
            id       : layerId,
            selection: selection
        });
        // History
        THOTH.History.pushAction({
            type : THOTH.History.ACTIONS.SELEC_ADD,
            id   : layerId,
            value: selection
        });

        THOTH.Toolbox.tempSelection = null;
    });
    THOTH.on("startLasso", () => {
        if (!THOTH.Toolbox.enabled || THOTH.Toolbox.paused) return;
        THOTH.Toolbox.startLasso();
    });
    THOTH.on("updateLasso", () => {
        if (!THOTH.Toolbox.enabled || THOTH.Toolbox.paused) return;
        THOTH.Toolbox.updateLasso();
    });

    // End tool
    THOTH.on("useEraser", () => {
        if (!THOTH.Toolbox.enabled || THOTH.Toolbox.paused) return;
        if (THOTH.Toolbox.tempSelection === null) {
            THOTH.Toolbox.tempSelection = {};
        }

        if (THOTH._queryData === undefined) return;

        THOTH.Toolbox.eraserActive();
    })
    THOTH.on("endEraser", () => {
        if (!THOTH.Toolbox.enabled || THOTH.Toolbox.paused) return;
        if (THOTH.Toolbox.tempSelection === null) return;
        
        // Get only faces that don't already belong to layer
        const layerId   = THOTH.Layers.activeLayer.id;
        const selection = THOTH.Toolbox.endEraser();
        
        // Return if selection is empty
        if (Object.keys(selection).length === 0) return;
        
        // Local
        THOTH.Layers.delFromSelection(layerId, selection);
        // Photon
        THOTH.firePhoton("delFromSelection", {
            id       : layerId,
            selection: selection
        });
        // History
        THOTH.History.pushAction({
            type : THOTH.History.ACTIONS.SELEC_DEL,
            id   : layerId,
            value: selection
        });

        THOTH.Toolbox.tempSelection = null;
    });
    THOTH.on("endLassoAdd", (l) => {
        if (!THOTH.Toolbox.enabled || THOTH.Toolbox.paused) return;

        const layerId   = THOTH.Layers.activeLayer.id;
        const selection = THOTH.Toolbox.endLassoAdd();

        if (Object.keys(selection).length === 0) return;

        // Local
        THOTH.Layers.addToSelection(layerId, selection);
        // Photon
        THOTH.firePhoton("addToSelection", {
            id       : layerId,
            selection: selection
        });
        // History
        THOTH.History.pushAction({
            type : THOTH.History.ACTIONS.SELEC_ADD,
            id   : layerId,
            value: selection
        });

        THOTH.Toolbox.tempSelection = null;
    });
    THOTH.on("endLassoDel", (l) => {
        if (!THOTH.Toolbox.enabled || THOTH.Toolbox.paused) return;

        const layerId   = THOTH.Layers.activeLayer.id;
        const selection = THOTH.Toolbox.endLassoDel();

        if (Object.keys(selection).length === 0) return;

        // Local
        THOTH.Layers.delFromSelection(layerId, selection);
        // Photon
        THOTH.firePhoton("delFromSelection", {
            id       : layerId,
            selection: selection
        });
        // History
        THOTH.History.pushAction({
            type : THOTH.History.ACTIONS.SELEC_DEL,
            id   : layerId,
            value: selection
        });

        THOTH.Toolbox.tempSelection = null;
    });
    THOTH.on("endAllToolOps", () => {
        THOTH.fire("endLasso");
    });
};

Events.setupPhotonEvents = () => {
    // Layer
    THOTH.onPhoton("createLayer", (layerId) => {
        THOTH.Layers.createLayer(layerId);
    });
    THOTH.onPhoton("deleteLayer", (layerId) => {
        THOTH.Layers.deleteLayer(layerId);
    });
    THOTH.onPhoton("editSceneMetadata", (data) => {
        THOTH.MD.editSceneMetadata(data);
    });
    THOTH.onPhoton("editLayerMetadata", (l) => {
        THOTH.MD.editLayerMetadata(l.id, l.value);
    });
    THOTH.onPhoton("addToSelection", (l) => {
        THOTH.Layers.addToSelection(l.id, l.selection);
    });
    THOTH.onPhoton("delFromSelection", (l) => {
        THOTH.Layers.delFromSelection(l.id, l.selection);
    });
    THOTH.onPhoton("renameLayer", (l) => {
        THOTH.Layers.renameLayer(l.id, l.data);
    });

    // Model
    THOTH.onPhoton("addModel", (id) => {
        THOTH.Models.addModelFromURL(id);
    });
    THOTH.onPhoton("deleteModel", (id) => {
        THOTH.Models.deleteModel(id);
    });
    THOTH.onPhoton("modelTransformPos", (l) => {
        THOTH.Models.modelTransformPos(l.modelName, l.value);
    });
    THOTH.onPhoton("modelTransformRot", (l) => {
        THOTH.Models.modelTransformRot(l.modelName, l.value);
    });

    // Measurements
    THOTH.onPhoton("createMeasurement", (l) => {
        THOTH.MSR.createMeasurement(l.id, l.point1, l.point2);
    });
    THOTH.onPhoton("deleteMeasurement", (l) => {
        THOTH.MSR.deleteMeasurement(l.id);
    });
};


// Collaborative

Events.setupCollaborativeEvents = () => {
    // On other user login
    THOTH.on("VRC_UserEnter", () => {
        const currData = THOTH.getExportData();
        THOTH.firePhoton("syncScene", (currData));
    });
    // Sync scene on login to existing 
    THOTH.onPhoton("syncScene", currData => {
        THOTH.Collab.syncScene(currData);
    });
};


// Utils

Events.activeLayerExists = () => {
    if (THOTH.Layers.activeLayer === undefined) return false;
    else return true;
};
/*
//set up tranfosrm controls
Events.setupTransformControls = () => {

    const camera   = ATON.Nav._camera;
    const renderer = ATON._renderer;
    const scene    = ATON._scene; // or whatever ATON uses internally

    Events.transformControls = new TransformControls(
        camera,
        renderer.domElement
    );

    scene.add(Events.transformControls);

    // Disable nav while dragging
    Events.transformControls.addEventListener('dragging-changed', (e) => {
        ATON.Nav.setUserControl(!e.value);
    });

    // When object changes
    Events.transformControls.addEventListener('objectChange', () => {
        const object = Events.transformControls.object;
        if (!object) return;

        const modelName = object.name;

        THOTH.fire("modelTransformPos", {
            modelName,
            value: {
                x: object.position.x,
                y: object.position.y,
                z: object.position.z
            }
        });

        THOTH.fire("modelTransformRot", {
            modelName,
            value: {
                x: object.rotation.x,
                y: object.rotation.y,
                z: object.rotation.z
            }
        });
    });
};

*/


export default Events;