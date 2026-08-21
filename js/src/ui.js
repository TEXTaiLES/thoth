/*===========================================================================

    THOTH
    UI modules

    Author: 
        Stelios Alvanos (steliosalvanos@gmail.com)
        Ioannis Giannoukos
        Apostolos Kastrisis

===========================================================================*/
let UI = {};

const normalizeUniqueRelations = (relations, normalizeRelation) => {
    const output = [];
    const seen = new Set();

    for (const relation of Array.from(relations || [])) {
        const normalized = normalizeRelation(relation);
        if (!normalized || seen.has(normalized.id)) continue;

        seen.add(normalized.id);
        output.push(normalized);
    }

    return output;
};

UI.activeTransformControls = {
    position: null,
    rotation: null
};


// Modules

UI.createTagsComponent = (options = {}) => {
    const baseid = ATON.Utils.generateID("thoth-tags");
    const tags = {};
    let isValid = !options.validator;

    const el = ATON.UI.createContainer({
        classes: "input-group aton-inline"
    });
    el.id = baseid;

    let label = "";
    if (options.label) {
        label = options.label;
        el.append(ATON.UI.elem(`<span class="input-group-text aton-inline">${label}</span>`));
    }

    const elInput = ATON.UI.elem(
        `<input class="form-control aton-input" aria-label="${label}" type="search" spellcheck="false">`
    );
    ATON.UI.registerElementAsComponent(elInput, "input");
    elInput.id = `${baseid}-input`;

    const elAdd = ATON.UI.createButton({
        text   : "+",
        classes: "btn-accent",
        tooltip: "Add",
        onpress: () => submitValue()
    });

    const addTag = (rawValue, emit = true) => {
        const value = String(rawValue || "").trim();
        if (value.length < 1) return false;
        if (tags[value]) return false;

        tags[value] = 1;
        if (emit && options.onaddtag) options.onaddtag(value);

        return true;
    };

    const removeTag = (rawValue, emit = true) => {
        const value = String(rawValue || "").trim();
        if (value.length < 1 || !tags[value]) return false;

        delete tags[value];
        if (emit && options.onremovetag) options.onremovetag(value);

        return true;
    };

    const submitValue = () => {
        const value = elInput.value.trim();
        if (value.length < 1 || !isValid) return;
        if (!addTag(value)) return;

        elInput.value = "";
    };

    elInput.onfocus = () => { ATON.UI._bInput = true; };
    elInput.onblur  = () => { ATON.UI._bInput = false; };
    elInput.onkeydown = (event) => {
        if (event.keyCode === 13) submitValue();
    };
    elInput.oninput = () => {
        const value = elInput.value.trim();

        if (options.validator) {
            isValid = options.validator(value);
            if (isValid) elAdd.removeAttribute("disabled");
            else elAdd.setAttribute("disabled", true);
        }

        if (options.oninput) options.oninput(value);
    };

    if (options.onchange) {
        elInput.onchange = () => {
            if (isValid) options.onchange(elInput.value);
        };
    }

    if (options.value) elInput.value = String(options.value);
    if (options.placeholder) elInput.setAttribute("placeholder", options.placeholder);
    if (!isValid) elAdd.setAttribute("disabled", true);

    el.append(elInput);

    if (options.list) {
        const list = options.list;
        elInput.setAttribute("list", `${baseid}-list`);
        const elDatalist = ATON.UI.elem(`<datalist id="${baseid}-list"></datalist>`);
        ATON.UI.registerElementAsComponent(elDatalist, "datalist");

        for (let i = 0; i < list.length; i++) {
            elDatalist.append(ATON.UI.elem(`<option value="${list[i]}"></option>`));
        }

        el.append(elDatalist);
    }

    el.append(elAdd);

    if (options.tags) {
        for (const key in options.tags) addTag(options.tags[key], false);
    }

    el.addTag = addTag;
    el.removeTag = removeTag;

    return el;
};

UI.createInputListControl = (options = {}) => {
    let items = options.items || [];
    let elInput = null;

    const getItemId = options.getItemId || (item => item?.id ?? item);
    const getItems = () => options.getItems ? options.getItems() : items;
    const setItems = (nextItems) => {
        if (options.setItems) options.setItems(nextItems);
        else items = nextItems;

        if (options.onchange) options.onchange(nextItems);
    };
    const normalizeItems = (nextItems) => {
        return options.normalizeItems ? options.normalizeItems(nextItems) : Array.from(nextItems || []);
    };

    const elBody = ATON.UI.createContainer({
        classes: options.classes || "d-grid gap-2"
    });
    const elInputWrap = ATON.UI.createContainer();
    const elList = ATON.UI.createContainer({
        classes: options.listClasses || "d-grid gap-1"
    });

    const render = () => {
        elList.replaceChildren();

        const currentItems = normalizeItems(getItems());
        if (currentItems.length === 0) {
            elList.append(ATON.UI.createButton({
                text   : options.emptyText || "No items selected",
                size   : "small",
                tooltip: options.emptyTooltip || options.emptyText || "No items selected"
            }));
            return;
        }

        const removeItem = (item) => {
            const itemId = getItemId(item);
            const nextItems = normalizeItems(getItems()).filter(
                currentItem => getItemId(currentItem) !== itemId
            );
            setItems(nextItems);
            elInput?.removeTag?.(itemId, false);
            render();
        };

        for (const item of currentItems) {
            elList.append(options.renderItem(item, removeItem));
        }
    };

    const showPlaceholder = (text, tooltip) => {
        elInputWrap.replaceChildren(ATON.UI.createButton({
            text   : text,
            size   : "small",
            tooltip: tooltip || text
        }));
    };

    const setInputList = (inputList = []) => {
        elInput = UI.createTagsComponent({
            ...(options.inputOptions || {}),
            list    : inputList,
            onaddtag: async (value) => {
                const item = options.resolveItem
                    ? await options.resolveItem(value)
                    : value;
                if (item === undefined || item === null) return;

                setItems(normalizeItems([
                    ...normalizeItems(getItems()),
                    item
                ]));
                render();
            }
        });

        if (options.inputClass) elInput.classList.add(options.inputClass);
        elInputWrap.replaceChildren(elInput);
        return elInput;
    };

    render();
    showPlaceholder(options.loadingText || "Loading...", options.loadingTooltip);
    elBody.append(elInputWrap, elList);

    return {
        el        : elBody,
        inputWrap : elInputWrap,
        list      : elList,
        render    : render,
        setInputList,
        showPlaceholder
    };
};

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

UI.createToolSlider = (options = {}) => {
    const baseid = ATON.Utils.generateID("thoth-slider");
    const range  = options.range || [0, 1];
    const step   = options.step !== undefined ? options.step : 1;
    const value  = options.value !== undefined ? options.value : range[0];

    const el = ATON.UI.createContainer({
        classes: "thoth-tool-slider"
    });

    if (options.classes) el.className = el.className + " " + options.classes;

    const elInput = ATON.UI.elem(`
        <input
            type="range"
            class="thoth-tool-slider-input aton-input"
            min="${range[0]}"
            max="${range[1]}"
            step="${step}"
            id="${baseid}"
            value="${value}">
    `);
    ATON.UI.registerElementAsComponent(elInput, "input");

    const elValue = document.createElement("span");
    elValue.classList.add("thoth-tool-slider-value");
    elValue.textContent = value;

    const updateValue = () => {
        elValue.textContent = elInput.value;
    };

    el.setValue = (nextValue, emitOptions = {}) => {
        elInput.value = nextValue;
        updateValue();

        if (emitOptions.emitInput && options.oninput) options.oninput(elInput.value);
        if (emitOptions.emitChange && options.onchange) options.onchange(elInput.value);
    };

    el.getValue = () => elInput.value;

    elInput.onfocus = () => { ATON.UI._bInput = true; };
    elInput.onblur  = () => { ATON.UI._bInput = false; };
    elInput.oninput = () => {
        updateValue();
        if (options.oninput) options.oninput(elInput.value);
    };
    elInput.onchange = () => {
        updateValue();
        if (options.onchange) options.onchange(elInput.value);
    };

    el.append(elInput, elValue);

    return el;
};

UI.syncToolSelectorSize = () => {
    if (!UI._toolSelectorSizeSliders) return;
    if (THOTH.Toolbox?.selectorSize === undefined) return;

    for (const elSlider of UI._toolSelectorSizeSliders) {
        if (elSlider) elSlider.setValue(THOTH.Toolbox.selectorSize);
    }
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

                emitVectorChange({x: R[0], y: R[1], z: R[2]});
            }
        }))
    }

    el.id = baseid;

    let elInputX = el.children[0];
    let elInputY = el.children[1];
    let elInputZ = el.children[2];

    const emitVectorChange = (value = {
        x: elInputX.value,
        y: elInputY.value,
        z: elInputZ.value
    }) => {
        const l = {
            modelName: options.modelName,
            value    : value
        };
        if (transform === "position") {
            THOTH.fire("modelTransformPos", l);
        }
        else if (transform === "rotation") {
            THOTH.fire("modelTransformRot", l);
        }
        if (options.onupdate) options.onupdate();
    };

    elInputX.onchange = () => emitVectorChange();
    elInputY.onchange = () => emitVectorChange();
    elInputZ.onchange = () => emitVectorChange();

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

    THOTH.Auth.checkAuth(
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
        })
    );

    const transformContent = ATON.UI.createContainer();

    transformContent.append(
        elTransformOptions,
        UI.modelTransformControl({
            node    : modelName,
            position: true,
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

    const elBtnGeodesicExact = ATON.UI.createButton({
        text: "Exact Geodesic",
        onpress: () => {
            THOTH.MSR.distanceType = 'geodesicExact';
            THOTH.FE.handleElementHighlight('geodesicExact', distanceTypeMap);
        }
    });
    distanceTypeMap.set('geodesicExact', elBtnGeodesicExact);
    //initial highlight
    THOTH.FE.handleElementHighlight(THOTH.MSR.distanceType,distanceTypeMap);

    const elOptions = ATON.UI.createContainer();
    elOptions.classList.add("d-flex", "align-items-center", "gap-1", "justify-content-end");
    elOptions.append(elBtnEuclidean,elBtnGeodesic,elBtnGeodesicExact);

    const elDistance = UI.createToolOptionRow(
        "Type of distance",
        elOptions,
        "Select type of distance for measurement"
    );
    const elResult = ATON.UI.createContainer({ classes: "thoth-tool-option-result" });
    elContent.append(elDistance, elResult);

    return UI.createToolOptionsPanel("Measure Options", elContent);
};

UI.createBrushOptions = () => {
    const elContent = ATON.UI.createContainer();
    const elSizeSlider = UI.createToolSlider({
        range  : [
            THOTH.Toolbox.selectorSizeMin,
            THOTH.Toolbox.selectorSizeMax
        ],
        value  : THOTH.Toolbox.selectorSize,
        oninput: (v) => THOTH.Toolbox.setSelectorSize(v)
    });

    if (!UI._toolSelectorSizeSliders) UI._toolSelectorSizeSliders = new Set();
    UI._toolSelectorSizeSliders.add(elSizeSlider);

    // Size
    const elBrushSize = UI.createToolOptionRow(
        "Size",
        elSizeSlider,
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
        UI.createToolSlider({
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
        UI.createToolSlider({
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
    THOTH.Auth.checkAuth(
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
                        if (UI._elUserBTN) UI._elUserBTN.classList.remove("aton-btn-highlight");
                        ATON.UI.hideModal();
                        THOTH.Auth.logout();
                    }
                })
            );

            ATON.UI.showModal({
                header: u.username,
                body: elBody
            })
        },
        // Not logged — redirect through EGI Check-In, carrying the current scene URL.
        () => {
            if (!THOTH.Auth.isHestiaMode()) {
                const elBody = ATON.UI.createLoginForm({
                    onSuccess: (user) => {
                        ATON.UI.hideModal();
                        THOTH.onLogin(user);
                        if (UI._elUserBTN) UI._elUserBTN.classList.add("aton-btn-highlight");
                    },
                    onFail: () => UI.modalUser("Authentication failed")
                });
                if (msg !== undefined) elBody.append(ATON.UI.createButton({ text: msg }));
                ATON.UI.showModal({ header: "User", body: elBody });
                return;
            }

            const elBody = ATON.UI.createContainer({ classes: "d-grid gap-2" });
            if (msg !== undefined) elBody.append(ATON.UI.createButton({ text: msg }));
            elBody.append(
                ATON.UI.createButton({
                    text   : "Login with EGI",
                    icon   : "user",
                    classes: "aton-btn-highlight",
                    onpress: ()=>{
                        ATON.UI.hideModal();
                        THOTH.Auth.startEgiLogin();
                    }
                }),
                ATON.UI.createButton({
                    text   : "Login through HESTIA Portal",
                    icon   : "user",
                    onpress: ()=>{
                        ATON.UI.hideModal();
                        THOTH.Auth.startHestiaLogin();
                    }
                })
            );
            ATON.UI.showModal({ header: "User", body: elBody });
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
        actions: [
            ATON.UI.createButton({
                text   : "Download scene",
                icon   : "download",
                size   : "large",
                variant: "secondary",
                onpress: () => {
                    THOTH.downloadSceneJSON();
                    ATON.UI.hideModal();
                }
            })
        ],
        onsuccess: () => {
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

UI.modalModelExportChanges = (modelName) => {
    const elInfo = ATON.UI.createContainer();
    const canExportModel = THOTH.API.supports("artefact_data", "PUT");
    elInfo.textContent = canExportModel
        ? `Export changes for ${modelName}?`
        : "Model changes are stored as part of the scene. Export the scene to persist them remotely.";

    const elFooter = ATON.UI.createContainer();
    elFooter.append(
        ATON.UI.createButton({
            text   : "Download",
            icon   : "download",
            size   : "large",
            variant: "secondary",
            onpress: () => {
                if (THOTH.downloadModelData(modelName)) ATON.UI.hideModal();
            }
        })
    );
    if (canExportModel) {
        elFooter.append(ATON.UI.createButton({
            text   : "Export",
            icon   : "link",
            size   : "large",
            variant: "info",
            onpress: async () => {
                const response = await THOTH.exportModelData(modelName);
                if (response?.ok) ATON.UI.hideModal();
            }
        }));
    }
    elFooter.append(
        ATON.UI.createButton({
            text   : "Cancel",
            size   : "large",
            variant: "secondary",
            onpress: () => ATON.UI.hideModal()
        })
    );

    ATON.UI.showModal({
        header: "Export model changes",
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
        async (u) => {
            const response = await THOTH.API.listModels(u);
            if (!response.ok) {
                THOTH.FE.showToast("Error loading models:" + response.error);
                return;
            }

            const entries = Array.isArray(response.data) ? response.data : [];
            const modelList = new Set();
            const modelOptions = entries
                .map(item => UI._getModelListOption(item, u))
                .filter(option => option.id);
            const optionByLabel = new Map();
            const titleCounts = new Map();
            for (const option of modelOptions) {
                titleCounts.set(option.title, (titleCounts.get(option.title) || 0) + 1);
            }
            for (const option of modelOptions) {
                option.label = titleCounts.get(option.title) > 1
                    ? `${option.title} (${option.id})`
                    : option.title;
                optionByLabel.set(option.label, option);
            }
            const modelListControl = UI.createInputListControl({
                getItems: () => Array.from(modelList),
                setItems: (items) => {
                    modelList.clear();
                    for (const item of items) modelList.add(item);
                },
                emptyText     : "No models selected",
                loadingText   : "Loading models...",
                inputClass    : "thoth-add-model-tags",
                inputOptions  : {
                    label: "Input models"
                },
                renderItem: (modelName, removeItem) => {
                    const elActions = ATON.UI.createContainer();
                    elActions.append(ATON.UI.createButton({
                        icon   : ATON.PATH_RES + "icons/trash.png",
                        size   : "small",
                        tooltip: "Remove model",
                        onpress: () => removeItem(modelName)
                    }));

                    return UI.createSplitRow({
                        colLeft   : 8,
                        itemsLeft : ATON.UI.createButton({
                            text   : modelName,
                            size   : "small",
                            icon   : "scene",
                            tooltip: modelName,
                            onpress: () => {}
                        }),
                        itemsRight: elActions
                    });
                }
            });
            modelListControl.setInputList(Array.from(optionByLabel.keys()));

            // Footer
            const elFooter = UI.createModalFooter({
                onsuccess  : () => {
                    for (const modelLabel of Array.from(modelList)) {
                        const option = optionByLabel.get(modelLabel);
                        THOTH.fire("addModel", option?.id || modelLabel);
                    }
                    ATON.UI.hideModal();
                },
                successText: "Add models"
            });

            ATON.UI.showModal({
                header: "Add models",
                body  : modelListControl.el,
                footer: elFooter,
            });
        }
    );
};

UI._getModelListName = (item, user) => {
    if (typeof item !== "string") {
        return item?.["artefact.Title"] ||
            item?.Title ||
            item?.title ||
            item?.name ||
            item?.id ||
            "";
    }

    const username = user?.username || user?.id || user?.name || "";
    const prefix = `items/${username}/models/`;

    if (item.startsWith(prefix)) return item.replace(prefix, "");

    return item;
};

UI._getModelListOption = (item, user) => {
    const title = UI._getModelListName(item, user);
    if (typeof item === "string") return { id: title, title, item };
    return {
        id: item?.id || item?.artifact_id || title,
        title,
        url: item?.url || item?.gltf_file || item?.glb_file || item?.public_url,
        item
    };
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
                    data: {
                        ...source,
                        ...sharedData,
                        points      : source.points,
                        model_id    : source.model_id,
                        distance    : source.distance,
                        distanceType: source.distanceType,
                        path        : source.path
                    }
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

UI._normalizeImageRelation = (relation) => {
    if (relation === undefined || relation === null) return null;

    if (typeof relation !== "object") {
        const id = String(relation).trim();
        if (!id) return null;

        return {
            id  : id,
            name: id,
            url : ""
        };
    }

    const id = String(
        relation.id ??
        relation.name ??
        relation.image_name ??
        relation.url ??
        relation.image_url ??
        ""
    ).trim();
    if (!id) return null;

    return {
        id  : id,
        name: relation.name || relation.image_name || id,
        url : relation.url || relation.image_url || relation.path || relation.src || ""
    };
};

UI._normalizeImageRelations = (relations) => {
    return normalizeUniqueRelations(relations, UI._normalizeImageRelation);
};

UI._getImageListName = (item) => {
    if (typeof item === "string") return item;

    return item?.image_name ||
        item?.name ||
        item?.id ||
        item?.title ||
        item?.url ||
        item?.image_url ||
        "";
};

UI._resolveRgbImageRelation = async (relation) => {
    const normalized = UI._normalizeImageRelation(relation);
    if (!normalized) return null;
    if (normalized.url) return normalized;

    const response = await THOTH.API.getRgbImage(normalized.id);
    if (!response.ok || !response.data) return normalized;

    return UI._normalizeImageRelation({
        ...normalized,
        ...response.data
    });
};

UI.modalRelatedRgbImage = (image) => {
    const relation = UI._normalizeImageRelation(image);
    if (!relation?.url) return;

    const elBody = ATON.UI.createContainer({
        classes: "d-flex flex-column"
    });
    const elImgContainer = ATON.UI.createContainer({
        classes: "d-flex ratio-16x9 w-100 bg-dark"
    });
    const elImg = document.createElement("img");
    elImg.src = relation.url;
    elImg.alt = relation.name || relation.id;
    elImg.onerror = () => {};
    elImg.className = "img-fluid w-100 h-100 object-fit-contain";
    elImgContainer.append(elImg);
    elBody.append(elImgContainer);

    const elFooter = ATON.UI.createContainer();
    elFooter.append(ATON.UI.createButton({
        text   : "Download",
        icon   : "download",
        variant: "success",
        tooltip: "Download image",
        onpress: () => THOTH.Utils.downloadImage(relation.url, relation.name || relation.id)
    }));

    ATON.UI.showModal({
        header: relation.name || relation.id,
        body  : elBody,
        footer: elFooter
    });
};

UI._createRelatedRgbImageRow = (relation, ondelete) => {
    const elRow = ATON.UI.createContainer({
        classes: "row g-0 align-items-center w-100 rounded-2 px-2 py-1 mb-1"
    });
    const elPreviewCol = ATON.UI.createContainer({
        classes: "col-4 d-flex align-items-center"
    });
    const elNameCol = ATON.UI.createContainer({
        classes: "col-4 d-flex align-items-center"
    });
    const elActionsCol = ATON.UI.createContainer({
        classes: "col-4 d-flex justify-content-end align-items-center"
    });

    const elPreviewButton = document.createElement("button");
    elPreviewButton.type = "button";
    elPreviewButton.className = "btn btn-sm p-0 border-0 bg-transparent";
    elPreviewButton.title = relation.url ? "View image" : "Image URL unavailable";
    elPreviewButton.onclick = () => UI.modalRelatedRgbImage(relation);

    if (relation.url) {
        const elImg = document.createElement("img");
        elImg.src = relation.url;
        elImg.alt = relation.name || relation.id;
        elImg.className = "img-fluid rounded";
        elImg.style.maxHeight = "48px";
        elImg.style.objectFit = "contain";
        elImg.onerror = () => {
            elImg.style.display = "none";
        };
        elPreviewButton.append(elImg);
    }
    else {
        const elNoPreview = document.createElement("span");
        elNoPreview.className = "btn btn-sm";
        elNoPreview.textContent = "No preview";
        elNoPreview.title = "Image URL unavailable";
        elPreviewButton.append(elNoPreview);
    }

    elPreviewCol.append(elPreviewButton);
    elNameCol.append(ATON.UI.createButton({
        text   : relation.name || relation.id,
        size   : "small",
        tooltip: relation.id
    }));
    elActionsCol.append(
        ATON.UI.createButton({
            icon   : "download",
            size   : "small",
            tooltip: relation.url ? "Download image" : "Image URL unavailable",
            onpress: () => {
                if (relation.url) THOTH.Utils.downloadImage(relation.url, relation.name || relation.id);
            }
        }),
        ATON.UI.createButton({
            icon   : ATON.PATH_RES + "icons/trash.png",
            size   : "small",
            tooltip: "Remove related RGB image",
            onpress: () => {
                if (ondelete) ondelete(relation);
            }
        })
    );

    elRow.append(elPreviewCol, elNameCol, elActionsCol);
    return elRow;
};

UI.createRelatedRgbImagesControl = (dataTemp) => {
    dataTemp.related_rgb_images = UI._normalizeImageRelations(dataTemp.related_rgb_images);

    let relationByName = new Map();
    const control = UI.createInputListControl({
        getItems     : () => dataTemp.related_rgb_images,
        setItems     : items => {
            dataTemp.related_rgb_images = UI._normalizeImageRelations(items);
        },
        normalizeItems: UI._normalizeImageRelations,
        getItemId    : item => item.id,
        emptyText    : "No related RGB images",
        loadingText  : "Loading RGB images...",
        inputClass   : "thoth-related-rgb-image-tags",
        inputOptions : {
            label: "Input RGB images"
        },
        resolveItem: async (imageName) => UI._resolveRgbImageRelation(
            relationByName.get(imageName) || imageName
        ),
        renderItem: (relation, removeItem) => UI._createRelatedRgbImageRow(
            relation,
            removeItem
        )
    });

    const canLoadImages = THOTH.requireAuth("view RGB images",
        async () => {
            const response = await THOTH.API.listRgbImages();
            if (!response.ok) {
                control.showPlaceholder(
                    "Error loading RGB images",
                    response.error || "Error loading RGB images"
                );
                return;
            }

            const entries = Array.isArray(response.data) ? response.data : [];
            relationByName = new Map();
            const itemNames = entries
                .map(item => {
                    const name = UI._getImageListName(item);
                    if (!name) return null;

                    relationByName.set(name, UI._normalizeImageRelation({
                        id       : name,
                        name     : name,
                        url      : item?.url,
                        image_url: item?.image_url
                    }));
                    return name;
                })
                .filter(Boolean);
            control.setInputList(itemNames);
        }
    );

    if (!canLoadImages) {
        control.showPlaceholder(
            "Login required",
            "Login required to load RGB image list"
        );
    }

    return control.el;
};

UI._normalizeMultispectralUrlMap = (value) => {
    if (typeof value === "string") {
        return value ? { rgb: value } : {};
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) return {};

    const output = {};
    for (const key in value) {
        const url = value[key];
        if (url === undefined || url === null || url === "") continue;

        output[String(key)] = String(url);
    }

    return output;
};

UI._normalizeMultispectralImageRelation = (relation) => {
    if (relation === undefined || relation === null) return null;

    if (typeof relation !== "object") {
        const id = String(relation).trim();
        if (!id) return null;

        return {
            id  : id,
            name: id,
            urls: {}
        };
    }

    const id = String(
        relation.id ??
        relation.name ??
        relation.image_name ??
        ""
    ).trim();
    if (!id) return null;

    const urls = UI._normalizeMultispectralUrlMap(
        relation.urls ??
        relation.image_url ??
        relation.url
    );

    return {
        id  : id,
        name: relation.name || relation.image_name || id,
        urls: urls
    };
};

UI._normalizeMultispectralImageRelations = (relations) => {
    return normalizeUniqueRelations(relations, UI._normalizeMultispectralImageRelation);
};

UI._getMultispectralWavelengthEntries = (relation) => {
    const urls = UI._normalizeMultispectralUrlMap(relation?.urls);
    return Object.keys(urls)
        .sort((a, b) => {
            if (a === "rgb") return -1;
            if (b === "rgb") return 1;

            const aNum = Number(String(a).replace(/[^\d.]/g, ""));
            const bNum = Number(String(b).replace(/[^\d.]/g, ""));
            if (Number.isFinite(aNum) && Number.isFinite(bNum) && aNum !== bNum) {
                return aNum - bNum;
            }

            return String(a).localeCompare(String(b));
        })
        .map(key => [key, urls[key]]);
};

UI._resolveMultispectralImageRelation = async (relation) => {
    const normalized = UI._normalizeMultispectralImageRelation(relation);
    if (!normalized) return null;
    if (Object.keys(normalized.urls).length > 0) return normalized;

    const response = await THOTH.API.getMultispectralImage(normalized.id);
    if (!response.ok || !response.data) return normalized;

    return UI._normalizeMultispectralImageRelation({
        ...normalized,
        ...response.data
    });
};

UI.modalRelatedMultispectralImage = (image) => {
    const relation = UI._normalizeMultispectralImageRelation(image);
    if (!relation) return;

    const wavelengths = UI._getMultispectralWavelengthEntries(relation);
    let index = 0;

    const elBody = ATON.UI.createContainer({
        classes: "d-flex flex-column"
    });
    const elImgContainer = ATON.UI.createContainer({
        classes: "d-flex ratio-16x9 w-100 bg-dark"
    });
    const elImg = document.createElement("img");
    elImg.alt = relation.name || relation.id;
    elImg.onerror = () => {};
    elImg.className = "img-fluid w-100 h-100 object-fit-contain";
    const elWavelength = ATON.UI.createButton({
        text   : wavelengths.length > 0 ? wavelengths[0][0] : "No bitmaps",
        size   : "small",
        tooltip: "Current wavelength"
    });

    const render = () => {
        if (wavelengths.length === 0) {
            elImg.removeAttribute("src");
            elWavelength.textContent = "No bitmaps";
            return;
        }

        const [wavelength, url] = wavelengths[index];
        elImg.src = url;
        elWavelength.textContent = wavelength;
    };

    elImgContainer.append(elImg);
    elBody.append(
        elImgContainer,
        UI.createSplitRow({
            colLeft   : 6,
            itemsLeft : elWavelength,
            itemsRight: ATON.UI.createButton({
                text   : `${wavelengths.length} bitmap${wavelengths.length === 1 ? "" : "s"}`,
                size   : "small",
                tooltip: "Available bitmaps"
            })
        })
    );

    const elFooter = ATON.UI.createContainer();
    elFooter.append(
        ATON.UI.createButton({
            text   : "<",
            tooltip: "Previous wavelength",
            onpress: () => {
                if (wavelengths.length === 0) return;

                index = (index - 1 + wavelengths.length) % wavelengths.length;
                render();
            }
        }),
        ATON.UI.createButton({
            text   : ">",
            tooltip: "Next wavelength",
            onpress: () => {
                if (wavelengths.length === 0) return;

                index = (index + 1) % wavelengths.length;
                render();
            }
        }),
        ATON.UI.createButton({
            text   : "Download",
            icon   : "download",
            tooltip: "Download not available yet",
            onpress: () => {}
        })
    );

    render();
    ATON.UI.showModal({
        header: relation.name || relation.id,
        body  : elBody,
        footer: elFooter
    });
};

UI._createRelatedMultispectralImageRow = (relation, ondelete) => {
    const wavelengths = UI._getMultispectralWavelengthEntries(relation);
    const elActions = ATON.UI.createContainer();
    elActions.append(
        ATON.UI.createButton({
            icon   : "download",
            size   : "small",
            tooltip: "Download not available yet",
            onpress: () => {}
        }),
        ATON.UI.createButton({
            icon   : ATON.PATH_RES + "icons/trash.png",
            size   : "small",
            tooltip: "Remove related multispectral image",
            onpress: () => {
                if (ondelete) ondelete(relation);
            }
        })
    );

    return UI.createSplitRow({
        colLeft   : 8,
        itemsLeft : ATON.UI.createButton({
            text   : relation.name || relation.id,
            size   : "small",
            icon   : "list",
            tooltip: `${wavelengths.length} bitmap${wavelengths.length === 1 ? "" : "s"}`,
            onpress: () => UI.modalRelatedMultispectralImage(relation)
        }),
        itemsRight: elActions
    });
};

UI.createRelatedMultispectralImagesControl = (dataTemp) => {
    dataTemp.related_multispectral_images = UI._normalizeMultispectralImageRelations(
        dataTemp.related_multispectral_images
    );

    let relationByName = new Map();
    const control = UI.createInputListControl({
        getItems     : () => dataTemp.related_multispectral_images,
        setItems     : items => {
            dataTemp.related_multispectral_images = UI._normalizeMultispectralImageRelations(items);
        },
        normalizeItems: UI._normalizeMultispectralImageRelations,
        getItemId    : item => item.id,
        emptyText    : "No related multispectral images",
        loadingText  : "Loading multispectral images...",
        inputClass   : "thoth-related-multispectral-image-tags",
        inputOptions : {
            label: "Input multispectral images"
        },
        resolveItem: async (imageName) => UI._resolveMultispectralImageRelation(
            relationByName.get(imageName) || imageName
        ),
        renderItem: (relation, removeItem) => UI._createRelatedMultispectralImageRow(
            relation,
            removeItem
        )
    });

    const canLoadImages = THOTH.requireAuth("view multispectral images",
        async () => {
            const response = await THOTH.API.listMultispectralImages();
            if (!response.ok) {
                control.showPlaceholder(
                    "Error loading multispectral images",
                    response.error || "Error loading multispectral images"
                );
                return;
            }

            const entries = Array.isArray(response.data) ? response.data : [];
            relationByName = new Map();
            const itemNames = entries
                .map(item => {
                    const name = UI._getImageListName(item);
                    if (!name) return null;

                    relationByName.set(name, UI._normalizeMultispectralImageRelation({
                        id       : name,
                        name     : name,
                        urls     : item?.urls,
                        image_url: item?.image_url
                    }));
                    return name;
                })
                .filter(Boolean);
            control.setInputList(itemNames);
        }
    );

    if (!canLoadImages) {
        control.showPlaceholder(
            "Login required",
            "Login required to load multispectral image list"
        );
    }

    return control.el;
};

UI._normalizeArtefactRelation = (relation) => {
    if (relation === undefined || relation === null) return null;

    if (typeof relation !== "object") {
        const id = String(relation).trim();
        if (!id) return null;

        return {
            id  : id,
            name: id,
            url : ""
        };
    }

    const id = String(
        relation.id ??
        relation.name ??
        relation.title ??
        relation.url ??
        relation.gltf_file ??
        ""
    ).trim();
    if (!id) return null;

    return {
        id  : id,
        name: relation.name || relation.title || id,
        url : relation.url || relation.gltf_file || relation.path || relation.src || ""
    };
};

UI._normalizeArtefactRelations = (relations) => {
    return normalizeUniqueRelations(relations, UI._normalizeArtefactRelation);
};

UI._createRelatedArtefactRow = (relation, ondelete) => {
    const elActions = ATON.UI.createContainer();
    elActions.append(ATON.UI.createButton({
        icon   : ATON.PATH_RES + "icons/trash.png",
        size   : "small",
        tooltip: "Remove related artefact",
        onpress: () => {
            if (ondelete) ondelete(relation);
        }
    }));

    return UI.createSplitRow({
        colLeft   : 8,
        itemsLeft : ATON.UI.createButton({
            text   : relation.name || relation.id,
            size   : "small",
            icon   : "scene",
            tooltip: relation.id,
            onpress: () => {}
        }),
        itemsRight: elActions
    });
};

UI.createRelatedArtefactsControl = (dataTemp) => {
    dataTemp.related_artefacts = UI._normalizeArtefactRelations(dataTemp.related_artefacts);

    let relationByName = new Map();
    const control = UI.createInputListControl({
        getItems     : () => dataTemp.related_artefacts,
        setItems     : items => {
            dataTemp.related_artefacts = UI._normalizeArtefactRelations(items);
        },
        normalizeItems: UI._normalizeArtefactRelations,
        getItemId    : item => item.id,
        emptyText    : "No related artefacts",
        loadingText  : "Loading models...",
        inputClass   : "thoth-related-artefact-tags",
        inputOptions : {
            label: "Input related models"
        },
        resolveItem: modelName => relationByName.get(modelName) || modelName,
        renderItem : (relation, removeItem) => UI._createRelatedArtefactRow(
            relation,
            removeItem
        )
    });

    const canLoadModels = THOTH.requireAuth("import models",
        async (u) => {
            const response = await THOTH.API.listModels(u);
            if (!response.ok) {
                control.showPlaceholder(
                    "Error loading models",
                    response.error || "Error loading models"
                );
                return;
            }

            const entries = Array.isArray(response.data) ? response.data : [];
            relationByName = new Map();
            const options = entries
                .map(item => UI._getModelListOption(item, u))
                .filter(option => option.id);
            const titleCounts = new Map();
            for (const option of options) {
                titleCounts.set(option.title, (titleCounts.get(option.title) || 0) + 1);
            }
            const itemNames = options.map(option => {
                const label = titleCounts.get(option.title) > 1
                    ? `${option.title} (${option.id})`
                    : option.title;
                relationByName.set(label, UI._normalizeArtefactRelation({
                    id       : option.id,
                    name     : option.title,
                    url      : option.url,
                    gltf_file: option.url
                }));
                return label;
            });
            control.setInputList(itemNames);
        }
    );

    if (!canLoadModels) {
        control.showPlaceholder(
            "Login required",
            "Login required to load model list"
        );
    }

    return control.el;
};

UI.collectAnnotationSharedFields = (dataTemp) => {
    const data = {
        ...dataTemp,
        related_rgb_images          : UI._normalizeImageRelations(dataTemp.related_rgb_images),
        related_multispectral_images: UI._normalizeMultispectralImageRelations(
            dataTemp.related_multispectral_images
        ),
        related_artefacts           : UI._normalizeArtefactRelations(dataTemp.related_artefacts)
    };

    const normalized = THOTH.Annotations?.normalize(data) || data;

    if (dataTemp.point) normalized.point = dataTemp.point;
    if (dataTemp.points) normalized.points = dataTemp.points;
    if (dataTemp.point1) normalized.point1 = dataTemp.point1;
    if (dataTemp.point2) normalized.point2 = dataTemp.point2;
    if (dataTemp.model_id) normalized.model_id = dataTemp.model_id;

    return normalized;
};

UI.createAnnotationSharedItems = (dataTemp, options = {}) => {
    dataTemp.related_rgb_images = UI._normalizeImageRelations(dataTemp.related_rgb_images);
    dataTemp.related_multispectral_images = UI._normalizeMultispectralImageRelations(
        dataTemp.related_multispectral_images
    );
    dataTemp.related_artefacts = UI._normalizeArtefactRelations(dataTemp.related_artefacts);

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
            content: UI.createRelatedRgbImagesControl(dataTemp)
        },
        {
            title  : "Related multispectral images",
            open   : false,
            content: UI.createRelatedMultispectralImagesControl(dataTemp)
        },
        {
            title  : "Related artefacts",
            open   : false,
            content: UI.createRelatedArtefactsControl(dataTemp)
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

    const saveMetadataDraft = () => {
        THOTH.MD.editModelMetadata(modelId, data_temp, prev_data);
    };

    const canExportMetadata = THOTH.config?.deploymentMode !== "hestia" ||
        THOTH.API.supports("metadata", "PUT");
    const metadataActions = [];
    if (canExportMetadata) {
        metadataActions.push(ATON.UI.createButton({
                text   : "Export metadata",
                icon   : "link",
                size   : "large",
                variant: "info",
                onpress: async () => {
                    saveMetadataDraft();
                    await THOTH.exportModelMetadata(modelId);
                }
            }));
    }
    metadataActions.push(ATON.UI.createButton({
                text   : "Download metadata",
                icon   : "download",
                size   : "large",
                variant: "secondary",
                onpress: () => {
                    saveMetadataDraft();
                    THOTH.downloadModelMetadata(modelId);
                }
            }));

    const elFooter = UI.createModalFooter({
        actions: metadataActions,
        onsuccess: () => {
            saveMetadataDraft();
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

    if (Array.isArray(options.actions)) {
        for (const action of options.actions) {
            if (action) elFooter.append(action);
        }
    }

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
