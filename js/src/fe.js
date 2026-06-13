/*===========================================================================

    THOTH
    Front End

    Authors: 
        Stelios Alvanos (steliosalvanos@gmail.com)
        Apostolos Kastrisis

===========================================================================*/
let FE = {};



// Setup

FE.setup = () => {
    // General
    FE.topToolbar    = FE.setupTopToolbar();
    FE.userToolbar   = FE.setupUserToolbar();
    FE.settingsPanel = FE.setupSettingsPanel();
    FE.sensorPanel   = FE.setupSensorPanel();

    FE.setupLayerElements();
    FE.setupModelElements();
    FE.setupMsrElements();
    FE.setupSemAnnotationElements();

    // Toast
    FE.toast = FE.createToast();
    
    // VP
    FE.viewpointCard = FE.setupVPCard();
    //gizmos state
    const originalHideSidePanel = ATON.UI.hideSidePanel;
    ATON.UI.hideSidePanel = (options) => {
        THOTH.Transforms?.detachGizmo();
        return originalHideSidePanel(options);
    };
};

FE.setupLayerElements = () => {
    FE.layerNameMap = new Map();
    FE.layerMap     = new Map();
    FE.layerList    = ATON.UI.createContainer();
    FE.layersPanel  = FE.setupLayersPanel(FE.layerList);
};

FE.setupModelElements = () => {
    FE.modelMap    = new Map();
    FE.modelList   = ATON.UI.createContainer();
    FE.modelsPanel = FE.setupModelsPanel(FE.modelList);
};

FE.setupMsrElements = () => {
    FE.msrNameMap = new Map();
    FE.msrMap     = new Map();
    FE.msrList    = ATON.UI.createContainer();
    FE.msrPanel   = FE.setupMsrPanel(FE.msrList);
};

FE.setupSemAnnotationElements = () => {
    FE.semNameMap = new Map();
    FE.semMap     = new Map();
    FE.semList    = ATON.UI.createContainer();
    FE.semPanel   = FE.setupSemAnnotationPanel(FE.semList);
};

FE.setupToolboxElements = () => {
    // Tools
    if (!FE.exportButton) {
        FE.exportButton = THOTH.UI.createExportButton();
        FE.userToolbar.append(FE.exportButton);
    }

    if (THOTH.config.toolbox && !FE.toolMap) {
        FE.toolMap        = FE.initToolMap();
        FE.toolOptMap     = FE.initToolOptMap();
        FE.toolOptToolbar = FE.setupToolOptToolbar();
        FE.mainToolbar    = FE.setupMainToolbar(FE.toolMap);
    }

    FE.syncAuthControls();
};

FE.syncAuthControls = () => {
    const isAuthenticated = THOTH.isAuthenticated?.() === true;
    const controls = [
        FE.exportButton,
        FE.toolMap?.get("measure"),
        FE.toolMap?.get("semantic"),
        FE.toolMap?.get("brush"),
        FE.toolMap?.get("eraser"),
        FE.toolMap?.get("lasso"),
        FE.toolMap?.get("undo"),
        FE.toolMap?.get("redo")
    ];

    for (const el of controls) {
        if (!el) continue;

        if (isAuthenticated) {
            el.classList.remove("opacity-50");
        }
        else {
            el.classList.add("opacity-50");
        }
    }
};


// Maps

FE.initLayerNameMap = () => {
    const layerNameMap = new Map();
    for (const [selectionKey, layer] of THOTH.Layers.layerMap) {
        const layerNameBtn = ATON.UI.createButton({
            text   : layer.name,
            onpress: () => THOTH.Selections.setActiveSelection(layer.model_id, layer.id),
        });
        layerNameMap.set(selectionKey, layerNameBtn);
    }
    return layerNameMap;
};

FE.initMsrNameMap = () => {
    const msrNameMap = new Map();
    for (const [msrId, msr] of THOTH.MSR.msrMap) {
        const msrBtn = ATON.UI.createButton({
            text   : msr.name,
            onpress: () => {}   // Hightlight msr
        });
        msrNameMap.set(msrId, msrBtn);
    }
    return msrNameMap;
};

FE.initToolMap = () => {
    const toolMap = new Map();

    // Measure
    const elMeasure = ATON.UI.createButton({
        icon: "measure",
        tooltip: "Measure tool (M)",
        onpress: () => THOTH.fire("selectMeasure"),
    });
    toolMap.set("measure", elMeasure);
    // Semantic annotations
    const elSemantic = ATON.UI.createButton({
        icon: "list",
        tooltip: "Semantic annotation tool (A)",
        onpress: () => THOTH.fire("selectSemanticAnnotation"),
    });
    toolMap.set("semantic", elSemantic);
    // Brush
    const elBrush = ATON.UI.createButton({
        icon   : THOTH.PATH_RES_ICONS + "brush.png",
        tooltip: "Brush tool (B)",
        onpress: () => THOTH.fire("selectBrush"),
    });
    toolMap.set("brush", elBrush);
    // Eraser
    const elEraser  = ATON.UI.createButton({
        icon   : THOTH.PATH_RES_ICONS + "eraser.png",
        tooltip: "Eraser tool (E)",
        onpress: () => THOTH.fire("selectEraser")
    });
    toolMap.set("eraser", elEraser);
    // Lasso
    const elLasso   = ATON.UI.createButton({
        icon   : THOTH.PATH_RES_ICONS + "lasso.png",
        tooltip: "Lasso tool (L)",
        onpress: () => THOTH.fire("selectLasso")
    });
    toolMap.set("lasso", elLasso);
    // No tool
    const elNoTool  = ATON.UI.createButton({
        icon   : THOTH.PATH_RES_ICONS + "none.png",
        tooltip: "No Tool (N)",
        onpress: () => THOTH.fire("selectNone")
    });
    toolMap.set("no_tool", elNoTool);
    // Undo
    const elUndo = ATON.UI.createButton({
        icon   : THOTH.PATH_RES_ICONS + "undo.png",
        tooltip: "Undo (Ctrl + Z)",
        onpress: () => THOTH.requireAuth("undo changes", () => THOTH.History.undo())
    });
    toolMap.set("undo", elUndo);
    // Redo
    const elRedo = ATON.UI.createButton({
        icon   : THOTH.PATH_RES_ICONS + "redo.png",
        tooltip: "Redo (Ctrl + Y)",
        onpress: () => THOTH.requireAuth("redo changes", () => THOTH.History.redo())
    });
    toolMap.set("redo", elRedo);
    // Home
    // const elHome = ATON.UI.createButton({
    //     icon   : "home",
    //     tooltip: "Go home",
    //     onpress: () => {
    //         ATON.Nav.requestHome(0.3);
    //     }
    // });
    // toolMap.set("home", elHome);
    
    return toolMap;
};

FE.initToolOptMap = () => {
    const toolOptMap = new Map();

    // Measure
    const elMeasureOpt = THOTH.UI.createMeasureOptions();
    toolOptMap.set("measure", elMeasureOpt);
    // Semantic annotations
    const elSemanticOpt = ATON.UI.createContainer();
    toolOptMap.set("semantic", elSemanticOpt);
    // Brush
    const elBrushOpt = THOTH.UI.createBrushOptions();
    toolOptMap.set("brush", elBrushOpt);
    // Eraser
    const elEraserOpt = THOTH.UI.createBrushOptions();
    toolOptMap.set("eraser", elEraserOpt);
    // Lasso
    const elLassoOpt = THOTH.UI.createLassoOptions();
    toolOptMap.set("lasso", elLassoOpt);
    // No tool
    const elNoToolOpt = ATON.UI.createContainer();
    toolOptMap.set("no_tool", elNoToolOpt);

    return toolOptMap;
};


// Lists

FE.setupModelList = (modelMap) => {
    const elModelList = ATON.UI.createContainer();

    for (const [ , elModelController] of modelMap) {
        elModelList.append(elModelController)
    }

    return elModelList;
};

FE.setupLayerList = (layerMap) => {
    const elLayerList = ATON.UI.createContainer();
    
    for (const [ , elLayerController] of layerMap) {
        elLayerList.append(elLayerController)
    }
    
    return elLayerList;
};

FE.setupHistoryList = () => {
    const elHistoryList = ATON.UI.createContainer();

    return elHistoryList;
};

FE.setupMsrList = (msrMap) => {
    const elMsrList = ATON.UI.createContainer();

    for (const [ , elMsrController] of msrMap) {
        elMsrList.append(elMsrController)
    }

    return elMsrList;
};


// Toolbars

FE.setupTopToolbar = () => {
    const topToolbar = ATON.UI.get("topToolbar");

    topToolbar.append(
        // TEXTaiLES
        ATON.UI.createButton({
            icon    : THOTH.PATH_RES_ICONS + "textailes.png",
            text    : "TEXTaiLES",
            onpress : () => window.open("https://www.echoes-eccch.eu/textailes/", "_blank"),
            tooltip : "Go to the TEXTaiLES website"
        }),
        // Scene
        ATON.UI.createButton({
            icon   : 'scene',
            text   : "Models",
            onpress: () => ATON.UI.showSidePanel({
                header: "Scene",
                body  : FE.modelsPanel
            }),
            tooltip: "Models options"
        }),
        // Selections
        ATON.UI.createButton({
            icon   : "layers",
            text   : "Selections",
            onpress: () => ATON.UI.showSidePanel({
                header: "Selections",
                body  : FE.layersPanel
            }),
            tooltop : "Selections"
        }),
        // msr
        ATON.UI.createButton({
            icon   : "measure",
            text   : "Measurements",
            onpress: () => ATON.UI.showSidePanel({
                header: "Measurements",
                body: FE.msrPanel
            }),
            tooltip: "Measurements"
        }),
        // Semantics
        ATON.UI.createButton({
            icon   : "list",
            text   : "Semantics",
            onpress: () => ATON.UI.showSidePanel({
                header: "Semantic Annotations",
                body  : FE.semPanel
            }),
            tooltip: "Semantic annotations"
        }),
        // Sensors
        ATON.UI.createButton({
            icon   : "light",
            text   : "Sensors ",
            onpress: () => ATON.UI.showSidePanel({
                header: "Sensor Stream",
                body  : FE.sensorPanel
            }),
            tooltop : "Sensor Data"
        }), 
        // Settings
        ATON.UI.createButton({
            icon   : "settings",
            text   : "Settings",
            onpress: () => ATON.UI.showSidePanel({
                header  : "Settings",
                body    : FE.settingsPanel
            }),
            tooltip: "Options"
        }),
        // Info
        ATON.UI.createButton({
            icon   : "info",
            text   : "Info",
            onpress: () => window.open("https://textailes.github.io/thoth-documentation/", "_blank"),
            tooltip: "Open documentation"
        })
    );
    
    FE.syncMainToolbarOffset(topToolbar);
    
    return topToolbar;
};

FE.syncMainToolbarOffset = (topToolbar) => {
    if (!topToolbar) return;

    const updateOffset = () => {
        document.documentElement.style.setProperty(
            "--thoth-top-toolbar-height",
            `${topToolbar.offsetHeight}px`
        );
    };

    requestAnimationFrame(updateOffset);

    if (window.ResizeObserver) {
        FE._topToolbarResizeObserver = new ResizeObserver(updateOffset);
        FE._topToolbarResizeObserver.observe(topToolbar);
    }
    else {
        window.addEventListener("resize", updateOffset);
    }
};

FE.setupUserToolbar = () => {
    const userToolbar = ATON.UI.get("userToolbar");

    userToolbar.append(THOTH.UI.createUserButton());

    return userToolbar;
};

FE.setupMainToolbar = (toolMap) => {
    if (!toolMap) return;
    
    const mainToolbar = ATON.UI.get("mainToolbar");
    const toolGroups = [
        [ "brush", "eraser", "lasso", "no_tool" ],
        [ "measure", "semantic" ],
        [ "undo", "redo" ],
    ];

    mainToolbar.innerHTML = "";

    for (let groupIndex = 0; groupIndex < toolGroups.length; groupIndex++) {
        const toolKeys = toolGroups[groupIndex];

        if (groupIndex > 0) {
            mainToolbar.append(ATON.UI.createContainer({classes: "thoth-toolbar-separator"}));
        }

        for (const toolKey of toolKeys) {
            const toolElement = toolMap.get(toolKey);
            if (toolElement) mainToolbar.append(toolElement);
        }
    }

    return mainToolbar;
};

FE.setupToolOptToolbar = () => {
    const toolOptToolbar = ATON.UI.get("toolOptToolbar");

    return toolOptToolbar;
};

FE.setupHistoryToolbar = (historyList) => {
    const historyToolbar = ATON.UI.get("historyToolbar");
    const elButtons = ATON.UI.createContainer();
    elButtons.append(
        ATON.UI.createButton({
            icon   : THOTH.PATH_RES_ICONS + "undo.png",
            tooltip: "Undo (Ctrl + Z)",
            onpress: () => THOTH.History.undo()
        }),
        ATON.UI.createButton({
            icon   : THOTH.PATH_RES_ICONS + "redo.png",
            tooltip: "Redo (Ctrl + Y)",
            onpress: () => THOTH.History.redo()
        })
    );
    const elHeader = THOTH.UI.createSplitRow({
        classes: "bg-body-secondary",
        colLeft: 7,
        itemsLeft: ATON.UI.createButton({
            text: "History",
        }),
        itemsRight: elButtons,
    });
    historyToolbar.append(elHeader, historyList);

    return historyToolbar;
};


// Panels

FE.setupSettingsPanel = () => {
    const elOptionsBody = ATON.UI.createContainer();
    const elMode        = ATON.UI.createContainer();
    const elVP          = ATON.UI.createContainer();

    // Mode
    elMode.append(
        ATON.UI.createButton({
            icon    : THOTH.PATH_RES_ICONS + "dark-mode.png",
            onpress : () => ATON.UI.setTheme("dark"),
            tooltip : "Set to dark mode"
        }),
        ATON.UI.createButton({
            icon    : THOTH.PATH_RES_ICONS + "light-mode.png",
            onpress : () => ATON.UI.setTheme("light"),
            tooltip : "Set to light mode"
        })
    );

    // Viewpoints
    elVP.append(
        THOTH.UI.createBool({
            text    : "Show viewpoints",
            value   : true,
            onchange: (input) => THOTH.SVP.toggleVPNodes(input)
        }),
        ATON.UI.createSlider({
            label  : "Node scale",
            range  : [0.1, 2.0],
            step   : 0.1,
            value  : 1.0,
            oninput: (input) => THOTH.SVP.resizeVPNodes(input)
        }),
    );

    // Options Tree
    const elOptions = ATON.UI.createTreeGroup({
        items: [
            {
                title  : "UI Mode",
                open   : false,
                content: elMode
            },
            {
                title  : "Viewpoints",
                open   : false,
                content: elVP
            }
        ]
    });
    
    elOptionsBody.append(elOptions);
    
    return elOptionsBody;
};

FE.setupModelsPanel = (elModelList) => {
    const elBody       = ATON.UI.createContainer();
    const elTopOptions = ATON.UI.createContainer({classes: "row g-0 align-items-center w-100 rounded-2 px-2 py-1 mb-1"});
    const [ elParentObject, elChildObjects ] = THOTH.LO.setupLinkedObjectsLists();

    // Top buttons
    elTopOptions.append(
        ATON.UI.createButton({
            icon   : "add",
            text   : "Add model",
            variant: "info",
            onpress: () => THOTH.requireAuth("import models", () => THOTH.UI.modalAddModel()),
        }),
        ATON.UI.createTreeGroup({
            items: [{
                title: "Parent Object",
                open: true,
                content: elParentObject,
            }]
        }),
        ATON.UI.createTreeGroup({
            items: [{
                title: "Child Objects",
                open: true,
                content: elChildObjects,
            }]
        })
    );
    elBody.append(elTopOptions, elModelList);
    
    return elBody;
};

FE.setupLayersPanel = (elLayerList) => {
    const elBody       = ATON.UI.createContainer({classes: "d-flex flex-column h-100"});
    const elTopOptions = ATON.UI.createContainer({classes: "row g-0 align-items-center w-100 rounded-2 px-2 py-1 mb-1"});

    // Selection structure
    const elLayerStructure = THOTH.UI.createLayerStructureBlock();
    elLayerStructure.classList.add("flex-shrink-0");
    elLayerStructure.style.marginTop = "auto";

    elLayerList.classList.add("flex-grow-1", "overflow-auto");
    elLayerList.style.minHeight = "0";

    // Scene controller
    const elSceneController = THOTH.UI.createSceneController();

    // Top buttons
    elTopOptions.append(
        ATON.UI.createButton({
            text   : "New Selection",
            icon   : "add",
            variant: "info",
            tooltip: "Create new selection",
            onpress: () => THOTH.fire("createLayer"),
        }),
    );

    elBody.append(elTopOptions, elSceneController, elLayerList, elLayerStructure);

    return elBody;
};

FE.setupSensorPanel = () => {
    const elBody = ATON.UI.createContainer();
    
    const sensorDashboard = THOTH.UI.createSensorDashboard("PREPEI_NA_STELNO_KATHE_15_LEPTA");
    elBody.append(sensorDashboard);

    return elBody;
};

FE.setupMsrPanel = (elMsrList) => {
    const elBody       = ATON.UI.createContainer();
    const elTopOptions = ATON.UI.createContainer({classes: "row g-0 align-items-center w-100 rounded-2 px-2 py-1 mb-1"});
    
    elBody.append(elTopOptions, elMsrList);

    return elBody;
};

FE.setupSemAnnotationPanel = (elSemList) => {
    const elBody       = ATON.UI.createContainer();
    const elTopOptions = ATON.UI.createContainer({classes: "row g-0 align-items-center w-100 rounded-2 px-2 py-1 mb-1"});

    elBody.append(elTopOptions, elSemList);

    return elBody;
};


// Selections

FE.addNewLayer = (layerId, modelId) => {
    const selection = THOTH.Selections.getSelection(modelId, layerId) ||
        THOTH.Selections.getSelectionById(layerId);
    if (!selection) return;

    const selectionKey = THOTH.Selections._makeKey(selection.model_id, layerId);

    // Resurrect layer if it already exists
    if (FE.layerMap.has(selectionKey)) {
        const controller = FE.layerMap.get(selectionKey);
        controller.style.display = 'flex';
        if (controller.faceCountBtn) {
            controller.faceCountBtn.textContent = `${THOTH.Selections.getFaceCount(selection)} faces`;
        }
        const nameButton = FE.layerNameMap.get(selectionKey);
        if (nameButton) nameButton.textContent = selection.name;
        return;
    }

    // Create new name button
    const newLayerNameBtn = ATON.UI.createButton({
        text   : selection.name,
        onpress: () => THOTH.Selections.setActiveSelection(selection.model_id, layerId)
    });
    FE.layerNameMap.set(selectionKey, newLayerNameBtn);
    
    // Create new controller
    const newLayerController = THOTH.UI.createLayerController(layerId, selection.model_id);
    FE.layerMap.set(selectionKey, newLayerController);

    // Add to list
    FE.layerList.append(newLayerController);
};

FE.deleteLayer = (layerId, modelId) => {
    const selectionKey = THOTH.Selections._makeKey(modelId, layerId);
    const controller = FE.layerMap.get(selectionKey);
    if (controller) controller.style.display = 'none';
};


// Models

FE.addModel = (modelName) => {
    // Handle resurrection for undo
    if (FE.modelMap.has(modelName)) {
        FE.modelMap.get(modelName).style.display = 'flex';
        return;
    }
    // Create new
    //const newModelController = THOTH.UI.createModelController(modelName);
    const newModelController = THOTH.UI.createModelController(
        modelName,
        () => THOTH.fire("selectModel", modelName)
    );
    FE.modelMap.set(modelName, newModelController);
    FE.modelList.append(newModelController);
};

FE.deleteModel = (modelName) => {
    FE.modelMap.get(modelName).style.display = 'none';
};


// Measurements

FE.addMsr = (msrId) => {
    // Resurrect measurement if it already exists
    if (FE.msrMap.has(msrId)) {
        FE.msrMap.get(msrId).style.display = "flex";
        return;
    }

    // Create new name button
    const newMsrNameBtn = ATON.UI.createButton({
        text   : THOTH.MSR.msrMap.get(msrId).name,
        onpress: () => {

        } // highilight {}
    });
    FE.msrNameMap.set(msrId, newMsrNameBtn);

    // Create new controller
    const newMsrController = THOTH.UI.createMsrController(msrId);
    FE.msrMap.set(msrId, newMsrController);

    // Add to list
    FE.msrList.append(newMsrController);
};

FE.deleteMsr = (msrId) => {
    FE.msrMap.get(msrId).style.display = 'none';
    // Add logic ? 
};


// Semantic annotations

FE.addSemAnnotation = (annotationId) => {
    if (FE.semMap.has(annotationId)) {
        FE.semMap.get(annotationId).style.display = "flex";
        return;
    }

    const annotation = THOTH.SemAnnotations.semMap.get(annotationId);
    const newSemNameBtn = ATON.UI.createButton({
        text   : annotation.name,
        onpress: () => THOTH.UI.modalSemAnnotationDetails(annotationId),
    });
    FE.semNameMap.set(annotationId, newSemNameBtn);

    const newSemController = THOTH.UI.createSemAnnotationController(annotationId);
    FE.semMap.set(annotationId, newSemController);

    FE.semList.append(newSemController);
};

FE.deleteSemAnnotation = (annotationId) => {
    FE.semMap.get(annotationId).style.display = "none";
};


// Misc

FE.handleElementHighlight = (elname, elMap) => {
    for (const [buttonName, elButton] of elMap) {
        if (buttonName === elname) {
            elButton.classList.add('bg-body-tertiary', 'active')
        }
        else {
            elButton.classList.remove('bg-body-tertiary', 'active')
        }
    }
};

FE.toggleControllerVisibility = (controller, visible) => {
    if (visible) {
        if (controller) {
            controller.classList.remove("opacity-50", "text-muted")
        }
    }
    else if (!visible) {
        if (controller) {
            controller.classList.add("opacity-50", "text-muted");
        }
    }
};

FE.handleToolOptions = (elToolName) => {
    const elOptions = FE.toolOptMap.get(elToolName);
    FE.toolOptToolbar.replaceChildren(elOptions);
    FE.toolOptToolbar.style.display = 'inline-block';
};


// VP

FE.setupVPCard = () => {
    const elCard = ATON.UI.get("vpCard");

    return elCard;
};

FE.showVPCard = (id) => {
    const modelName = id.split("_vp_")[0];
    const vpId      = id.split("_vp_")[1];

    const viewpoint = THOTH.SVP.viewpoints[modelName][vpId];
    const imageURL  = viewpoint.image;
    
    const elFooter = ATON.UI.createContainer();
    elFooter.append(
        ATON.UI.createButton({
            text   : "Close",
            icon   : "cancel",
            onpress: () => FE.viewpointCard.replaceChildren()
        })
    );
    FE.viewpointCard.replaceChildren(
        ATON.UI.createCard({
            title     : id,
            size      : "large",
            cover     : imageURL,
            onactivate: () => THOTH.UI.modalVPImage(viewpoint),
            footer    : elFooter
        }),
    );
};


// Toast

FE.createToast = () => {
    const elBody = ATON.UI.get("toastElement");

    return elBody;
};

FE.showToast = (msg, timeout=2000) => {
    const elMsg = THOTH.UI.createSplitRow({
        classes: "bg-body-secondary opacity-75",
        colLeft  : 10,
        itemsLeft: ATON.UI.createButton({
            text: msg,
        }),
        itemsRight: ATON.UI.createButton({
            icon   : "cancel",
            onpress: () => {
                FE.toast.replaceChildren();
                clearTimeout(FE._toastTimeout);
                FE._toastTimeout = null;
            },
        }),
    });
    
    FE.toast.replaceChildren(elMsg);

    // Handle timeout
    if (FE._toastTimeout) {
        clearTimeout(FE._toastTimeout);
    }

    FE._toastTimeout = setTimeout(() => {
        FE.toast.replaceChildren();
        FE._toastTimeout = null;
    }, timeout);
};



export default FE;
