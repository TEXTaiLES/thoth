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
    FE.rightToolbar  = FE.setupRightToolbar();
    FE.settingsPanel = FE.setupSettingsPanel();
    FE.sensorPanel   = FE.setupSensorPanel();

    FE.setupSelectionElements();
    FE.setupModelElements();
    FE.setupMsrElements();
    FE.setupSemAnnotationElements();
    FE.refreshSceneTree();

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

FE.setupSelectionElements = () => {
    FE.selectionNameMap       = new Map();
    FE.selectionControllerMap = new Map();
    FE.selectionList          = ATON.UI.createContainer();
    FE.selectionsPanel        = FE.setupSelectionsPanel(FE.selectionList);
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
    FE.refreshSceneTree();
};

FE.syncAuthControls = () => {
    const isAuthenticated = THOTH.isAuthenticated?.() === true;
    const controls = [
        FE.exportButton,
        FE.addModelButton,
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

FE.initSelectionNameMap = () => {
    const selectionNameMap = new Map();
    for (const [selectionKey, selection] of THOTH.Selections.selectionMap) {
        const selectionNameBtn = ATON.UI.createButton({
            text   : selection.name,
            onpress: () => THOTH.Selections.setActiveSelection(selection.model_id, selection.id),
        });
        selectionNameMap.set(selectionKey, selectionNameBtn);
    }
    return selectionNameMap;
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

FE.setupSelectionList = (selectionControllerMap) => {
    const elSelectionList = ATON.UI.createContainer();
    
    for (const [ , elSelectionController] of selectionControllerMap) {
        elSelectionList.append(elSelectionController)
    }
    
    return elSelectionList;
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

    FE.addModelButton = ATON.UI.createButton({
        icon   : "add",
        text   : "Add model",
        tooltip: "Add model",
        onpress: () => THOTH.requireAuth("import models", () => THOTH.UI.modalAddModel()),
    });

    topToolbar.append(
        // TEXTaiLES
        ATON.UI.createButton({
            icon    : THOTH.PATH_RES_ICONS + "textailes.png",
            text    : "TEXTaiLES",
            onpress : () => window.open("https://www.echoes-eccch.eu/textailes/", "_blank"),
            tooltip : "Go to the TEXTaiLES website"
        }),
        FE.addModelButton,
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

FE.setupRightToolbar = () => {
    const rightToolbar = ATON.UI.get("rightToolbar");

    FE.sceneTreeExpanded = FE.sceneTreeExpanded || new Set();
    FE.sceneTreeActiveKey = FE.sceneTreeActiveKey || null;

    return rightToolbar;
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

FE.refreshSceneTree = () => {
    if (!FE.rightToolbar || !THOTH.UI?.createSceneTreeRow) return;

    const elTree = ATON.UI.createContainer({
        classes: "thoth-scene-tree"
    });

    const scene = THOTH.SceneStore?.getScene?.();
    const models = scene?.models || {};
    const modelIds = Object.keys(models).filter(modelId => models[modelId]?.trash !== true);

    elTree.append(THOTH.UI.createSceneTreeRow({
        label   : "Scene Structure",
        icon    : "scene",
        active  : FE.sceneTreeActiveKey === "scene",
        count   : modelIds.length,
        onselect: () => FE.openSceneTreePanel("scene", "Scene", FE.modelsPanel)
    }));

    for (const modelId of modelIds) {
        const model = models[modelId];
        const modelKey = `model:${modelId}`;
        const isOpen = FE.sceneTreeExpanded.has(modelKey);

        elTree.append(THOTH.UI.createSceneTreeRow({
            label     : modelId,
            icon      : "scene",
            expandable: true,
            open      : isOpen,
            active    : FE.sceneTreeActiveKey === modelKey,
            onexpand  : () => FE.toggleSceneTreeNode(modelKey),
            onselect  : () => FE.openModelPanel(modelId)
        }));

        if (!isOpen) continue;

        const elChildren = THOTH.UI.createSceneTreeChildren();
        FE.appendModelSceneRows(elChildren, modelId, model);
        elTree.append(elChildren);
    }

    FE.rightToolbar.replaceChildren(elTree);
};

FE.toggleSceneTreeNode = (key) => {
    if (!FE.sceneTreeExpanded) FE.sceneTreeExpanded = new Set();

    if (FE.sceneTreeExpanded.has(key)) FE.sceneTreeExpanded.delete(key);
    else FE.sceneTreeExpanded.add(key);

    FE.refreshSceneTree();
};

FE.openSceneTreePanel = (key, header, body) => {
    FE.sceneTreeActiveKey = key;
    ATON.UI.showSidePanel({
        header: header,
        body  : body
    });
    FE.refreshSceneTree();
};

FE.openModelPanel = (modelId) => {
    THOTH.fire?.("selectModel", modelId);
    FE.openSceneTreePanel(`model:${modelId}`, modelId, THOTH.UI.createModelEditor(modelId));
};

FE.appendModelSceneRows = (elParent, modelId, model) => {
    const sections = [
        {
            key    : "artefact",
            label  : "Artefact",
            icon   : "collection-item",
            count  : FE.countObjectFields(model.artefact),
            content: () => THOTH.Artefacts.createDetailsView(modelId)
        },
        {
            key    : "selections",
            label  : "Selections",
            icon   : "collection-item",
            count  : FE.countCollectionItems(model.selections),
            content: () => FE.createModelCollectionPanel(modelId, "selections")
        },
        {
            key    : "semantic_annotations",
            label  : "Semantic Annotations",
            icon   : "list",
            count  : FE.countCollectionItems(model.semantic_annotations),
            content: () => FE.createModelCollectionPanel(modelId, "semantic_annotations")
        },
        {
            key    : "measurements",
            label  : "Measurements",
            icon   : "measure",
            count  : FE.countCollectionItems(model.measurements),
            content: () => FE.createModelCollectionPanel(modelId, "measurements")
        },
        {
            key    : "transforms",
            label  : "Transforms",
            icon   : "settings",
            content: () => THOTH.UI.createModelEditor(modelId)
        },
        {
            key    : "metadata",
            label  : "Metadata",
            icon   : "list",
            count  : FE.countObjectFields(model.metadata?.attributes),
            content: () => FE.createMetadataPanel(modelId)
        },
        {
            key    : "sensors",
            label  : "Sensors",
            icon   : "light",
            count  : Array.isArray(model.sensors) ? model.sensors.length : 0,
            content: () => THOTH.UI.createPlaceholderPanel(
                "Sensors",
                "Sensor data is reserved as a model-scoped placeholder in this phase."
            )
        }
    ];

    for (const section of sections) {
        const sectionKey = `model:${modelId}:${section.key}`;
        elParent.append(THOTH.UI.createSceneTreeRow({
            label   : section.label,
            icon    : section.icon,
            count   : section.count,
            active  : FE.sceneTreeActiveKey === sectionKey,
            level   : 1,
            onselect: () => FE.openSceneTreePanel(
                sectionKey,
                `${modelId} - ${section.label}`,
                section.content()
            )
        }));

        if (section.key === "selections") {
            FE.appendAnnotationRows(elParent, modelId, section.key, model.selections);
        }
        else if (section.key === "measurements") {
            FE.appendAnnotationRows(elParent, modelId, section.key, model.measurements);
        }
        else if (section.key === "semantic_annotations") {
            FE.appendAnnotationRows(elParent, modelId, section.key, model.semantic_annotations);
        }
    }
};

FE.appendAnnotationRows = (elParent, modelId, collectionName, collection = {}) => {
    const itemIds = Object.keys(collection).filter(itemId => collection[itemId]?.trash !== true);

    for (const itemId of itemIds) {
        const item = collection[itemId];
        const itemKey = `model:${modelId}:${collectionName}:${itemId}`;
        elParent.append(THOTH.UI.createSceneTreeRow({
            label   : item.name || itemId,
            icon    : "collection-item",
            active  : FE.sceneTreeActiveKey === itemKey,
            level   : 2,
            onselect: () => FE.openAnnotationPanel(itemKey, collectionName, itemId, modelId)
        }));
    }
};

FE.openAnnotationPanel = (key, collectionName, itemId, modelId) => {
    FE.sceneTreeActiveKey = key;

    if (collectionName === "selections") {
        THOTH.Selections.setActiveSelection(modelId, itemId);
        THOTH.UI.modalSelectionDetails(itemId);
    }
    else if (collectionName === "measurements") {
        THOTH.UI.modalMsrDetails(itemId);
    }
    else if (collectionName === "semantic_annotations") {
        THOTH.UI.modalSemAnnotationDetails(itemId);
    }

    FE.refreshSceneTree();
};

FE.createMetadataPanel = (modelId) => {
    const elBody = ATON.UI.createContainer();
    elBody.append(ATON.UI.createButton({
        text   : "Edit Metadata",
        icon   : "list",
        variant: "info",
        onpress: () => THOTH.requireAuth("edit metadata", () => THOTH.UI.modalModelMetadata(modelId))
    }));
    return elBody;
};

FE.createModelCollectionPanel = (modelId, collectionName) => {
    const model = THOTH.SceneStore?.getModel?.(modelId);
    const collection = model?.[collectionName] || {};
    const elBody = ATON.UI.createContainer({
        classes: "d-grid gap-1"
    });

    if (collectionName === "selections") {
        elBody.append(ATON.UI.createButton({
            text   : "New Selection",
            icon   : "add",
            variant: "info",
            onpress: () => THOTH.fire("createSelection", { modelId: modelId })
        }));
    }

    const itemIds = Object.keys(collection).filter(itemId => collection[itemId]?.trash !== true);
    if (itemIds.length === 0) {
        elBody.append(THOTH.UI.createPlaceholderPanel(
            FE.getCollectionLabel(collectionName),
            "No items for this model."
        ));
        return elBody;
    }

    for (const itemId of itemIds) {
        const item = collection[itemId];
        const itemKey = `model:${modelId}:${collectionName}:${itemId}`;
        elBody.append(THOTH.UI.createSceneTreeRow({
            label   : item.name || itemId,
            icon    : "collection-item",
            onselect: () => FE.openAnnotationPanel(itemKey, collectionName, itemId, modelId)
        }));
    }

    return elBody;
};

FE.getCollectionLabel = (collectionName) => {
    if (collectionName === "selections") return "Selections";
    if (collectionName === "measurements") return "Measurements";
    if (collectionName === "semantic_annotations") return "Semantic Annotations";

    return collectionName;
};

FE.countCollectionItems = (collection = {}) => {
    return Object.keys(collection).filter(itemId => collection[itemId]?.trash !== true).length;
};

FE.countObjectFields = (value = {}) => {
    if (!value || typeof value !== "object") return 0;
    return Object.keys(value).filter(key => value[key] !== undefined && value[key] !== "").length;
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

FE.setupSelectionsPanel = (elSelectionList) => {
    const elBody       = ATON.UI.createContainer({classes: "d-flex flex-column h-100"});
    const elTopOptions = ATON.UI.createContainer({classes: "row g-0 align-items-center w-100 rounded-2 px-2 py-1 mb-1"});

    // Selection structure
    const elSelectionStructure = THOTH.UI.createSelectionStructureBlock();
    elSelectionStructure.classList.add("flex-shrink-0");
    elSelectionStructure.style.marginTop = "auto";

    elSelectionList.classList.add("flex-grow-1", "overflow-auto");
    elSelectionList.style.minHeight = "0";

    // Scene controller
    const elSceneController = THOTH.UI.createSceneController();

    // Top buttons
    elTopOptions.append(
        ATON.UI.createButton({
            text   : "New Selection",
            icon   : "add",
            variant: "info",
            tooltip: "Create new selection",
            onpress: () => THOTH.fire("createSelection"),
        }),
    );

    elBody.append(elTopOptions, elSceneController, elSelectionList, elSelectionStructure);

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

FE.addNewSelection = (selectionId, modelId) => {
    const selection = THOTH.Selections.getSelection(modelId, selectionId) ||
        THOTH.Selections.getSelectionById(selectionId);
    if (!selection) return;

    const selectionKey = THOTH.Selections._makeKey(selection.model_id, selectionId);

    // Resurrect selection if it already exists
    if (FE.selectionControllerMap.has(selectionKey)) {
        const controller = FE.selectionControllerMap.get(selectionKey);
        controller.style.display = 'flex';
        if (controller.faceCountBtn) {
            controller.faceCountBtn.textContent = `${THOTH.Selections.getFaceCount(selection)} faces`;
        }
        const nameButton = FE.selectionNameMap.get(selectionKey);
        if (nameButton) nameButton.textContent = selection.name;
        FE.refreshSceneTree();
        return;
    }

    // Create new name button
    const newSelectionNameBtn = ATON.UI.createButton({
        text   : selection.name,
        onpress: () => THOTH.Selections.setActiveSelection(selection.model_id, selectionId)
    });
    FE.selectionNameMap.set(selectionKey, newSelectionNameBtn);
    
    // Create new controller
    const newSelectionController = THOTH.UI.createSelectionController(selectionId, selection.model_id);
    FE.selectionControllerMap.set(selectionKey, newSelectionController);

    // Add to list
    FE.selectionList.append(newSelectionController);
    FE.refreshSceneTree();
};

FE.deleteSelection = (selectionId, modelId) => {
    const selectionKey = THOTH.Selections._makeKey(modelId, selectionId);
    const controller = FE.selectionControllerMap.get(selectionKey);
    if (controller) controller.style.display = 'none';
    FE.refreshSceneTree();
};


// Models

FE.addModel = (modelName) => {
    // Handle resurrection for undo
    if (FE.modelMap.has(modelName)) {
        FE.modelMap.get(modelName).style.display = 'flex';
        FE.refreshSceneTree();
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
    FE.refreshSceneTree();
};

FE.deleteModel = (modelName) => {
    const controller = FE.modelMap.get(modelName);
    if (controller) controller.style.display = 'none';
    FE.refreshSceneTree();
};


// Measurements

FE.addMsr = (msrId) => {
    // Resurrect measurement if it already exists
    if (FE.msrMap.has(msrId)) {
        FE.msrMap.get(msrId).style.display = "flex";
        FE.refreshSceneTree();
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
    FE.refreshSceneTree();
};

FE.deleteMsr = (msrId) => {
    const controller = FE.msrMap.get(msrId);
    if (controller) controller.style.display = 'none';
    FE.refreshSceneTree();
    // Add logic ? 
};


// Semantic annotations

FE.addSemAnnotation = (annotationId) => {
    if (FE.semMap.has(annotationId)) {
        FE.semMap.get(annotationId).style.display = "flex";
        FE.refreshSceneTree();
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
    FE.refreshSceneTree();
};

FE.deleteSemAnnotation = (annotationId) => {
    const controller = FE.semMap.get(annotationId);
    if (controller) controller.style.display = "none";
    FE.refreshSceneTree();
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
