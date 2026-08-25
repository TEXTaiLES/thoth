/*===========================================================================

    THOTH
    Event handling

===========================================================================*/
let Events = {};


Events.authRequiredEvents = new Map([
    [ "addModel", "import models" ],
    [ "deleteModel", "delete models" ],
    [ "modelTransformPos", "edit transforms" ],
    [ "modelTransformRot", "edit transforms" ],
    [ "createSelection", "create selections" ],
    [ "deleteSelection", "delete selections" ],
    [ "editSelectionMetadata", "edit selections" ],
    [ "renameSelection", "edit selections" ],
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


Events.setup = () => {
    // Ease of access
    THOTH.on   = ATON.on;
    THOTH.fire = Events.fireWithAuth;
    
    THOTH.onPhoton   = ATON.Photon.on;
    THOTH.firePhoton = ATON.Photon.fire;

    Events.setupInputEL();
    Events.setupActiveEL();
    Events.setupWindowEL();

    Events.setupCollaborativeEvents();
};

Events.fireWithAuth = (eventName, data, immediate) => {
    const actionName = Events.authRequiredEvents.get(eventName);
    if (actionName && !THOTH.requireAuth(actionName)) return false;

    return ATON.fire(eventName, data, immediate);
};

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
    if (point?.meshId) return point.meshId;
    if (point?.mesh) return THOTH.Models?.getParent(point.mesh) ?? point.mesh.name;

    return Events.getDefaultModelId();
};

Events.getSelectionData = (selectionId) => {
    return Events.clone(THOTH.Selections?.getSelectionById(selectionId));
};

Events.mergeSelection = (baseSelection = {}, selection = {}, mode = "add") => {
    const nextSelection = Events.clone(baseSelection) || {};

    for (const meshName of Object.keys(selection)) {
        const currentFaces = nextSelection[meshName] || [];
        const incomingFaces = selection[meshName] || [];

        if (mode === "delete") {
            const incomingSet = new Set(incomingFaces);
            nextSelection[meshName] = currentFaces.filter(face => !incomingSet.has(face));
        }
        else {
            nextSelection[meshName] = Array.from(
                new Set([...currentFaces, ...incomingFaces])
            );
        }
    }

    return nextSelection;
};

Events.applySelectionEdit = (selectionId, selection, mode) => {
    const prevData = Events.getSelectionData(selectionId);
    if (!prevData) return;

    const modelId = Object.keys(selection)[0] || prevData.model_id || Events.getDefaultModelId();
    const selectedFaces = Events.mergeSelection(
        prevData.annotation?.selected_faces || prevData.selection || {},
        selection[modelId] || {},
        mode
    );

    const data = {
        ...prevData,
        annotation: {
            ...(prevData.annotation || {}),
            selected_faces: selectedFaces
        },
        selection: selectedFaces
    };

    Events.applyLocal("selection.update", {
            model_id  : modelId,
            collection: "selections",
            item_id   : selectionId,
            field     : "selected_faces"
        }, data, prevData);
};

Events.getMeasurementData = (measurementId) => {
    return Events.clone(THOTH.MSR.getMeasurement(measurementId));
};

Events.getSemanticAnnotationData = (annotationId) => {
    return THOTH.SemAnnotations.cloneAnnotation(
        THOTH.SemAnnotations.getAnnotation(annotationId)
    );
};

Events.getAnnotationModelId = (modality, annotationId, fallbackModelId) => {
    return THOTH.Annotations?.getModelId(modality, annotationId) || fallbackModelId || Events.getDefaultModelId();
};

Events.applyLocal = (type, target, value, prevValue) => {
    const operation = THOTH.Ops.makeOperation(type, target, value, prevValue);
    THOTH.Ops.applyLocal(operation);
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
            if (!Events.activeSelectionExists()) {
                THOTH.FE.showToast("No Selection Selected");
                return;
            }
            if (THOTH.Toolbox.tempSelection !== null) return;
            THOTH.fire("useBrush");
        }
        // Eraser
        if (THOTH.Toolbox.eraserEnabled) {
            if (!Events.activeSelectionExists()) {
                THOTH.FE.showToast("No Selection Selected");
                return;
            }
            if (THOTH.Toolbox.tempSelection !== null) return;
            THOTH.fire("useEraser");
        }
        // Lasso
        if (THOTH.Toolbox.lassoEnabled) {
            if (!Events.activeSelectionExists()) {
                THOTH.FE.showToast("No Selection Selected");
                return;
            }
            THOTH.fire("startLasso");
        }
    });
    THOTH.on("MouseLeftUp", () => {
        if (!Events.activeSelectionExists()) return;
        
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
            if (!Events.activeSelectionExists()) {
                THOTH.FE.showToast("No Selection Selected");
                return;
            }
            THOTH.fire("startEraser");
        }
        // Eraser
        if (THOTH.Toolbox.eraserEnabled) {
            if (!Events.activeSelectionExists()) {
                THOTH.FE.showToast("No Selection Selected");
                return;
            }
            THOTH.fire("startBrush");
        }
        // Lasso
        if (THOTH.Toolbox.lassoEnabled) {
            if (!Events.activeSelectionExists()) {
                THOTH.FE.showToast("No Selection Selected");
                return;
            }
            THOTH.fire("startLasso");
        }
    });
    THOTH.on("MouseRightUp", (e) => {
        if (!Events.activeSelectionExists()) return;

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
        
        if (!Events.activeSelectionExists()) return;
        
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
    THOTH.on("createMeasurement", async (data) => {
        if (data?.data) {
            const measurementData = data.data;
            const modelId = Events.getPointModelId(measurementData.points?.[0] || measurementData.point1);
            Events.applyLocal("measurement.create", {
                model_id  : modelId,
                collection: "measurements",
                item_id   : data.id
            }, measurementData);
            return;
        }

        const msrId = THOTH.Utils.getFirstUnusedKey(THOTH.MSR.msrMap);
        const point1 = THOTH.MSR.points[0];
        const point2 = THOTH.MSR.points[1];
        const modelId1 = Events.getPointModelId(point1);
        const modelId2 = Events.getPointModelId(point2);

        if (modelId1 !== modelId2) {
            THOTH.FE.showToast("Measurements cannot span different models.");
            return;
        }

        let measurementData;
        if (THOTH.MSR.distanceType === "geodesicExact") {
            try {
                measurementData = await THOTH.MSR.createExactGeodesicMeasurement(
                    msrId,
                    point1,
                    point2,
                    { model_id: modelId1 }
                );
            }
            catch (error) {
                console.error("Exact geodesic computation failed", error);
                THOTH.FE.showToast(error?.message || "Exact geodesic computation failed");
                return;
            }
        }
        else {
            measurementData = THOTH.MSR.createMeasurementData(msrId, point1, point2, {
                model_id    : modelId1,
                distanceType: THOTH.MSR.distanceType
            });
        }
        if (!measurementData) return;

        THOTH.UI.modalMsrDetails(msrId, measurementData, {
            isNew: true
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
        const modelId = Events.getPointModelId(l.data?.point);
        Events.applyLocal("semantic_annotation.create", {
            model_id  : modelId,
            collection: "semantic_annotations",
            item_id   : l.id
        }, {
            ...l.data,
            model_id: modelId
        });
    });

    THOTH.on("updateSemanticAnnotation", (l) => {
        const prevData = l.prevData || Events.getSemanticAnnotationData(l.id);
        if (!prevData) return;

        Events.applyLocal("semantic_annotation.update", {
            model_id  : Events.getAnnotationModelId("semantic_annotations", l.id, Events.getPointModelId(l.data?.point || prevData.point)),
            collection: "semantic_annotations",
            item_id   : l.id
        }, THOTH.SemAnnotations.cloneAnnotation(l.data), prevData);
    });

    THOTH.on("deleteSemanticAnnotation", (annotationId) => {
        const annotation = Events.getSemanticAnnotationData(annotationId);
        if (!annotation) return;

        Events.applyLocal("semantic_annotation.delete", {
            model_id  : Events.getAnnotationModelId("semantic_annotations", annotationId, Events.getPointModelId(annotation.point)),
            collection: "semantic_annotations",
            item_id   : annotationId
        }, null, annotation);
    });

    THOTH.on("toggleSemanticAnnotationVisibility", (annotationId) => {
        const prevData = Events.getSemanticAnnotationData(annotationId);
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

Events.setupSelectionEvents = () => {
    // Create/Delete
    THOTH.on("createSelection", (data) => {
        const modelId = data?.modelId || Events.getDefaultModelId();
        const selectionId = THOTH.Selections.getNextSelectionId(modelId);
        const selectionData = {
            id        : selectionId,
            name      : "New Selection",
            metadata  : {},
            annotation: {
                selected_faces : {},
                selection_color: THOTH.Utils.getHighlightColor(selectionId)
            },
            visible   : true,
            trash     : false
        };

        Events.applyLocal("selection.create", {
            model_id  : modelId,
            collection: "selections",
            item_id   : selectionId
        }, selectionData);
        THOTH.Annotations?.select?.("selections", selectionId, {
            modelId: modelId
        });
    });
    THOTH.on("deleteSelection", (selectionId) => {
        const prevData = Events.getSelectionData(selectionId);
        if (!prevData) return;

        Events.applyLocal("selection.delete", {
            model_id  : prevData.model_id || Events.getAnnotationModelId("selections", selectionId),
            collection: "selections",
            item_id   : selectionId
        }, null, prevData);
    });
    // Edit selection data
    THOTH.on("editSelectionMetadata", (l) => {
        const selectionId  = l.id;
        const data     = l.data;
        const currentData = Events.getSelectionData(selectionId);
        const prevData = l.prevData?.id !== undefined ? l.prevData : currentData;
        if (!prevData) return;

        const nextData = {
            ...prevData,
            ...(l.annotationData || {}),
            metadata: data
        };

        Events.applyLocal("selection.update", {
            model_id  : prevData.model_id || Events.getAnnotationModelId("selections", selectionId),
            collection: "selections",
            item_id   : selectionId,
            field     : "metadata"
        }, nextData, prevData);
    });
    THOTH.on("renameSelection", (l) => {
        const id   = l.id;
        const data = l.data;
        const prevData = l.prevData || Events.getSelectionData(id);
        if (!prevData) return;

        Events.applyLocal("selection.update", {
            model_id  : prevData.model_id || Events.getAnnotationModelId("selections", id),
            collection: "selections",
            item_id   : id,
            field     : "name"
        }, {
            ...prevData,
            name: data
        }, prevData);
    });
    // Selection keybinds
    THOTH.on("KeyDown", (k) => {
        // Ignore if modal
        if (ATON.UI._bModal) return;

        // Selections
        if (k.startsWith("Digit")) {
            const id = Number(k.replace("Digit", ""));
            if (THOTH._bShiftDown) {
                THOTH.Annotations?.select?.("selections", id);
                THOTH.UI.modalSelectionDetails(id);
            }
            else THOTH.Annotations?.select?.("selections", id);
        }
        if (k === "KeyN") {
            if (THOTH._bShiftDown) THOTH.fire("createSelection");
            else THOTH.fire("selectNone");
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
    THOTH.on("addModel", async (id) => {
        const glbResponse = await THOTH.API.getGlbModel(id);
        if (!glbResponse.ok) {
            THOTH.FE?.showToast?.(glbResponse.error || "Error loading model URL");
            return;
        }
        
        const modelURL = typeof glbResponse.data === "string"
            ? glbResponse.data
            : glbResponse.data?.gltf_file ||
                glbResponse.data?.glb_file ||
                glbResponse.data?.url ||
                glbResponse.data?.path ||
                glbResponse.data?.src ||
                id;
        if (!modelURL) {
            THOTH.FE?.showToast?.("No model URL found");
            return;
        }

        const artefactResponse = await THOTH.API.getArtefactData(id);
        const artefact = artefactResponse.ok
            ? THOTH.Artefacts.normalize(artefactResponse.data || {})
            : THOTH.Artefacts.normalize();
        const stableId = artefact.artifact_id || artefact.id || artefact.title || id;
        const modelId = String(stableId).split('/').filter(Boolean).pop();
        const value = {
            id      : modelId,
            artefact: {
                ...artefact,
                title    : artefact.title || modelId,
                gltf_file: artefact.gltf_file || modelURL
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
        
        // Get only faces that don't already belong to selection
        const activeSelection = THOTH.Annotations?.getActiveSelection?.();
        const selectionId = activeSelection.id;
        const selection = THOTH.Toolbox.endBrush();
        
        if (Object.keys(selection).length === 0) return;

        Events.applySelectionEdit(selectionId, selection, "add");

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
        
        // Get only faces that already belong to selection
        const activeSelection = THOTH.Annotations?.getActiveSelection?.();
        const selectionId = activeSelection.id;
        const selection = THOTH.Toolbox.endEraser();
        
        // Return if selection is empty
        if (Object.keys(selection).length === 0) return;
        
        Events.applySelectionEdit(selectionId, selection, "delete");

        THOTH.Toolbox.tempSelection = null;
    });
    THOTH.on("endLassoAdd", (l) => {
        if (!THOTH.Toolbox.enabled || THOTH.Toolbox.paused) return;

        const activeSelection = THOTH.Annotations?.getActiveSelection?.();
        const selectionId = activeSelection.id;
        const selection = THOTH.Toolbox.endLassoAdd();

        if (Object.keys(selection).length === 0) return;

        Events.applySelectionEdit(selectionId, selection, "add");

        THOTH.Toolbox.tempSelection = null;
    });
    THOTH.on("endLassoDel", (l) => {
        if (!THOTH.Toolbox.enabled || THOTH.Toolbox.paused) return;

        const activeSelection = THOTH.Annotations?.getActiveSelection?.();
        const selectionId = activeSelection.id;
        const selection = THOTH.Toolbox.endLassoDel();

        if (Object.keys(selection).length === 0) return;

        Events.applySelectionEdit(selectionId, selection, "delete");

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

Events.activeSelectionExists = () => {
    return THOTH.Annotations?.getActive?.()?.modality === "selections";
};


export default Events;
