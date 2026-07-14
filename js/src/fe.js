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

    FE.setupSelectionElements();
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

    if (!FE.toolMap) {
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

FE.createSceneTreeAction = (options = {}) => {
    return ATON.UI.createButton({
        size: "small",
        ...options
    });
};

FE.createModelRowActions = (modelId) => {
    return [
        FE.createSceneTreeAction({
            icon   : ATON.PATH_RES + "icons/focus.png",
            tooltip: "Focus model",
            onpress: () => THOTH.Models.focusModel(modelId)
        }),
        FE.createSceneTreeAction({
            icon   : "download",
            tooltip: "Export model changes",
            onpress: () => THOTH.UI.modalModelExportChanges(modelId)
        }),
        FE.createSceneTreeAction({
            icon   : ATON.PATH_RES + "icons/trash.png",
            tooltip: "Delete model",
            onpress: () => {
                THOTH.Models.deactivateTransformControls();
                THOTH.fire("deleteModel", modelId);
            }
        })
    ];
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
        count   : modelIds.length,
        selectable: false
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
            actions   : FE.createModelRowActions(modelId),
            onexpand  : () => FE.toggleSceneTreeNode(modelKey),
            onselect  : () => FE.toggleSceneTreeNode(modelKey)
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
    if (!key.endsWith(":transforms")) {
        THOTH.Transforms?.detachGizmo();
    }
    ATON.UI.showSidePanel({
        header: header,
        body  : body
    });
    FE.refreshSceneTree();
};

FE.openTransformPanel = (modelId, key) => {
    FE.sceneTreeActiveKey = key;
    THOTH.requireAuth?.("edit transforms", () => THOTH.Transforms?.attachGizmo(modelId));
    ATON.UI.showSidePanel({
        header: `${modelId} - Transforms`,
        body  : THOTH.UI.createModelTransformEditor(modelId)
    });
    FE.refreshSceneTree();
};

FE.appendModelSceneRows = (elParent, modelId, model) => {
    const annotations = model.annotations || {};
    const sections = [
        {
            key    : "selections",
            label  : "Selections",
            icon   : "collection-item",
            count  : FE.countCollectionItems(annotations.selections),
            expandable: true,
            actions: () => FE.createCollectionActions(modelId, "selections")
        },
        {
            key    : "semantic_annotations",
            label  : "Semantic Annotations",
            icon   : "list",
            count  : FE.countCollectionItems(annotations.semantic_annotations),
            expandable: true,
            actions: () => FE.createCollectionActions(modelId, "semantic_annotations")
        },
        {
            key    : "measurements",
            label  : "Measurements",
            icon   : "measure",
            count  : FE.countCollectionItems(annotations.measurements),
            expandable: true,
            actions: () => FE.createCollectionActions(modelId, "measurements")
        },
        {
            key    : "artefact",
            label  : "Artefact",
            icon   : "collection-item",
            count  : FE.countObjectFields(model.artefact),
            content: () => THOTH.Artefacts.createDetailsView(modelId)
        },
        {
            key    : "transforms",
            label  : "Transforms",
            icon   : "settings",
            openPanel: (sectionKey) => FE.openTransformPanel(modelId, sectionKey)
        },
        {
            key    : "metadata",
            label  : `Metadata (${FE.getMetadataSchemaLabel(model.metadata)})`,
            icon   : "list",
            count  : FE.countObjectFields(model.metadata?.attributes),
            openModal: (sectionKey) => FE.openMetadataModal(modelId, sectionKey)
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
        const isSectionOpen = FE.sceneTreeExpanded.has(sectionKey);
        elParent.append(THOTH.UI.createSceneTreeRow({
            label     : section.label,
            icon      : section.icon,
            count     : section.count,
            active    : FE.sceneTreeActiveKey === sectionKey,
            level     : 1,
            expandable: section.expandable === true,
            open      : isSectionOpen,
            actions   : section.actions ? section.actions() : undefined,
            onexpand  : section.expandable ? () => FE.toggleSceneTreeNode(sectionKey) : undefined,
            onselect  : () => {
                if (section.expandable) {
                    FE.toggleSceneTreeNode(sectionKey);
                    return;
                }

                if (section.openPanel) {
                    section.openPanel(sectionKey);
                    return;
                }

                if (section.openModal) {
                    section.openModal(sectionKey);
                    return;
                }

                FE.openSceneTreePanel(
                    sectionKey,
                    `${modelId} - ${section.label}`,
                    section.content()
                );
            }
        }));

        if (!isSectionOpen) continue;

        if (section.key === "selections" ||
            section.key === "measurements" ||
            section.key === "semantic_annotations") {
            const elChildren = THOTH.UI.createSceneTreeChildren();
            FE.appendAnnotationRows(elChildren, modelId, section.key, annotations[section.key]);
            elParent.append(elChildren);
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
            actions : FE.createAnnotationRowActions(modelId, collectionName, itemId, item),
            onselect: () => FE.selectAnnotationRow(itemKey, collectionName, itemId, modelId)
        }));
    }
};

FE.createCollectionActions = (modelId, collectionName) => {
    const actions = [];

    if (collectionName === "selections") {
        actions.push(FE.createSceneTreeAction({
            icon   : "add",
            tooltip: "New Selection",
            onpress: () => THOTH.fire("createSelection", { modelId: modelId })
        }));
    }

    return actions;
};

FE.createAnnotationRowActions = (modelId, collectionName, itemId, item) => {
    return [
        FE.createSceneTreeAction({
            icon   : "list",
            tooltip: "Edit details",
            onpress: () => FE.openAnnotationPanel(
                `model:${modelId}:${collectionName}:${itemId}`,
                collectionName,
                itemId,
                modelId
            )
        }),
        FE.createSceneTreeAction({
            icon   : item?.visible === false ? THOTH.PATH_RES_ICONS + "visibility_no.png" : "visibility",
            tooltip: item?.visible === false ? "Show" : "Hide",
            onpress: () => FE.toggleAnnotationVisibility(modelId, collectionName, itemId, item)
        }),
        FE.createSceneTreeAction({
            icon   : ATON.PATH_RES + "icons/trash.png",
            tooltip: "Delete",
            onpress: () => FE.deleteAnnotationItem(collectionName, itemId, item)
        })
    ];
};

FE.toggleAnnotationVisibility = (modelId, collectionName, itemId, item) => {
    if (collectionName === "selections") {
        THOTH.Selections.updateVisibility(modelId, itemId, item?.visible === false);
    }
    else if (collectionName === "measurements") {
        THOTH.fire("toggleMeasurementVisibility", itemId);
    }
    else if (collectionName === "semantic_annotations") {
        THOTH.fire("toggleSemanticAnnotationVisibility", itemId);
    }
};

FE.deleteAnnotationItem = (collectionName, itemId, item) => {
    let didFire = false;

    if (collectionName === "selections") {
        didFire = THOTH.fire("deleteSelection", itemId);
    }
    else if (collectionName === "measurements") {
        didFire = THOTH.fire("deleteMeasurement", {
            id    : itemId,
            point1: item?.points?.[0],
            point2: item?.points?.[1]
        });
    }
    else if (collectionName === "semantic_annotations") {
        didFire = THOTH.fire("deleteSemanticAnnotation", itemId);
    }

    if (didFire === false) return;
    if (item) item.trash = true;
    FE.refreshSceneTree();
};

FE.selectAnnotationRow = (key, collectionName, itemId, modelId) => {
    THOTH.Annotations?.select?.(collectionName, itemId, {
        modelId: modelId
    });

    FE.refreshSceneTree();
};

FE.openAnnotationPanel = (key, collectionName, itemId, modelId) => {
    THOTH.Annotations?.select?.(collectionName, itemId, {
        modelId: modelId
    });

    if (collectionName === "selections") {
        THOTH.UI.modalSelectionDetails(itemId);
    }
    else if (collectionName === "measurements") {
        THOTH.UI.modalMsrDetails(itemId);
    }
    else if (collectionName === "semantic_annotations") {
        const annotationKey = THOTH.SemAnnotations.getAnnotationKey(itemId);
        THOTH.UI.modalSemAnnotationDetails(annotationKey);
    }

    FE.refreshSceneTree();
};

FE.openMetadataModal = (modelId, key) => {
    FE.sceneTreeActiveKey = key;
    THOTH.Transforms?.detachGizmo();
    THOTH.requireAuth("edit metadata", () => THOTH.UI.modalModelMetadata(modelId));
    FE.refreshSceneTree();
};

FE.getMetadataSchemaLabel = (metadata = {}) => {
    const schemaName = THOTH.MD?.getSchemaName?.(metadata);
    if (!schemaName) return "-";

    return THOTH.MD?.resolveSchemaName?.(schemaName) || schemaName;
};

FE.countCollectionItems = (collection = {}) => {
    return Object.keys(collection).filter(itemId => collection[itemId]?.trash !== true).length;
};

FE.countObjectFields = (value = {}) => {
    if (!value || typeof value !== "object") return 0;
    return Object.keys(value).filter(key => value[key] !== undefined && value[key] !== "").length;
};

// Panels

FE.setupSettingsPanel = () => {
    const elOptionsBody = ATON.UI.createContainer();
    const elMode        = ATON.UI.createContainer();

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

    // Options Tree
    const elOptions = ATON.UI.createTreeGroup({
        items: [
            {
                title  : "UI Mode",
                open   : false,
                content: elMode
            },
        ]
    });
    
    elOptionsBody.append(elOptions);
    
    return elOptionsBody;
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
    const modelKey = `model:${selection.model_id}`;
    const selectionsKey = `${modelKey}:selections`;

    FE.sceneTreeExpanded.add(modelKey);
    FE.sceneTreeExpanded.add(selectionsKey);

    // Resurrect selection if it already exists
    if (FE.selectionControllerMap.has(selectionKey)) {
        const controller = FE.selectionControllerMap.get(selectionKey);
        controller.style.display = 'flex';
        if (controller.faceCountBtn) {
            controller.faceCountBtn.textContent = `${THOTH.Selections.getFaceCount(selection)} faces`;
        }
        const nameButton = FE.selectionNameMap.get(selectionKey);
        if (nameButton) nameButton.textContent = selection.name;
        if (THOTH.Selections.getActiveSelection() === selection) {
            THOTH.Annotations?.select?.("selections", selection.id, {
                modelId: selection.model_id
            });
        }
        FE.refreshSceneTree();
        return;
    }

    // Create new name button
    const newSelectionNameBtn = ATON.UI.createButton({
        text   : selection.name,
        onpress: () => THOTH.Annotations?.select?.("selections", selectionId, {
            modelId: selection.model_id
        })
    });
    FE.selectionNameMap.set(selectionKey, newSelectionNameBtn);
    
    // Create new controller
    const newSelectionController = THOTH.UI.createSelectionController(selectionId, selection.model_id);
    FE.selectionControllerMap.set(selectionKey, newSelectionController);

    // Add to list
    FE.selectionList.append(newSelectionController);
    if (THOTH.Selections.getActiveSelection() === selection) {
        THOTH.Annotations?.select?.("selections", selection.id, {
            modelId: selection.model_id
        });
    }
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
    FE.refreshSceneTree();
};

FE.deleteModel = (modelName) => {
    FE.refreshSceneTree();
};


// Measurements

FE.addMsr = (msrId) => {
    const measurementKey = THOTH.MSR.getMeasurementKey(msrId);
    const measurement = THOTH.MSR.getMeasurement(measurementKey);
    if (!measurement) return;

    if (measurement.model_id) {
        FE.sceneTreeExpanded.add(`model:${measurement.model_id}`);
        FE.sceneTreeExpanded.add(`model:${measurement.model_id}:measurements`);
    }

    // Resurrect measurement if it already exists
    if (FE.msrMap.has(measurementKey)) {
        FE.msrMap.get(measurementKey).style.display = "flex";
        FE.refreshSceneTree();
        return;
    }

    // Create new name button
    const newMsrNameBtn = ATON.UI.createButton({
        text   : measurement.name,
        onpress: () => THOTH.Annotations?.select?.("measurements", measurementKey)
    });
    FE.msrNameMap.set(measurementKey, newMsrNameBtn);

    // Create new controller
    const newMsrController = THOTH.UI.createMsrController(measurementKey);
    FE.msrMap.set(measurementKey, newMsrController);

    // Add to list
    FE.msrList.append(newMsrController);
    FE.refreshSceneTree();
};

FE.deleteMsr = (msrId) => {
    const measurementKey = THOTH.MSR.getMeasurementKey(msrId);
    const controller = FE.msrMap.get(measurementKey);
    if (controller) controller.style.display = 'none';
    FE.refreshSceneTree();
    // Add logic ? 
};


// Semantic annotations

FE.addSemAnnotation = (annotationId) => {
    const annotationKey = THOTH.SemAnnotations.getAnnotationKey(annotationId);
    const annotation = THOTH.SemAnnotations.getAnnotation(annotationKey);
    if (!annotation) return;

    if (annotation.model_id) {
        FE.sceneTreeExpanded.add(`model:${annotation.model_id}`);
        FE.sceneTreeExpanded.add(`model:${annotation.model_id}:semantic_annotations`);
    }

    if (FE.semMap.has(annotationKey)) {
        FE.semMap.get(annotationKey).style.display = "flex";
        FE.refreshSceneTree();
        return;
    }

    const newSemNameBtn = ATON.UI.createButton({
        text   : annotation.name,
        onpress: () => {
            THOTH.Annotations?.select?.("semantic_annotations", annotationKey);
            THOTH.UI.modalSemAnnotationDetails(annotationKey);
        },
    });
    FE.semNameMap.set(annotationKey, newSemNameBtn);

    const newSemController = THOTH.UI.createSemAnnotationController(annotationKey);
    FE.semMap.set(annotationKey, newSemController);

    FE.semList.append(newSemController);
    FE.refreshSceneTree();
};

FE.deleteSemAnnotation = (annotationId) => {
    const annotationKey = THOTH.SemAnnotations.getAnnotationKey(annotationId);
    const controller = FE.semMap.get(annotationKey);
    if (controller) controller.style.display = "none";
    FE.refreshSceneTree();
};


// Misc

FE.handleElementHighlight = (elname, elMap) => {
    if (!elMap) return;

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
    // Long messages must wrap: the default aton-btn is a fixed-height,
    // overflow-hidden, nowrap element that clips them.
    const elText = ATON.UI.createButton({
        text: msg,
    });
    elText.style.height     = "auto";
    elText.style.whiteSpace = "normal";
    elText.style.textAlign  = "left";

    const elMsg = THOTH.UI.createSplitRow({
        classes: "bg-body-secondary opacity-75",
        colLeft  : 10,
        itemsLeft: elText,
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
