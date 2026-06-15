/*===========================================================================

    THOTH
    UI modules

    Author: 
        Stelios Alvanos (steliosalvanos@gmail.com)
        Ioannis Giannoukos
        Apostolos Kastrisis

===========================================================================*/
let UI = {};

UI.activeTransformControls = {
    position: null,
    rotation: null,
    scale: null
};


// Modules

UI.createBool = (options) => {
    let container = document.createElement('div');
    container.classList.add('form-check', 'thoth-bool');

    let el = document.createElement('input');
    el.classList.add('form-check-input');
    el.setAttribute('type', 'checkbox');

    if (options.value) el.checked = options.value;

    if (options.text) {
        let label = document.createElement('label');
        label.classList.add('form-check-label');
        label.innerHTML = options.text;
        if (options.icon) ATON.UI.prependIcon(label, options.icon);
        container.appendChild(label);
        container.appendChild(el);
    }
    else container.appendChild(el);

    if (options.variant) container.classList.add("form-check-" + options.variant);

    if (options.size) {
        if (options.size === "large") el.classList.add("form-check-lg");
        if (options.size === "small") el.classList.add("form-check-sm");
    }

    if (options.classes) el.className = el.className + " " + options.classes;

    if (options.tooltip) el.setAttribute("title", options.tooltip);

    if (options.onchange) el.onchange = () => options.onchange(el.checked);

    return container;
};

UI.createToolOptionsPanel = (title, content) => {
    const elBody = ATON.UI.createContainer({
        classes: "thoth-tool-options-panel"
    });

    const elHeader = ATON.UI.createContainer({
        classes: "thoth-tool-options-header"
    });
    const elContent = ATON.UI.createContainer({
        classes: "thoth-tool-options-content"
    });
    const elToggle = ATON.UI.createButton({
        text   : `${title} -`,
        tooltip: "Toggle options",
        onpress: () => {
            const isCollapsed = elContent.classList.toggle("d-none");
            elBody.classList.toggle("thoth-tool-options-collapsed", isCollapsed);
            elToggle.textContent = isCollapsed ? `${title} +` : `${title} -`;
        }
    });

    elHeader.append(elToggle);

    elBody.append(elHeader);
    if (content) elContent.append(content);
    elBody.append(elContent);

    return elBody;
};

UI.createToolOptionRow = (label, control, tooltip) => {
    const elRow = ATON.UI.createContainer({
        classes: "thoth-tool-option-row"
    });
    const elLabel = ATON.UI.createButton({
        text   : label,
        tooltip: tooltip || label
    });

    elLabel.classList.add("thoth-tool-option-label");
    if (control) control.classList.add("thoth-tool-option-control");

    elRow.append(elLabel);
    if (control) elRow.append(control);

    return elRow;
};

UI.modelTransformControl = (options) => {
    // Same as ATON's but with parsable modelName 
    let baseid = ATON.Utils.generateID("ftrans");
    
    let el = document.createElement('div');
    el.id = baseid;

    let N = undefined;
    if (options.node) N = ATON.getSceneNode(options.node);
    
    // Position
    if (options.position){
        let elPos = UI.createVectorControl({
            vector   : N.position,
            step     : options.position.step,
            reset    : [0,0,0],
            modelName: N.name,
        }, "position");
        el.append(ATON.UI.elem("<label class='form-label hathor-text-block' for='"+elPos.id+"'>Position</label>") );
        el.append(elPos);
        UI.activeTransformControls.position = elPos;//added this
    }

    // Scale
    if (options.scale){
        let elScale = UI.createVectorControl({
            vector   : N.scale,
            step     : options.scale.step,
            reset    : [1,1,1],
            modelName: N.name,
        }, "scale");
        el.append(ATON.UI.elem("<label class='form-label hathor-text-block' for='"+elScale.id+"'>Scale</label>") );
        el.append(elScale);
        UI.activeTransformControls.scale = elScale;
    }

    // Rotation
    if (options.rotation){
        let elRot = UI.createVectorControl({
            vector   : N.rotation,
            step     : options.rotation.step,
            reset    : [0,0,0],
            modelName: N.name,
        }, "rotation");
        el.append( ATON.UI.elem("<label class='form-label hathor-text-block' for='"+elRot.id+"'>Rotation</label>") );
        el.append( elRot );
        UI.activeTransformControls.rotation = elRot;
    }

    return el;
};

UI.syncTransformUI = (obj) => {

    if (UI.activeTransformControls.position) {

        const el = UI.activeTransformControls.position;
        el.children[0].value = obj.position.x.toFixed(3);
        el.children[1].value = obj.position.y.toFixed(3);
        el.children[2].value = obj.position.z.toFixed(3);
    }

    if (UI.activeTransformControls.rotation) {

        const el = UI.activeTransformControls.rotation;
        el.children[0].value = obj.rotation.x.toFixed(3);
        el.children[1].value = obj.rotation.y.toFixed(3);
        el.children[2].value = obj.rotation.z.toFixed(3);
    }

    if (UI.activeTransformControls.scale) {

        const el = UI.activeTransformControls.scale;
        el.children[0].value = obj.scale.x.toFixed(3);
        el.children[1].value = obj.scale.y.toFixed(3);
        el.children[2].value = obj.scale.z.toFixed(3);
    }
};

UI.createVectorControl = (options, transform)=>{
    // Same as ATON's with additional control for collaborative updates and history
    let baseid = ATON.Utils.generateID("vec3");

    let V = undefined;
    if (options.vector) V = options.vector;

    let step = 0.01;
    if (options.step) step = options.step;

    let posx = V? V.x : 0.0;
    let posy = V? V.y : 0.0;
    let posz = V? V.z : 0.0;

    let el = ATON.UI.elem(`
        <div class="input-group mb-3 aton-inline">
            <input type="number" class="form-control aton-input-x" placeholder="x" aria-label="x" step="${step}" value="${posx}">
            <input type="number" class="form-control aton-input-y" placeholder="y" aria-label="y" step="${step}" value="${posy}">
            <input type="number" class="form-control aton-input-z" placeholder="z" aria-label="z" step="${step}" value="${posz}">
        </div>
    `);

    if (options.label){
        el.prepend( ATON.UI.elem("<span class='input-group-text aton-inline'>"+options.label+"</span>"));
    }

    if (options.reset){
        let R = options.reset;
        el.append(ATON.UI.createButton({
            icon   : "cancel",
            classes: "btn-default",
            onpress: ()=>{
                elInputX.value = R[0];
                elInputY.value = R[1];
                elInputZ.value = R[2];

                const l = {
                    modelName: options.modelName,
                    value    : {
                        x: R[0],
                        y: R[1],
                        z: R[2],
                    },
                }
                if (transform === "position") {
                    //THOTH.fire("modelTransformPosInput", (l));
                    THOTH.fire("modelTransformPos", (l));
                }
                else if (transform === "rotation") {
                    //THOTH.fire("modelTransformRotInput", (l)); 
                    THOTH.fire("modelTransformRot", (l)); 
                }
                else if (transform === "scale") {
                    THOTH.fire("modelTransformScale", (l));
                }
                if (options.onupdate) options.onupdate();
            }
        }))
    }

    el.id = baseid;

    let elInputX = el.children[0];
    let elInputY = el.children[1];
    let elInputZ = el.children[2];

    elInputX.onchange = () => {
        const l = {
            modelName: options.modelName,
            value    : {
                x: elInputX.value,
                y: elInputY.value,
                z: elInputZ.value,
            },
        }
        if (transform === "position") {
            THOTH.fire("modelTransformPos", l);
        }
        else if (transform === "rotation") {
            THOTH.fire("modelTransformRot", l);
        }
        else if (transform === "scale") {
            THOTH.fire("modelTransformScale", l);
        }
         
        if (options.onupdate) options.onupdate();
    };

    elInputY.onchange = () => {
        const l = {
            modelName: options.modelName,
            value    : {
                x: elInputX.value,
                y: elInputY.value,
                z: elInputZ.value,
            },
        }
        if (transform === "position") {
            //THOTH.fire("modelTransformPosInput", (l));
               THOTH.fire("modelTransformPos", (l));
        }
        else if (transform === "rotation") {
          //  THOTH.fire("modelTransformRotInput", (l));
            THOTH.fire("modelTransformRot", (l));
        }
        else if (transform === "scale") {
            THOTH.fire("modelTransformScale", l);
        }
      
        if (options.onupdate) options.onupdate();
    };

    elInputZ.onchange = ()=>{
        const l = {
            modelName: options.modelName,
            value    : {
                x: elInputX.value,
                y: elInputY.value,
                z: elInputZ.value,
            },
        }
        if (transform === "position") {
            //THOTH.fire("modelTransformPosInput", (l));
            THOTH.fire("modelTransformPos", (l));
        }
        else if (transform === "rotation") {
            //THOTH.fire("modelTransformRotInput", (l));
            THOTH.fire("modelTransformRot", (l));
        }
        else if (transform === "scale") {
            THOTH.fire("modelTransformScale", l);
        }
        if (options.onupdate) options.onupdate();
    };

    return el;
};

UI.createSplitRow = (options) => {
    const elRow = ATON.UI.createContainer({classes: "row g-0 align-items-center w-100 rounded-2 px-2 py-1 mb-1"});
    if (options.classes) elRow.className = elRow.className + " " + options.classes;
    
    let colLeft;
    if (options.colLeft) colLeft = options.colLeft;
    else colLeft = 7;

    let colRight = 12 - colLeft;

    const elLeft  = ATON.UI.createContainer({classes: `col-${colLeft} d-flex align-items-center`});
    const elRight = ATON.UI.createContainer({classes: `col-${colRight} d-flex justify-content-end align-items-center`});

    if (options.itemsLeft) elLeft.append(options.itemsLeft);
    if (options.itemsRight) elRight.append(options.itemsRight);
    
    elRow.append(elLeft, elRight);
    return elRow;
};

UI.createUserButton = () => {
    UI._elUserBTN = ATON.UI.createButton({
        icon    : "user",
        onpress : () => UI.modalUser(),
        tooltip : "User"
    });

    ATON.checkAuth(
        (u)=>{
            THOTH.setAuthState(u);
            UI._elUserBTN.classList.add("aton-btn-highlight");
        },
        () => THOTH.setAuthState(null)
    );
    UI._elUserBTN.classList.add("thoth-dark-btn");

    return UI._elUserBTN;
};

UI.createExportButton = () => {
    return ATON.UI.createButton({
        icon   : "link",
        text   : "Export changes",
        variant: "success",
        tooltip: "Export changes",
        onpress: () => THOTH.requireAuth("export changes", () => THOTH.UI.modalExport())
    })
};

UI.createTextBlock = (content)=>{
    let el = ATON.UI.createContainer({
        classes: "hathor-text-block"
    });

    if (content) el.append(content);

    return el;
}

UI.createColorPicker = (options) => {
    if (!options) options = {};

    const label = options.label || "";
    if (!UI._colorPickerStyle) {
        UI._colorPickerStyle = document.createElement("style");
        UI._colorPickerStyle.textContent = `
            .thoth-color-picker {
                appearance: none;
                -webkit-appearance: none;
                background: transparent;
                border: 0;
                box-shadow: none;
                cursor: pointer;
                display: block;
                height: 1.75rem;
                min-height: 1.75rem;
                padding: 0;
                width: 1.75rem;
            }

            .thoth-color-picker::-webkit-color-swatch-wrapper {
                padding: 0;
            }

            .thoth-color-picker::-webkit-color-swatch {
                border: 0;
                border-radius: 0.25rem;
            }

            .thoth-color-picker::-moz-color-swatch {
                border: 0;
                border-radius: 0.25rem;
            }
        `;
        document.head.append(UI._colorPickerStyle);
    }

    const el = ATON.UI.createContainer({
        classes: "d-inline-flex align-items-center flex-grow-0 border-0"
    });
    el.style.width     = "1.75rem";
    el.style.minWidth  = "1.75rem";
    el.style.maxWidth  = "1.75rem";
    el.style.height    = "1.75rem";
    el.style.minHeight = "1.75rem";
    el.style.border    = "0";
    el.style.lineHeight = "0";
    el.style.overflow   = "hidden";

    if (options.label) {
        el.append(ATON.UI.elem("<span class='input-group-text aton-inline'>" + label + "</span>"));
    }

    const elInput = ATON.UI.elem(`<input class="thoth-color-picker" aria-label="${label}" type="color">`);
    ATON.UI.registerElementAsComponent(elInput, "input");

    elInput.onfocus = () => { ATON.UI._bInput = true; };
    elInput.onblur  = () => { ATON.UI._bInput = false; };

    if (options.color) elInput.value = options.color;

    if (options.onchange) elInput.onchange = () => {
        options.onchange(elInput.value);
    };

    if (options.oninput) elInput.oninput = () => {
        options.oninput(elInput.value);
    };

    el.append(elInput);

    return el;
};

UI.createSelectionStructureBlock = () => {
    const elBlock = ATON.UI.createContainer({
        classes: "border rounded-2 bg-body mt-2 mb-2 shadow-sm overflow-hidden"
    });
    elBlock.classList.add("mx-2");
    elBlock.style.boxSizing = "border-box";
    elBlock.style.width     = "calc(100% - 1rem)";

    const elHeader = ATON.UI.createContainer({
        classes: "border-bottom px-3 py-2"
    });
    elHeader.append(ATON.UI.createButton({
        text: "Selection Structure",
        icon: "collection-item",
        size: "small"
    }));

    const elBody = ATON.UI.createContainer({
        classes: "px-3 py-2"
    });

    const elText = document.createElement("p");
    elText.classList.add("mb-2");
    // elText.textContent = "Each selection is stored with this structure:";

    const elStructure = document.createElement("pre");
    elStructure.classList.add("bg-body-secondary", "rounded-2", "p-3", "mb-0");
    elStructure.style.fontSize  = "0.78rem";
    elStructure.style.lineHeight = "1.45";
    elStructure.style.overflowX  = "auto";
    elStructure.textContent = `models
|-- model_1
|   |-- selections
|   |   |-- selection_1
|   |   |   |-- name
|   |   |   |-- annotation
|   |   |   |   |-- selected_faces
|   |   |   |   |-- selection_color
|   |-- name
| ...`;

    elBody.append(elText, elStructure);
    elBlock.append(elHeader, elBody);

    return elBlock;
};

UI.createSceneTreeRow = (options = {}) => {
    const elRow = ATON.UI.createContainer({
        classes: "thoth-scene-tree-row"
    });

    if (options.classes) elRow.className = elRow.className + " " + options.classes;
    if (options.level !== undefined) elRow.dataset.level = options.level;

    const elExpand = ATON.UI.createButton({
        text   : options.expandable ? (options.open ? "-" : "+") : "",
        size   : "small",
        classes: "thoth-scene-tree-expand",
        tooltip: options.expandable ? "Expand" : "",
        onpress: options.expandable && options.onexpand ? () => options.onexpand() : undefined
    });
    elExpand.disabled = !options.expandable;

    const elLabel = ATON.UI.createButton({
        text   : options.label || "",
        icon   : options.icon,
        size   : "small",
        tooltip: options.tooltip || options.label || "",
        onpress: () => {
            if (options.onselect) options.onselect();
        }
    });
    elLabel.classList.add("flex-grow-1", "text-start");
    if (options.selectable === false || !options.onselect) {
        elLabel.disabled = true;
        elLabel.classList.add("opacity-100");
    }

    if (options.active) elLabel.classList.add("aton-btn-highlight");

    elRow.append(elExpand, elLabel);

    if (options.count !== undefined) {
        const elCount = document.createElement("span");
        elCount.classList.add("small", "thoth-scene-tree-count");
        elCount.textContent = String(options.count);
        elRow.append(elCount);
    }

    if (Array.isArray(options.actions) && options.actions.length > 0) {
        const elActions = ATON.UI.createContainer({
            classes: "d-flex align-items-center gap-1"
        });

        for (const action of options.actions) {
            if (action) elActions.append(action);
        }

        elRow.append(elActions);
        elRow.actions = elActions;
    }

    elRow.expandButton = elExpand;
    elRow.labelButton  = elLabel;

    return elRow;
};

UI.createSceneTreeChildren = () => {
    return ATON.UI.createContainer({
        classes: "thoth-scene-tree-children"
    });
};

UI.createPlaceholderPanel = (title, message) => {
    const elBody = ATON.UI.createContainer({
        classes: "p-2"
    });

    const elTitle = document.createElement("h6");
    elTitle.classList.add("mb-2");
    elTitle.textContent = title || "";

    const elMessage = document.createElement("p");
    elMessage.classList.add("mb-0", "text-body-secondary");
    elMessage.textContent = message || "";

    elBody.append(elTitle, elMessage);

    return elBody;
};


// Controllers

UI.createModelController = (modelName) => {
    const elLeft  = ATON.UI.createContainer();
    const elRight = ATON.UI.createContainer({
        classes: "d-flex justify-content-end align-items-center gap-1"
    });

    elLeft.append(
        // Visibility
        ATON.UI.createButton({
            icon   : "visibility",
            size   : "small",
            onpress: () => THOTH.Models.toggleVisibility(modelName),
        }), 
        // Name
        ATON.UI.createButton({
            text   : modelName,
            size   : "small",
            onpress: () => {}
        }),     
    );

    elRight.append(
        ATON.UI.createButton({
            icon   : "focus",
            size   : "small",
            tooltip: "Focus model",
            onpress: () => THOTH.Models.focusModel(modelName)
        }),
        ATON.UI.createButton({
            icon   : ATON.PATH_RES + "icons/trash.png",
            size   : "small",
            tooltip: "Delete model",
            onpress: () => {
                THOTH.Models.deactivateTransformControls();
                THOTH.fire("deleteModel", modelName);
            }
        })
    );

    const elController = UI.createSplitRow({
        // classes   : "row g-0 align-items-center w-100 rounded-2 border px-2 py-1 mb-1",
        colLeft   : 7,
        itemsLeft : elLeft,
        itemsRight: elRight,
    });
    
    return elController;
};

UI.createSceneController = () => {
    const elController = UI.createSplitRow({
        classes   : "bg-body-secondary",
        colLeft   : 12,
        itemsLeft : ATON.UI.createButton({
            text: "Scene",
            icon: "scene",
            size: "small"
        })
    });
    return elController;
};

UI.createSelectionController = (selectionId, modelId) => {
    const elLeft  = ATON.UI.createContainer();
    const elRight = ATON.UI.createContainer();
    
    const selection = THOTH.Selections.getSelection(modelId, selectionId);
    const selectionKey = THOTH.Selections._makeKey(modelId, selectionId);
    const faceCount = THOTH.Selections.getFaceCount(selection);
    
    // Name
    elLeft.classList.add("d-flex", "align-items-center");
    elLeft.append(
        // Visibility
        ATON.UI.createButton({
            icon   : "visibility",
            size   : "small",
            onpress: () => THOTH.Selections.updateVisibility(modelId, selectionId, selection.visible === false),
        }),
        THOTH.FE.selectionNameMap.get(selectionKey),
        (() => {
            const faceCountBtn = ATON.UI.createButton({
                text: `${faceCount} faces`,
                size: "small"
            });
            elLeft.faceCountBtn = faceCountBtn;
            return faceCountBtn;
        })(),
    );
    let elCP = UI.createColorPicker({
        color  : selection.selection_color,
        id     : `selection${selectionId}CP`,
        oninput: (color) => {
            selection.selection_color = color;
            selection.annotation.selection_color = color;
            THOTH.updateVisibility();
        },
        onchange: (color) => {
            THOTH.Selections.updateSelection(modelId, selectionId, {
                annotation: {
                    ...selection.annotation,
                    selection_color: color
                }
            }, "selection_color");
        },
    });
    elCP.id = `selection${selectionId}CP`;
    elRight.classList.add("d-flex", "justify-content-end", "align-items-center", "gap-1");
    elRight.append(
        // Metadata
        ATON.UI.createButton({
            icon   : "list",
            size   : "small",
            tooltip: "Edit selection",
            onpress: () => {
                THOTH.Annotations?.select?.("selections", selectionId, {
                    modelId: modelId
                });
                UI.modalSelectionDetails(selectionId);
            },
        }),
        elCP,
        // Delete
        ATON.UI.createButton({
            icon   : ATON.PATH_RES + "icons/trash.png",
            size   : "small",
            onpress: () => THOTH.fire("deleteSelection", (selectionId))
        }),
    );
    
    const elController = UI.createSplitRow({
        // classes   : "bg-body-secondary",
        colLeft   : 7,
        itemsLeft : elLeft,
        itemsRight: elRight,
    });
    elController.faceCountBtn = elLeft.faceCountBtn;
    
    return elController;
};

UI.createMsrController = (msrId) => {
    const elLeft  = ATON.UI.createContainer();
    const elRight = ATON.UI.createContainer();
    
    const measurementKey = THOTH.MSR.getMeasurementKey(msrId);
    const msr = THOTH.MSR.getMeasurement(measurementKey);

    const nameBtn = ATON.UI.createButton({
    text   : msr.name || `Measurement ${measurementKey}`,
    size   : "small",
    tooltip: "Select measurement",
    onpress: () => {
        THOTH.Annotations?.select?.("measurements", measurementKey);
    },
});

    // Name
    elLeft.append(
        // Visibility
        ATON.UI.createButton({
            icon   : "visibility",
            size   : "small",
            onpress: () => THOTH.fire("toggleMeasurementVisibility", measurementKey),
        }),
         nameBtn,
    );
    elRight.append(

        // Details
        ATON.UI.createButton({
            icon   : "list",
            size   : "small",
            tooltip: "View measurement",
            // onpress: () => THOTH.FE.showToast("TBI")
            onpress: () => {
                THOTH.Annotations?.select?.("measurements", measurementKey);
                UI.modalMsrDetails(measurementKey);
            }
        }), 
        // Delete
        ATON.UI.createButton({
            icon   : ATON.PATH_RES + "icons/trash.png",
            size   : "small",
            tooltip: "Delete measurement",
            onpress: () => {
                const msr = THOTH.MSR.getMeasurement(measurementKey);
                //THOTH.fire("deleteMeasurement", (msrId))
                THOTH.fire("deleteMeasurement", {
                    id: measurementKey,
                    point1: msr.points[0],
                    point2: msr.points[1]
             });
            }
        }),
    );

    const elController = UI.createSplitRow({
        colLeft   : 7,
        itemsLeft : elLeft,
        itemsRight: elRight
    });

    elController.nameBtn = nameBtn;

    return elController;
};

UI.createSemAnnotationController = (annotationId) => {
    const elLeft  = ATON.UI.createContainer();
    const elRight = ATON.UI.createContainer();

    const annotationKey = THOTH.SemAnnotations.getAnnotationKey(annotationId);
    const annotation = THOTH.SemAnnotations.getAnnotation(annotationKey);

    const nameBtn = ATON.UI.createButton({
        text   : annotation.name || `Semantic ${annotationKey}`,
        size   : "small",
        tooltip: "Select semantic annotation",
        onpress: () => {
            THOTH.Annotations?.select?.("semantic_annotations", annotationKey);
        }
    });

    elLeft.append(
        ATON.UI.createButton({
            icon   : "visibility",
            size   : "small",
            onpress: () => THOTH.fire("toggleSemanticAnnotationVisibility", annotationKey),
        }),
        nameBtn,
    );

    elRight.append(
        ATON.UI.createButton({
            icon   : "list",
            size   : "small",
            tooltip: "View semantic annotation",
            onpress: () => {
                THOTH.Annotations?.select?.("semantic_annotations", annotationKey);
                UI.modalSemAnnotationDetails(annotationKey);
            }
        }),
        ATON.UI.createButton({
            icon   : ATON.PATH_RES + "icons/trash.png",
            size   : "small",
            tooltip: "Delete semantic annotation",
            onpress: () => THOTH.fire("deleteSemanticAnnotation", annotationKey)
        }),
    );

    const elController = UI.createSplitRow({
        colLeft   : 7,
        itemsLeft : elLeft,
        itemsRight: elRight
    });

    elController.nameBtn = nameBtn;

    return elController;
};


// Editors

UI.createModelTransformEditor = (modelName) => {
    const elBody = ATON.UI.createContainer();
    const elTransformOptions = ATON.UI.createContainer();

    elTransformOptions.append(
        ATON.UI.createButton({
            text   : "Move",
            size   : "medium",
            onpress: () => THOTH.requireAuth("edit transforms", () => {
                if (THOTH.transform) THOTH.transform.setMode("translate");
            })
        }),
        ATON.UI.createButton({
            text   : "Rotate",
            size: "medium",
            onpress: () => THOTH.requireAuth("edit transforms", () => {
                if (THOTH.transform) THOTH.transform.setMode("rotate");
            })
        }),
        ATON.UI.createButton({
            text   : "Scale",
            size: "medium",
            onpress: () => THOTH.requireAuth("edit transforms", () => {
                if (THOTH.transform) THOTH.transform.setMode("scale");
            })
        })
    );

    const transformContent = ATON.UI.createContainer();

    transformContent.append(
        elTransformOptions,
        UI.modelTransformControl({
            node    : modelName,
            position: true,
            scale   : true,
            rotation: true
        })
    );

    const elOptions = ATON.UI.createTreeGroup({
        items: [
            {
                title  : "Transform",
                open   : true,
                content: transformContent
            },
        ]
    });

    elBody.append(elOptions);
    return elBody;
};

UI.createMeshList = (modelName) => {
    const elBody = ATON.UI.createContainer();
    const meshes = THOTH.Models.getModelMeshes(modelName);
    for (const mesh of meshes.keys()) {
        elBody.append(
            ATON.UI.createButton({
                text   : mesh,
                icon   : "collection-item",
                onpress: () => {}
            })
        )
    }
    return elBody;
};


// Options

UI.createMeasureOptions = () => {
    const elContent = ATON.UI.createContainer();
    
    // Distance type map
    const distanceTypeMap = new Map();

    THOTH.MSR.distanceType = 'euclidean';
    
    const elBtnEuclidean = ATON.UI.createButton({
        text: "Euclidean",
        onpress: () => {
            THOTH.MSR.distanceType = 'euclidean';
            THOTH.FE.handleElementHighlight('euclidean', distanceTypeMap);
        }
    });
    distanceTypeMap.set(THOTH.MSR.distanceType, elBtnEuclidean);

    const elBtnGeodesic = ATON.UI.createButton({
        text: "Geodesic",
        onpress: () => {         
            THOTH.MSR.distanceType = 'geodesic';
            THOTH.FE.handleElementHighlight('geodesic', distanceTypeMap);
        }
    });
    distanceTypeMap.set('geodesic', elBtnGeodesic);
    //initial highlight
    THOTH.FE.handleElementHighlight(THOTH.MSR.distanceType,distanceTypeMap);

    const elOptions = ATON.UI.createContainer();
    elOptions.classList.add("d-flex", "align-items-center", "gap-1", "justify-content-end");
    elOptions.append(elBtnEuclidean,elBtnGeodesic);

    const elDistance = UI.createToolOptionRow(
        "Type of distance",
        elOptions,
        "Select type of distance for measurement"
    );
    const elResult = ATON.UI.createContainer({ classes: "thoth-tool-option-result" });
  //  elResult.textContent = "Distance: ";  // default text
   // THOTH.MSR.elResult = elResult; 
    elContent.append(elDistance, elResult);

    return UI.createToolOptionsPanel("Measure Options", elContent);
};

UI.createBrushOptions = () => {
    const elContent = ATON.UI.createContainer();

    // Size
    const elBrushSize = UI.createToolOptionRow(
        "Size",
        ATON.UI.createSlider({
            range  : [
                THOTH.Toolbox.selectorSizeMin,
                THOTH.Toolbox.selectorSizeMax
            ],
            value  : THOTH.Toolbox.selectorSize,
            oninput: (v) => THOTH.Toolbox.setSelectorSize(v)
        }),
        "Select the size of the tool"
    );
    elContent.append(elBrushSize);
    
    return UI.createToolOptionsPanel("Brush/Eraser Options", elContent);
};

UI.createLassoOptions = () => {
    const elContent = ATON.UI.createContainer();

    // Precision
    const elPrecision = UI.createToolOptionRow(
        "Pixel precision",
        ATON.UI.createSlider({
            range  : [0.1, 1],
            value  : THOTH.Toolbox.lassoPrecision,
            step    : 0.1,
            oninput : (v) => THOTH.Toolbox.lassoPrecision = v,
        }),
        "Select the precision of the lasso tool. Higher precision leads to more accurate selection but lower performance"
    );
    // Normal
    const elNormal = UI.createToolOptionRow(
        "Normal threshold",
        ATON.UI.createSlider({
            range  : [-1, 1],
            step   : 0.1,
            value  : THOTH.Toolbox.normalThreshold,
            oninput: (v) => THOTH.Toolbox.normalThreshold = v,
        }),
        "Select the threshold for face selection. -1: Highest tolerance. +1: Lower tolerance"
    );
    // Occluded
    const elOccluded = UI.createToolOptionRow(
        "Select occluded faces",
        UI.createBool({
            onchange: (input) => THOTH.Toolbox.selectObstructedFaces = input,
            tooltip : "Select occluded faces",
        }),
        "Select obscured areas"
    );
    elContent.append(elPrecision, elNormal, elOccluded);

    return UI.createToolOptionsPanel("Lasso Options", elContent);
};


// Modals

UI.modalUser = (msg) => {
    ATON.checkAuth(
        // Logged
        (u)=>{
            THOTH.setAuthState(u);
            let elBody = ATON.UI.createContainer({ classes: "d-grid gap-2" });
            elBody.append(
                ATON.UI.createButton({
                    text   : "Logout",
                    icon   : "exit",
                    classes: "aton-btn-highlight",
                    onpress: ()=>{
                        THOTH.FE.showToast("Logging out. The page will reload.");
                        THOTH.setAuthState(null);
                        ATON.REQ.logout(() => location.reload(true));
                        ATON.UI.hideModal();
                        if (UI._elUserBTN) UI._elUserBTN.classList.remove("aton-btn-highlight");
                    }
                })
            );

            ATON.UI.showModal({
                header: u.username,
                body: elBody
            })
        },
        // Not logged
        () => {
            const elBody = ATON.UI.createLoginForm({
                onSuccess: (r) => {
                    ATON.UI.hideModal();
                    THOTH.onLogin(r);
                    if (UI._elUserBTN) UI._elUserBTN.classList.add("aton-btn-highlight");
                },
                onFail: () => {
                    UI.modalUser("Authentication failed");
                }
            });
            if (msg !== undefined) elBody.append(ATON.UI.createButton({
                text: msg
            })); 
            ATON.UI.showModal({
                header: "User",
                body: elBody
            });
        }
    );
};

UI.modalExport = () => {
    if (!THOTH.requireAuth("export changes")) return;

    // Body
    const elInfo = ATON.UI.createContainer();
    elInfo.textContent = "OVERWRITE CURRENT SCENE DATA?" + 
    "THIS WILL OVERWRITE ANY EXISTING DATA";

    // Footer
    const elFooter = UI.createModalFooter({
        onsuccess: () => {
            // THOTH.exportToHestia();
            THOTH.exportChanges();
            ATON.UI.hideModal();
        },
        successText: "Export changes"
    }) 

    ATON.UI.showModal({
        header: "Export changes?",
        body  : elInfo,
        footer: elFooter
    });
};

UI.modalBuildVP = (modelName) => {
    THOTH.SVP.readColmap(modelName).then((colmapMap) => {
        if (!colmapMap) {
            THOTH.FE.showToast("No COLMAP text detected");
            return;
        };
        const recommended = Math.min(Math.floor(colmapMap.size / 2), 20);

        // Return variables
        let vpNumber = recommended;
        let vpMap    = new Map();
        let mode     = "uniform";
    
        const elBody   = ATON.UI.createContainer();
    
        // Info
        const elInfo = ATON.UI.createContainer();
        elInfo.textContent = `Found ${colmapMap.size} cameras \n
        Recomended number of viewpoints: ${recommended}`;

        // Uniform Sampling
        const vpUniformSelect = ATON.UI.createInputText({
            placeholder: "Number of viewpoints",
            value      : recommended,
            label      : "Number of generated viewpoints",
            oninput    : (v) => {
                vpNumber = THOTH.Utils.bindInput(v, 1, colmapMap.size);
                vpUniformSelect.querySelector('input').value = vpNumber;
            },
        });
        // Manual Sampling
        const vpManualSelect = ATON.UI.createTagsComponent({
            list    : Array.from(colmapMap.keys()),
            label   : "Generated viewpoints",
            tags    : [],
            onaddtag: (v) => {
                if (colmapMap.has(v)) vpMap.set(v, colmapMap.get(v));
            },
            onremovetag: (v) => {
                vpMap.delete(v);
            }
        })
        
        // Options
        const elOptions = ATON.UI.createContainer();

 const manualBtn = ATON.UI.createButton({
            text   : "Manual Sampling",
            classes: "w-100",
            onpress: () => {
                mode  = "manual";
                updateMode();
            },
        });
        const uniformBtn = ATON.UI.createButton({
            text   : "Uniform Sampling",
            classes: "w-100",
            onpress: () => {
                mode  = "uniform";
                updateMode();
            }
        });

        const elButtonsRow = UI.createSplitRow({
            elLeft: 6,
            itemsLeft: manualBtn,
            itemsRight: uniformBtn
        });

       
        elOptions.append(elButtonsRow);
        
        const updateMode = () => {
            if (mode === "uniform") {
                vpMap = new Map();
                uniformBtn.classList.add("aton-btn-highlight");
                manualBtn.classList.remove("aton-btn-highlight");
                elSamplingMethod.replaceChildren(vpUniformSelect);
            } else {
                vpMap = new Map();
                manualBtn.classList.add("aton-btn-highlight");
                uniformBtn.classList.remove("aton-btn-highlight");
                elSamplingMethod.replaceChildren(vpManualSelect);
            }
        };
        
        const elSamplingMethod = ATON.UI.createContainer();
        updateMode();

        elBody.append(elInfo, elOptions, elSamplingMethod);
        
        // Footer
        const elFooter = UI.createModalFooter({
            onsuccess: () => {
                if (mode === "manual") {
                    THOTH.SVP.buildVPNodes(vpMap, modelName);
                    ATON.UI.hideModal();
                }
                else if (mode === "uniform") {
                    // Sample from vpNumber
                    vpMap = THOTH.Utils.uniformSamplingFromMap(colmapMap, vpNumber);
                    THOTH.SVP.buildVPNodes(vpMap, modelName);
                    ATON.UI.hideModal();
                }
            },
            successText: "Build"
        })
        
        ATON.UI.showModal({
            header: "Build viewpoints for " + modelName,
            body  : elBody,
            footer: elFooter,
        });
    });
};

UI.modalVPImage = (viewpoint) => {
    const elBody = ATON.UI.createContainer({
        classes: "d-flex flex-column"
    });
    
    // Image
    const elImgContainer = ATON.UI.createContainer({
        classes: "d-flex ratio-16x9 w-100 bg-dark"
    });
    const elImg = document.createElement("img");
    elImg.src = viewpoint.image;
    elImg.alt = "Image";
    elImg.onerror = () => {};
    elImg.className = "img-fluid w-100 h-100 object-fit-contain";
    elImgContainer.append(elImg);

    // Description
    const elDescription = ATON.UI.createContainer({
        classes: "pt-2"
    });
    elDescription.append(ATON.UI.createTreeGroup({
        items: [
            {
                title  : "position",
                open   : true,
                content: `x: ${viewpoint.position.x},
                          y: ${viewpoint.position.y}, 
                          z: ${viewpoint.position.z}`
            }
        ]
    }))
    
    elBody.append(elImgContainer, elDescription);
    
    // Footer
    const elFooter = ATON.UI.createContainer();
    elFooter.append(ATON.UI.createButton({
        text   : "Download",
        icon   : "download",
        onpress: () => THOTH.Utils.downloadImage(viewpoint.image.replace("/a/thoth_v2", "")),
        variant: "success",
        tooltip: "Download image",
    }));

    ATON.UI.showModal({
        header: viewpoint.name,
        body  : elBody,
        footer: elFooter,
    });
};

UI.modalAddModel = () => {
    // Get models
    THOTH.requireAuth("import models",
        (u) => {
            ATON.REQ.get(
                // THOTH.config.maseDomain+"items/"+u.username+"/models",
                "items/"+u.username+"/models/",
                entries => {
                    // Body
                    const modelList = new Set();

                    const itemNames = entries.map(item => {
                        return item.replace("items/"+u.username+"/models/", "")
                    });
                    const elInput = ATON.UI.createTagsComponent({
                        list       : itemNames,
                        label      : "Input models",
                        icon       : "add",
                        onaddtag   : (k) => modelList.add(k),
                        onremovetag: (k) => modelList.delete(k)
                    });
                    elInput.classList.add("thoth-add-model-tags");
        
                    // Footer
                    const elFooter = UI.createModalFooter({
                        onsuccess  : () => {
                            for (const modelURL of Array.from(modelList)) {
                                THOTH.fire("addModel", modelURL);
                            }
                            ATON.UI.hideModal();
                        },
                        successText: "Add models"
                    });
        
                    ATON.UI.showModal({
                        header: "Add models",
                        body  : elInput,
                        footer: elFooter,
                    });
        
                }, 
                error => THOTH.FE.showToast("Error loading models:" + error),
            );
        }
    );
};

UI.modalMsrDetails = (msrId, draftData, options = {}) => {
    const msr = THOTH.MSR.getMeasurement(msrId);
    if (!msr && !draftData) return;
    if (msr?.trash) return;

    const source = draftData || msr;
    const dataTemp = THOTH.Annotations?.normalize(source) || structuredClone(source);
    if (source.points) dataTemp.points = source.points;
    if (source.point1) dataTemp.point1 = source.point1;
    if (source.point2) dataTemp.point2 = source.point2;
    if (source.model_id) dataTemp.model_id = source.model_id;
    if (source.distance !== undefined) dataTemp.distance = source.distance;
    if (source.distanceType) dataTemp.distanceType = source.distanceType;
    if (source.path) dataTemp.path = source.path;

    const prevData = msr ? structuredClone(msr) : null;

    const distanceType = source.distanceType ||
        source.distance_type ||
        source.annotation?.distance_type ||
        source.annotation?.distanceType ||
        "euclidean";
    const distance = Number(source.distance ?? source.annotation?.distance ?? 0);
    const elDistanceInfo = ATON.UI.createContainer();
    elDistanceInfo.append(
        UI.createSplitRow({
            colLeft   : 6,
            itemsLeft : ATON.UI.createButton({
                text: "Distance type",
                size: "small"
            }),
            itemsRight: ATON.UI.createButton({
                text: distanceType,
                size: "small"
            })
        }),
        UI.createSplitRow({
            colLeft   : 6,
            itemsLeft : ATON.UI.createButton({
                text: "Distance",
                size: "small"
            }),
            itemsRight: ATON.UI.createButton({
                text: distance.toFixed(4),
                size: "small"
            })
        })
    );

    const elMeasurementActions = ATON.UI.createContainer();
    if (!options.isNew) {
        elMeasurementActions.append(ATON.UI.createButton({
            text   : "Delete Measurement",
            tooltip: "Delete Measurement",
            icon   : ATON.PATH_RES + "icons/trash.png",
            onpress: () => {
                const currentMsr = THOTH.MSR.getMeasurement(msrId);
                THOTH.fire("deleteMeasurement", {
                    id    : msrId,
                    point1: currentMsr?.points?.[0],
                    point2: currentMsr?.points?.[1]
                });

                ATON.UI.hideModal();
            }
        }));
    }

    if (elMeasurementActions.children.length > 0) {
        elDistanceInfo.append(UI.createSplitRow({
            colLeft   : 6,
            itemsLeft : ATON.UI.createButton({
                text: "Actions",
                size: "small"
            }),
            itemsRight: elMeasurementActions
        }));
    }

    const elBody = ATON.UI.createTreeGroup({
        items: [
            ...UI.createAnnotationSharedItems(dataTemp, {
                visibility: true
            }),
            {
                title  : "Distance",
                open   : true,
                content: elDistanceInfo
            }
        ]
    });

    const elFooter = UI.createModalFooter({
        onsuccess: () => {
            const sharedData = UI.collectAnnotationSharedFields(dataTemp);
            if (!sharedData) return;

            if (options.isNew) {
                THOTH.fire("createMeasurement", {
                    id  : msrId,
                    data: sharedData
                });
            }
            else {
                THOTH.fire("editMeasurement", {
                    id      : msrId,
                    data    : sharedData,
                    prevData: prevData
                });
            }
            ATON.UI.hideModal();
        },
        successText: options.isNew ? "Create measurement" : "Save changes"
    }); 

    ATON.UI.showModal({
        header: `${options.isNew ? "Create" : "Edit"} measurement with id: ${msrId}`,
        body  : elBody,
        footer: elFooter,
        wide  : true
    });
};

UI.createTextArea = (options) => {
    const el = ATON.UI.createContainer({classes: "input-group mb-3 aton-inline"});

    if (options.label) {
        el.append(ATON.UI.elem("<span class='input-group-text aton-inline'>" + options.label + "</span>"));
    }

    const elInput = document.createElement("textarea");
    elInput.classList.add("form-control", "aton-input");
    elInput.rows = options.rows || 4;
    elInput.value = options.value || "";

    ATON.UI.registerElementAsComponent(elInput, "input");

    elInput.onfocus = () => { ATON.UI._bInput = true; };
    elInput.onblur  = () => { ATON.UI._bInput = false; };

    if (options.oninput) {
        elInput.oninput = () => options.oninput(elInput.value);
    }

    if (options.onchange) {
        elInput.onchange = () => options.onchange(elInput.value);
    }

    el.append(elInput);

    return el;
};

UI._formatRelationList = (relations) => {
    return JSON.stringify(Array.isArray(relations) ? relations : [], null, 2);
};

UI._parseRelationList = (value, fieldName) => {
    try {
        const parsed = JSON.parse(value || "[]");
        if (Array.isArray(parsed)) return parsed;
    }
    catch (err) {
    }

    THOTH.FE.showToast(`${fieldName} must be a JSON array.`);
    return null;
};

UI.collectAnnotationSharedFields = (dataTemp) => {
    const relatedRgbImages = UI._parseRelationList(dataTemp._relatedRgbImagesText, "Related RGB images");
    if (relatedRgbImages === null) return null;

    const relatedMultispectralImages = UI._parseRelationList(
        dataTemp._relatedMultispectralImagesText,
        "Related multispectral images"
    );
    if (relatedMultispectralImages === null) return null;

    const relatedArtefacts = UI._parseRelationList(dataTemp._relatedArtefactsText, "Related artefacts");
    if (relatedArtefacts === null) return null;

    const data = {
        ...dataTemp,
        related_rgb_images          : relatedRgbImages,
        related_multispectral_images: relatedMultispectralImages,
        related_artefacts           : relatedArtefacts
    };

    delete data._relatedRgbImagesText;
    delete data._relatedMultispectralImagesText;
    delete data._relatedArtefactsText;

    const normalized = THOTH.Annotations?.normalize(data) || data;

    if (dataTemp.point) normalized.point = dataTemp.point;
    if (dataTemp.points) normalized.points = dataTemp.points;
    if (dataTemp.point1) normalized.point1 = dataTemp.point1;
    if (dataTemp.point2) normalized.point2 = dataTemp.point2;
    if (dataTemp.model_id) normalized.model_id = dataTemp.model_id;

    return normalized;
};

UI.createAnnotationSharedItems = (dataTemp, options = {}) => {
    dataTemp._relatedRgbImagesText = UI._formatRelationList(dataTemp.related_rgb_images);
    dataTemp._relatedMultispectralImagesText = UI._formatRelationList(dataTemp.related_multispectral_images);
    dataTemp._relatedArtefactsText = UI._formatRelationList(dataTemp.related_artefacts);

    const items = [
        {
            title  : "Name",
            open   : true,
            content: ATON.UI.createInputText({
                label  : "Name",
                value  : dataTemp.name,
                oninput: (v) => dataTemp.name = v
            })
        },
        {
            title  : "Description",
            open   : true,
            content: UI.createTextArea({
                label  : "Description",
                value  : dataTemp.description,
                rows   : 5,
                oninput: (v) => dataTemp.description = v
            })
        },
        {
            title  : "Related RGB images",
            open   : false,
            content: UI.createTextArea({
                label  : "JSON",
                value  : dataTemp._relatedRgbImagesText,
                rows   : 4,
                oninput: (v) => dataTemp._relatedRgbImagesText = v
            })
        },
        {
            title  : "Related multispectral images",
            open   : false,
            content: UI.createTextArea({
                label  : "JSON",
                value  : dataTemp._relatedMultispectralImagesText,
                rows   : 4,
                oninput: (v) => dataTemp._relatedMultispectralImagesText = v
            })
        },
        {
            title  : "Related artefacts",
            open   : false,
            content: UI.createTextArea({
                label  : "JSON",
                value  : dataTemp._relatedArtefactsText,
                rows   : 4,
                oninput: (v) => dataTemp._relatedArtefactsText = v
            })
        }
    ];

    if (options.visibility) {
        items.push({
            title  : "Visibility",
            open   : false,
            content: UI.createBool({
                text    : "Visible",
                value   : dataTemp.visible !== false,
                onchange: (v) => dataTemp.visible = v
            })
        });
    }

    return items;
};

UI.modalSemAnnotationDetails = (annotationId, draftData, options = {}) => {
    const annotation = THOTH.SemAnnotations.getAnnotation(annotationId);
    if (!annotation && !draftData) return;
    if (annotation?.trash) return;

    const source = draftData || annotation;
    const dataTemp = {
        id                            : annotationId,
        name                          : source.name || `Semantic ${annotationId}`,
        description                   : source.description || "",
        related_rgb_images            : source.related_rgb_images || [],
        related_multispectral_images  : source.related_multispectral_images || [],
        related_artefacts             : source.related_artefacts || [],
        annotation                    : source.annotation || {},
        point                         : source.point,
        model_id                      : source.model_id,
        visible                       : source.visible !== false,
        trash                         : false
    };
    const prevData = annotation ? THOTH.SemAnnotations.cloneAnnotation(annotation) : null;

    const elBody = ATON.UI.createTreeGroup({
        items: UI.createAnnotationSharedItems(dataTemp, {
            visibility: true
        })
    });

    const elFooter = UI.createModalFooter({
        onsuccess: () => {
            const sharedData = UI.collectAnnotationSharedFields(dataTemp);
            if (!sharedData) return;

            if (options.isNew) {
                THOTH.fire("createSemanticAnnotation", {
                    id  : annotationId,
                    data: sharedData
                });
            }
            else {
                THOTH.fire("updateSemanticAnnotation", {
                    id       : annotationId,
                    data     : sharedData,
                    prevData : prevData
                });
            }
            ATON.UI.hideModal();
        },
        oncancel: () => {
            if (options.isNew) THOTH.SemAnnotations.clearTempAnnotationSem();
        },
        successText: "Save changes"
    });

    ATON.UI.showModal({
        header: `Edit semantic annotation with id: ${annotationId}`,
        body  : elBody,
        footer: elFooter,
        wide  : true
    });
};


// Metadata editor

UI.createMetadataEditor = (schema, data_temp) => {
    let elData = ATON.UI.createContainer();

    const isEmptySchema = !schema ||
        (Array.isArray(schema.groups)
            ? schema.groups.length === 0
            : Object.keys(schema).length === 0);

    if (isEmptySchema) {
        elData.append(
            ATON.UI.createButton({
                text: "No metadata found"
            })
        );
        return elData;
    }

    if (!data_temp) data_temp = {};

    const normalizeType = (attr) => {
        const raw = attr?.type || attr?.dataType || "";
        return String(raw).toLowerCase();
    };

    const getEnumOptions = (attr) => {
        return attr?.value || attr?.options || [];
    };

    const ensureValue = (obj, key, fallback) => {
        if (!obj) return fallback;
        if (obj[key] === undefined) obj[key] = fallback;
        return obj[key];
    };

    const buildLabel = (label, attr) => {
        if (attr && attr.unit) return `${label} (${attr.unit})`;
        return label;
    };

    const addFieldDescription = (elField, attr) => {
        if (!attr?.description) return elField;

        const elWrapper = ATON.UI.createContainer({classes: "d-grid gap-1 mb-2"});
        const elDescription = ATON.UI.createContainer({classes: "small text-body-secondary"});

        elDescription.textContent = attr.description;
        elWrapper.append(elField, elDescription);

        return elWrapper;
    };

    const createField = (fieldKey, fieldLabel, attr, targetData) => {
        const type = normalizeType(attr);
        const label = buildLabel(fieldLabel, attr);

        switch (type) {
            case "string":
            case "text":
            case "url":
            case "date":
            case "reference":
                return addFieldDescription(ATON.UI.createInputText({
                    label      : label,
                    value      : ensureValue(targetData, fieldKey, "-"),
                    placeholder: type || "text",
                    oninput    : (v) => targetData[fieldKey] = v,
                }), attr);
            case "integer":
                return addFieldDescription(ATON.UI.createInputText({
                    placeholder: "integer",
                    value      : ensureValue(targetData, fieldKey, 0),
                    label      : label,
                    oninput    : (v) => targetData[fieldKey] = v,
                }), attr);
            case "float":
                return addFieldDescription(ATON.UI.createInputText({
                    placeholder: "float",
                    label      : label,
                    value      : ensureValue(targetData, fieldKey, 0.0),
                    oninput    : (v) => targetData[fieldKey] = v,
                }), attr);
            case "bool":
            case "boolean":
                return addFieldDescription(UI.createBool({
                    text    : label,
                    value   : ensureValue(targetData, fieldKey, false),
                    onchange: (input) => targetData[fieldKey] = input
                }), attr);
            case "enum": {
                const options = getEnumOptions(attr);
                const currentValue = ensureValue(targetData, fieldKey, "-");
                const elDisplay = ATON.UI.createButton({
                    text: currentValue
                });

                return addFieldDescription(UI.createSplitRow({
                    colLeft: 6,
                    itemsLeft: ATON.UI.createDropdown({
                        title: label,
                        items: options.map(option => ({
                            title   : option,
                            onselect: () => {
                                targetData[fieldKey] = option;
                                elDisplay.textContent = option;
                            }
                        }))
                    }),
                    itemsRight: elDisplay,
                }), attr);
            }
            case "enum-multiple":
            case "multienum": {
                const options = getEnumOptions(attr);
                const currentTags = ensureValue(targetData, fieldKey, []);

                if (!Array.isArray(currentTags)) targetData[fieldKey] = [];

                return addFieldDescription(ATON.UI.createTagsComponent({
                    list    : options,
                    label   : label,
                    tags    : targetData[fieldKey],
                    onaddtag: (k) => {
                        if (!targetData[fieldKey].includes(k)) {
                            targetData[fieldKey].push(k);
                        }
                    },
                    onremovetag: (k) => {
                        const index = targetData[fieldKey].indexOf(k);
                        if (index !== -1) {
                            targetData[fieldKey].splice(index, 1);
                        }
                    },
                }), attr);
            }
            default:
                return undefined;
        }
    };

    const buildFromGroups = (groups, targetData) => {
        const elGroup = ATON.UI.createContainer();

        if (!Array.isArray(groups)) return elGroup;

        for (const node of groups) {
            const key = node.id || node.label;
            if (!key) continue;

            const label = node.label || key;
            const type = normalizeType(node);

            if (type === "group" || Array.isArray(node.subgroups)) {
                if (!targetData[key]) targetData[key] = {};
                const content = buildFromGroups(node.subgroups || [], targetData[key]);

                elGroup.append(ATON.UI.createTreeGroup({
                    items: [
                        {
                            title  : label,
                            open   : false,
                            content: content
                        }
                    ]
                }));
            }
            else {
                const elBody = createField(key, label, node, targetData);
                if (elBody) elGroup.append(elBody);
            }
        }

        return elGroup;
    };

    if (Array.isArray(schema.groups)) {
        elData.append(buildFromGroups(schema.groups, data_temp));
        return elData;
    }

    // Backward compatible object-based schema
    for (const key in schema) {
        if (key === "required") continue;
        if (key === "schemaId") continue;
        if (key === "version") continue;
        if (key === "description") continue;
        if (key === "schemaName") continue;

        const attr = schema[key];
        let elBody;

        if (attr?.type || attr?.dataType) {
            elBody = createField(key, key, attr, data_temp);
        }
        else if (typeof attr === "object") {
            if (data_temp[key] === undefined) data_temp[key] = {};

            elBody = ATON.UI.createTreeGroup({
                items: [
                    {
                        title  : key,
                        open   : false,
                        content: UI.createMetadataEditor(attr, data_temp[key])
                    }
                ]
            });
        }

        if (elBody) elData.append(elBody);
    }

    return elData;
};

UI.getSchemaLabel = (schemaName) => {
    const details = THOTH.MD.getSchemaDetails(schemaName);
    const version = details.version;

    if (version === undefined || version === null || version === "") return schemaName;

    return `${schemaName} (v${version})`;
};

UI.createSchemaSelector = (schemaName, onapply) => {
    const schemaNames = Array.from(THOTH.MD.schemaMap.keys());
    let selectedSchemaName = THOTH.MD.resolveSchemaName(schemaName || THOTH.MD.getDefaultSchemaName());

    const elBody = ATON.UI.createContainer({classes: "d-grid gap-2"});
    const elControls = ATON.UI.createContainer({classes: "d-flex align-items-center gap-2"});
    const elInfo = ATON.UI.createContainer({classes: "d-grid gap-1 small text-body-secondary"});

    const elSelect = ATON.UI.elem(`<select class="form-select aton-input" aria-label="Metadata schema"></select>`);
    ATON.UI.registerElementAsComponent(elSelect, "input");

    for (const name of schemaNames) {
        const elOption = document.createElement("option");
        elOption.value = name;
        elOption.textContent = UI.getSchemaLabel(name);
        if (name === selectedSchemaName) elOption.setAttribute("selected", true);
        elSelect.append(elOption);
    }

    const updateInfo = () => {
        const details = THOTH.MD.getSchemaDetails(selectedSchemaName);
        elInfo.replaceChildren();

        const rows = [
            [ "Name", details.name || "-" ],
            [ "Version", details.version || "-" ],
            [ "Description", details.description || "-" ]
        ];

        for (const [label, value] of rows) {
            elInfo.append(UI.createSplitRow({
                colLeft   : 4,
                itemsLeft : ATON.UI.createButton({
                    text: label,
                    size: "small"
                }),
                itemsRight: ATON.UI.createButton({
                    text: value,
                    size: "small"
                })
            }));
        }
    };

    elSelect.onfocus = () => { ATON.UI._bInput = true; };
    elSelect.onblur  = () => { ATON.UI._bInput = false; };
    elSelect.onchange = () => {
        selectedSchemaName = elSelect.value;
        updateInfo();
    };

    elControls.append(
        elSelect,
        ATON.UI.createButton({
            text   : "Apply",
            // icon   : "check",
            variant: "info",
            onpress: () => {
                if (onapply) onapply(THOTH.MD.resolveSchemaName(selectedSchemaName));
            }
        })
    );

    updateInfo();
    elBody.append(elControls, elInfo);

    return elBody;
};

UI.modalSelectionDetails = (selectionId) => {
    const selection = THOTH.Selections.getSelectionById(selectionId);
    if (selection === undefined || selection.trash) return;

    const prev_data  = structuredClone(selection) || {};
    const annotationTemp = THOTH.Annotations?.normalize(selection) || structuredClone(selection);

    const elSelectionActions = ATON.UI.createContainer({classes: "d-flex justify-content-end align-items-center gap-2"});
    elSelectionActions.append(
        UI.createColorPicker({
            color: selection.selection_color,
            onchange: (c) => {
                if (!annotationTemp.annotation) annotationTemp.annotation = {};
                annotationTemp.annotation.selection_color = c;
                annotationTemp.selection_color = c;
                annotationTemp.highlightColor = c;
                THOTH.updateVisibility();
            }
        }),
        ATON.UI.createButton({
            text   : "Delete Selection",
            tooltip: "Delete selection",
            icon   : ATON.PATH_RES + "icons/trash.png",
            onpress: () => {
                THOTH.fire("deleteSelection", (selectionId));
                ATON.UI.hideModal();
            }
        }),
    );

    const elSelectionInfo = UI.createSplitRow({
        colLeft: 8,
        itemsLeft: ATON.UI.createButton({
            text   : selection.name || `Selection ${selectionId}`,
            icon   : "collection-item",
            onpress: () => {}
        }),
        itemsRight: elSelectionActions,
    });
    
    // Body
    const elBody = ATON.UI.createTreeGroup({
        items: [
            // Selection details
            {
                title  : "Selection details",
                open   : true,
                content: elSelectionInfo
            },
            ...UI.createAnnotationSharedItems(annotationTemp, {
                visibility: true
            })
        ]
    });
    // Footer
    const elFooter = UI.createModalFooter({
        onsuccess: () => {
            const sharedData = UI.collectAnnotationSharedFields(annotationTemp);
            if (!sharedData) return;

            if (annotationTemp.selection_color) {
                if (!sharedData.annotation) sharedData.annotation = {};
                sharedData.annotation.selection_color = annotationTemp.selection_color;
                sharedData.selection_color = annotationTemp.selection_color;
                sharedData.highlightColor = annotationTemp.selection_color;
            }

            THOTH.fire("editSelectionMetadata", {
                id            : selectionId,
                data          : selection.metadata || {},
                annotationData: sharedData,
                prevData      : prev_data
            });
            ATON.UI.hideModal();
        },
        successText: "Save changes"
    });

    ATON.UI.showModal({
        header: `Edit selection with id: ${selectionId}`,
        body  : elBody,
        footer: elFooter,
        wide  : true,
    });
}; 

UI.modalModelMetadata = (modelId, data_temp) => {
    const model = THOTH.SceneStore.getModel(modelId);
    if (!model || model.trash) return;

    if (!THOTH.MD.schemasReady) {
        ATON.UI.showModal({
            header: `Edit metadata for ${modelId}`,
            body  : ATON.UI.createButton({
                text: "Loading metadata schemas..."
            }),
            wide  : true
        });

        THOTH.MD.ensureSchemasLoaded().then(() => UI.modalModelMetadata(modelId, data_temp));
        return;
    }

    if (data_temp === undefined) {
        const existingSchemaName = THOTH.MD.getSchemaName(model.metadata || {});
        data_temp = existingSchemaName
            ? THOTH.MD.toCanonicalMetadata(model.metadata || {})
            : THOTH.MD.createPropertiesFromSchema(THOTH.MD.getDefaultSchemaName());
    }

    if (!THOTH.MD.getSchemaName(data_temp)) {
        data_temp = THOTH.MD.createPropertiesFromSchema(THOTH.MD.getDefaultSchemaName());
    }

    const schemaName = THOTH.MD.resolveSchemaName(THOTH.MD.getSchemaName(data_temp));
    const prev_data  = structuredClone(model.metadata) || {};
    const schema     = THOTH.MD.getSchema(schemaName);
    const attributes = THOTH.MD.getAttributes(data_temp);

    const elBody = ATON.UI.createTreeGroup({
        items: [
            {
                title  : "Metadata schema",
                open   : true,
                content: UI.createSchemaSelector(schemaName, (v) => {
                    if (v !== schemaName) {
                        data_temp = THOTH.MD.createPropertiesFromSchema(v);
                        UI.modalModelMetadata(modelId, data_temp);
                    }
                })
            },
            {
                title  : "Metadata",
                open   : true,
                content: UI.createMetadataEditor(schema, attributes),
            }
        ]
    });

    const elFooter = UI.createModalFooter({
        onsuccess: () => {
            THOTH.MD.editModelMetadata(modelId, data_temp, prev_data);
            ATON.UI.hideModal();
        },
        successText: "Save changes"
    });

    ATON.UI.showModal({
        header: `Edit metadata for ${modelId}`,
        body  : elBody,
        footer: elFooter,
        wide  : true,
    });
};

UI.createModalFooter = (options) => {
    const elFooter = ATON.UI.createContainer();
    elFooter.append(
        // Save
        ATON.UI.createButton({
            text   : options.successText || "Save changes",
            size   : "large",
            variant: "success",
            onpress: () => {
                if (options.onsuccess) options.onsuccess();
            }
        }),
        // Cancel
        ATON.UI.createButton({
            text   : "Cancel",
            size   : "large",
            variant: "secondary",
            onpress: () => {
                if (options.oncancel) options.oncancel();
                ATON.UI.hideModal();
            }
        }),
    );
    return elFooter;
};


export default UI;
