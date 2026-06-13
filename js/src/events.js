/*===========================================================================

    THOTH
    Event handling

    Authors: 
        Stelios Alvanos (steliosalvanos@gmail.com)

===========================================================================*/
let Events = {};

Events.authRequiredEvents = new Map([
    [ "addModel", "import models" ],
    [ "deleteModel", "delete models" ],
    [ "modelTransformPos", "edit transforms" ],
    [ "modelTransformRot", "edit transforms" ],
    [ "modelTransformScale", "edit transforms" ],
    [ "createLayer", "create selections" ],
    [ "deleteLayer", "delete selections" ],
    [ "editLayerMetadata", "edit metadata" ],
    [ "renameLayer", "edit selections" ],
    [ "editSceneMetadata", "edit metadata" ],
    [ "selectMeasure", "create measurements" ],
    [ "addMeasurementPoint", "create measurements" ],
    [ "createMeasurement", "create measurements" ],
    [ "deleteMeasurement", "delete measurements" ],
    [ "renameMeasurement", "edit measurements" ],
    [ "toggleMeasurementVisibility", "edit measurements" ],
    [ "editMeasurement", "edit measurements" ],
    [ "selectSemanticAnnotation", "create semantic annotations" ],
    [ "addSemanticAnnotationPoint", "create semantic annotations" ],
    [ "createSemanticAnnotation", "create semantic annotations" ],
    [ "updateSemanticAnnotation", "edit semantic annotations" ],
    [ "deleteSemanticAnnotation", "delete semantic annotations" ],
    [ "toggleSemanticAnnotationVisibility", "edit semantic annotations" ],
    [ "selectBrush", "edit selections" ],
    [ "selectEraser", "edit selections" ],
    [ "selectLasso", "edit selections" ],
    [ "useBrush", "edit selections" ],
    [ "endBrush", "edit selections" ],
    [ "startBrush", "edit selections" ],
    [ "useEraser", "edit selections" ],
    [ "endEraser", "edit selections" ],
    [ "startEraser", "edit selections" ],
    [ "startLasso", "edit selections" ],
    [ "updateLasso", "edit selections" ],
    [ "endLassoAdd", "edit selections" ],
    [ "endLassoDel", "edit selections" ],
    [ "endAllToolOps", "edit selections" ]
]);


Events.clone = (value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;

    return structuredClone(value);
};

Events.getDefaultModelId = () => {
    if (THOTH.hoveredModel) return THOTH.hoveredModel;
    if (THOTH.Models?.modelMap?.size > 0) return THOTH.Models.modelMap.keys().next().value;

    return undefined;
};

Events.getPointModelId = (point) => {
    return point?.meshId || Events.getDefaultModelId();
};

Events.getLayerData = (layerId) => {
    return Events.clone(THOTH.Layers.layerMap.get(layerId));
};

Events.mergeSelection = (baseSelection = {}, selection = {}, mode = "add") => {
    const nextSelection = Events.clone(baseSelection) || {};

    for (const modelName of Object.keys(selection)) {
        nextSelection[modelName] = nextSelection[modelName] || {};

        for (const meshName of Object.keys(selection[modelName])) {
            const currentFaces = nextSelection[modelName][meshName] || [];
            const incomingFaces = selection[modelName][meshName] || [];

            if (mode === "delete") {
                const incomingSet = new Set(incomingFaces);
                nextSelection[modelName][meshName] = currentFaces.filter(face => !incomingSet.has(face));
            }
            else {
                nextSelection[modelName][meshName] = Array.from(
                    new Set([...currentFaces, ...incomingFaces])
                );
            }
        }
    }

    return nextSelection;
};

Events.applySelectionEdit = (layerId, selection, mode) => {
    const prevData = Events.getLayerData(layerId);
    if (!prevData) return;

    const data = {
        ...prevData,
        selection: Events.mergeSelection(prevData.selection, selection, mode)
    };

    Events.applyLocal("selection.update", {
        model_id  : Object.keys(selection)[0] || Events.getDefaultModelId(),
        collection: "selections",
        item_id   : layerId,
        field     : "selection"
    }, data, prevData);
};

Events.getMeasurementData = (measurementId) => {
    return Events.clone(THOTH.MSR.msrMap.get(measurementId));
};

Events.getSemanticAnnotationData = (annotationId) => {
    return THOTH.SemAnnotations.cloneAnnotation(
        THOTH.SemAnnotations.semMap.get(annotationId)
    );
};

Events.getAnnotationModelId = (modality, annotationId, fallbackModelId) => {
    return THOTH.Annotations?.getModelId(modality, annotationId) || fallbackModelId || Events.getDefaultModelId();
};

Events.applyLocal = (type, target, value, prevValue) => {
    const operation = THOTH.Ops.makeOperation(type, target, value, prevValue);
    THOTH.Ops.applyLocal(operation);
};


Events.setup = () => {
    // Ease of access
    THOTH.on   = ATON.on;
    THOTH.fire = Events.fireWithAuth;
    
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

Events.fireWithAuth = (eventName, data, immediate) => {
    const actionName = Events.authRequiredEvents.get(eventName);
    if (actionName && !THOTH.requireAuth(actionName)) return false;

    return ATON.fire(eventName, data, immediate);
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
        // Semantic annotations
        if (THOTH.SemAnnotations.enabled) {
            THOTH.fire("addSemanticAnnotationPoint");
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
        if (!THOTH.Toolbox.enabled && !THOTH.MSR.enabled && !THOTH.SemAnnotations.enabled) return;

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
            if (THOTH._bCtrlDown) THOTH.requireAuth("undo changes", () => THOTH.History.undo());
        }
        if (k === "KeyY") {
            if (THOTH._bCtrlDown) THOTH.requireAuth("redo changes", () => THOTH.History.redo());
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
            if (THOTH.SemAnnotations.paused) {
                ATON.Nav.setUserControl(false);
                THOTH.SemAnnotations.resume();
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
        THOTH.SemAnnotations.deactivate();
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

        Events.applyLocal("measurement.create", {
            model_id  : Events.getPointModelId(point1),
            collection: "measurements",
            item_id   : msrId
        }, {
            id          : msrId,
            point1      : point1,
            point2      : point2,
            points      : [point1, point2],
            distanceType: THOTH.MSR.distanceType
        });
    });

    THOTH.on("deleteMeasurement", (data) => {
        const id = data.id;
        const measurement = Events.getMeasurementData(id);
        if (!measurement) return;

        Events.applyLocal("measurement.delete", {
            model_id  : Events.getPointModelId(measurement.points?.[0] || data.point1),
            collection: "measurements",
            item_id   : id
        }, null, measurement);
    });

    THOTH.on("renameMeasurement", (l) => {
        const prevData = Events.getMeasurementData(l.id);
        if (!prevData) return;

        const data = {
            ...prevData,
            name: l.value
        };

        Events.applyLocal("measurement.update", {
            model_id  : Events.getPointModelId(data.points?.[0]),
            collection: "measurements",
            item_id   : l.id,
            field     : "name"
        }, data, prevData);
    });

    THOTH.on("editMeasurement", (l) => {
        const id = l.id;
        const prevData = l.prevData || Events.getMeasurementData(id);
        if (!prevData) return;

        const data = THOTH.Annotations?.normalize({
            ...prevData,
            ...l.data,
            id: id
        }) || {
            ...prevData,
            ...l.data,
            id: id
        };

        Events.applyLocal("measurement.update", {
            model_id  : Events.getAnnotationModelId("measurements", id, Events.getPointModelId(data.points?.[0])),
            collection: "measurements",
            item_id   : id
        }, data, prevData);
    });

    THOTH.on("toggleMeasurementVisibility", (measurementId) => {
        const prevData = Events.getMeasurementData(measurementId);
        if (!prevData) return;

        const data = {
            ...prevData,
            visible: prevData.visible === false
        };

        Events.applyLocal("measurement.update", {
            model_id  : Events.getAnnotationModelId("measurements", measurementId, Events.getPointModelId(prevData.points?.[0])),
            collection: "measurements",
            item_id   : measurementId,
            field     : "visible"
        }, data, prevData);
    });
};

Events.setupSemanticAnnotationEvents = () => {
    THOTH.on("selectSemanticAnnotation", () => {
        THOTH.SemAnnotations.activate();
        THOTH.Toolbox.deactivate();
        THOTH.MSR.deactivate();
        ATON.Nav.setUserControl(false);
        THOTH.FE.handleElementHighlight("semantic", THOTH.FE.toolMap);
        THOTH.FE.handleToolOptions("semantic");
    });

    THOTH.on("addSemanticAnnotationPoint", () => {
        if (!THOTH.SemAnnotations.enabled || THOTH.SemAnnotations.paused) return;
        if (THOTH._queryData === undefined) return;

        const point = THOTH.SemAnnotations.createPointFromHit();
        if (!point) return;

        const annotationId = THOTH.Utils.getFirstUnusedKey(THOTH.SemAnnotations.semMap);
        const annotation = THOTH.SemAnnotations.createAnnotationData(annotationId, point);

        THOTH.SemAnnotations.addTempAnnotationSem(point);
        THOTH.UI.modalSemAnnotationDetails(annotationId, annotation, {
            isNew: true
        });
    });

    THOTH.on("createSemanticAnnotation", (l) => {
        Events.applyLocal("semantic_annotation.create", {
            model_id  : Events.getPointModelId(l.data?.point),
            collection: "semantic_annotations",
            item_id   : l.id
        }, l.data);
    });

    THOTH.on("updateSemanticAnnotation", (l) => {
        const prevData = l.prevData || THOTH.SemAnnotations.cloneAnnotation(THOTH.SemAnnotations.semMap.get(l.id));
        if (!prevData) return;

        Events.applyLocal("semantic_annotation.update", {
            model_id  : Events.getAnnotationModelId("semantic_annotations", l.id, Events.getPointModelId(l.data?.point || prevData.point)),
            collection: "semantic_annotations",
            item_id   : l.id
        }, THOTH.SemAnnotations.cloneAnnotation(l.data), prevData);
    });

    THOTH.on("deleteSemanticAnnotation", (annotationId) => {
        const annotation = THOTH.SemAnnotations.cloneAnnotation(THOTH.SemAnnotations.semMap.get(annotationId));
        if (!annotation) return;

        Events.applyLocal("semantic_annotation.delete", {
            model_id  : Events.getAnnotationModelId("semantic_annotations", annotationId, Events.getPointModelId(annotation.point)),
            collection: "semantic_annotations",
            item_id   : annotationId
        }, null, annotation);
    });

    THOTH.on("toggleSemanticAnnotationVisibility", (annotationId) => {
        const prevData = THOTH.SemAnnotations.cloneAnnotation(THOTH.SemAnnotations.semMap.get(annotationId));
        if (!prevData) return;

        const data = {
            ...prevData,
            visible: prevData.visible === false
        };

        Events.applyLocal("semantic_annotation.update", {
            model_id  : Events.getAnnotationModelId("semantic_annotations", annotationId, Events.getPointModelId(prevData.point)),
            collection: "semantic_annotations",
            item_id   : annotationId,
            field     : "visible"
        }, data, prevData);
    });

    THOTH.on("KeyDown", (k) => {
        if (ATON.UI._bModal) return;

        if (k === "KeyA" && !THOTH._bShiftDown) {
            THOTH.fire("selectSemanticAnnotation");
        }
    });
};

Events.setupLayerEvents = () => {
    // Create/Delet
    THOTH.on("createLayer", () => {
        const layerId = THOTH.Utils.getFirstUnusedKey(THOTH.Layers.layerMap);
        const modelId = Events.getDefaultModelId();
        const layerData = {
            id            : layerId,
            name          : "New Layer",
            metadata      : {},
            selection     : {},
            visible       : true,
            highlightColor: THOTH.Utils.getHighlightColor(layerId),
            trash         : false
        };

        Events.applyLocal("selection.create", {
            model_id  : modelId,
            collection: "selections",
            item_id   : layerId
        }, layerData);
        THOTH.Layers.setActiveLayer(layerId);
    });
    THOTH.on("deleteLayer", (layerId) => {
        const prevData = Events.getLayerData(layerId);
        if (!prevData) return;

        Events.applyLocal("selection.delete", {
            model_id  : Events.getAnnotationModelId("selections", layerId),
            collection: "selections",
            item_id   : layerId
        }, null, prevData);
    });
    // Edit layer data
    THOTH.on("editLayerMetadata", (l) => {
        const layerId  = l.id;
        const data     = l.data;
        const currentData = Events.getLayerData(layerId);
        const prevData = l.prevData?.id !== undefined ? l.prevData : currentData;
        if (!prevData) return;

        const nextData = {
            ...prevData,
            ...(l.annotationData || {}),
            metadata: data
        };

        Events.applyLocal("selection.update", {
            model_id  : Events.getAnnotationModelId("selections", layerId),
            collection: "selections",
            item_id   : layerId,
            field     : "metadata"
        }, nextData, prevData);
    });
    THOTH.on("renameLayer", (l) => {
        const id   = l.id;
        const data = l.data;
        const prevData = l.prevData || Events.getLayerData(id);
        if (!prevData) return;

        Events.applyLocal("selection.update", {
            model_id  : Events.getAnnotationModelId("selections", id),
            collection: "selections",
            item_id   : id,
            field     : "name"
        }, {
            ...prevData,
            name: data
        }, prevData);
    });
    THOTH.on("editSceneMetadata", (l) => {
        const data     = l.data;
        THOTH.MD.editSceneMetadata(data);
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
        const modelId = id.split('/').filter(Boolean).pop();
        const value = {
            id      : modelId,
            artefact: {
                gltf_file: id
            }
        };

        Events.applyLocal("model.create", {
            model_id: modelId
        }, value);
    });
    THOTH.on("deleteModel", (id) => {
        const prevData = Events.clone(THOTH.SceneStore.getModel(id));
        if (!prevData) return;

        Events.applyLocal("model.delete", {
            model_id: id
        }, null, prevData);
    });
    // Transform
    THOTH.on("modelTransformPos", (l) => {
        const prevValue = Events.clone(THOTH.SceneStore.getModel(l.modelName)?.transforms);
        const value = {
            ...prevValue,
            translation: l.value
        };

        Events.applyLocal("model.update_transform", {
            model_id: l.modelName,
            field   : "translation"
        }, value, prevValue);
    }); 
    THOTH.on("modelTransformRot", (l) => {
        const prevValue = Events.clone(THOTH.SceneStore.getModel(l.modelName)?.transforms);
        const value = {
            ...prevValue,
            rotation: l.value
        };

        Events.applyLocal("model.update_transform", {
            model_id: l.modelName,
            field   : "rotation"
        }, value, prevValue);
    }); 
    THOTH.on("modelTransformScale", (l) => {
        const prevValue = Events.clone(THOTH.SceneStore.getModel(l.modelName)?.transforms);
        const value = {
            ...prevValue,
            scale: l.value
        };

        Events.applyLocal("model.update_transform", {
            model_id: l.modelName,
            field   : "scale"
        }, value, prevValue);
    });
    //select model
    THOTH.on("selectModel", (modelName) => {
        THOTH.Transforms.attachGizmo(modelName);
    });
};
//
Events.setupTransformControls = (ModelName) => {
    THOTH.Transforms.attachGizmo(ModelName);
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
            if (THOTH.Toolbox.enabled || THOTH.MSR.enabled || THOTH.SemAnnotations.enabled) {
                ATON.Nav.setUserControl(true);

                THOTH.Toolbox.pause();
                THOTH.Toolbox.cleanupLasso();

                THOTH.MSR.pause();
                THOTH.MSR.clearMeasurementPoints();

                THOTH.SemAnnotations.pause();
                THOTH.SemAnnotations.clearTempAnnotationSem();
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
            if (THOTH.SemAnnotations.paused) {
                ATON.Nav.setUserControl(false);
                THOTH.SemAnnotations.resume();
            }
        }
    });
    
    // Select tool
    THOTH.on("selectBrush", () => {
        THOTH.Toolbox.activateBrush();
        THOTH.MSR.deactivate();
        THOTH.SemAnnotations.deactivate();
        ATON.Nav.setUserControl(false);
        THOTH.FE.handleToolOptions('brush');
        THOTH.FE.handleElementHighlight('brush', THOTH.FE.toolMap);
    });
    THOTH.on("selectEraser", () => {
        THOTH.Toolbox.activateEraser();
        THOTH.MSR.deactivate();
        THOTH.SemAnnotations.deactivate();
        ATON.Nav.setUserControl(false);
        THOTH.FE.handleToolOptions('eraser');
        THOTH.FE.handleElementHighlight('eraser', THOTH.FE.toolMap);
    });
    THOTH.on("selectLasso", () => {
        THOTH.Toolbox.activateLasso();
        THOTH.MSR.deactivate();
        THOTH.SemAnnotations.deactivate();
        ATON.Nav.setUserControl(false);
        THOTH.FE.handleToolOptions('lasso');
        THOTH.FE.handleElementHighlight('lasso', THOTH.FE.toolMap);
    });
    THOTH.on("selectNone", () => {
        THOTH.Toolbox.deactivate();
        THOTH.MSR.deactivate();
        THOTH.SemAnnotations.deactivate();
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

        Events.applySelectionEdit(layerId, selection, "add");

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
        
        Events.applySelectionEdit(layerId, selection, "delete");

        THOTH.Toolbox.tempSelection = null;
    });
    THOTH.on("endLassoAdd", (l) => {
        if (!THOTH.Toolbox.enabled || THOTH.Toolbox.paused) return;

        const layerId   = THOTH.Layers.activeLayer.id;
        const selection = THOTH.Toolbox.endLassoAdd();

        if (Object.keys(selection).length === 0) return;

        Events.applySelectionEdit(layerId, selection, "add");

        THOTH.Toolbox.tempSelection = null;
    });
    THOTH.on("endLassoDel", (l) => {
        if (!THOTH.Toolbox.enabled || THOTH.Toolbox.paused) return;

        const layerId   = THOTH.Layers.activeLayer.id;
        const selection = THOTH.Toolbox.endLassoDel();

        if (Object.keys(selection).length === 0) return;

        Events.applySelectionEdit(layerId, selection, "delete");

        THOTH.Toolbox.tempSelection = null;
    });
    THOTH.on("endAllToolOps", () => {
        THOTH.fire("endLasso");
    });
};

Events.setupPhotonEvents = () => {
    THOTH.onPhoton("thoth.operation", (operation) => {
        THOTH.Ops.applyRemote(operation);
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


export default Events;
