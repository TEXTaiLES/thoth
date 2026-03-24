/*===========================================================================

    THOTH
    UI modules

    Author: steliosalvanos@gmail.com

===========================================================================*/
let UI = {};



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
    }

    return el;
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
                    THOTH.fire("modelTransformPosInput", (l));
                }
                else if (transform === "rotation") {
                    THOTH.fire("modelTransformRotInput", (l)); 
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
            THOTH.fire("modelTransformPosInput", (l));
        }
        else if (transform === "rotation") {
            THOTH.fire("modelTransformRotInput", (l));
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
            THOTH.fire("modelTransformPosInput", (l));
        }
        else if (transform === "rotation") {
            THOTH.fire("modelTransformRotInput", (l));
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

UI.createUserButton = ()=>{
    UI._elUserBTN = ATON.UI.createButton({
        icon    : "user",
        onpress : () => UI.modalUser(),
        tooltip : "User"
    });

    ATON.checkAuth((u)=>{
        UI._elUserBTN.classList.add("aton-btn-highlight");
    });
    UI._elUserBTN.classList.add("thoth-dark-btn");

    return UI._elUserBTN;
};

// Controllers

UI.createModelController = (modelName) => {
    const elLeft  = ATON.UI.createContainer();

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
            onpress: () => ATON.UI.showSidePanel({
                header: modelName,
                body  : UI.createModelEditor(modelName)
            })
        }),
    );
    const elController = UI.createSplitRow({
        // classes   : "row g-0 align-items-center w-100 rounded-2 border px-2 py-1 mb-1",
        colLeft   : 7,
        itemsLeft : elLeft,
        itemsRight: ATON.UI.createButton({
            icon   : "trash",
            onpress: () => THOTH.fire("deleteModel", modelName),
        }),
    });
    
    return elController;
};

UI.createSceneController = () => {
    const elController = UI.createSplitRow({
        classes   : "bg-body-secondary",
        colLeft   : 7,
        itemsLeft : ATON.UI.createButton({
            text: "Scene Layer",
            icon: "scene",
            size: "small"
        }),
        itemsRight: ATON.UI.createButton({
            text   : "Scene Metadata",
            icon   : "list",
            size   : "small",
            onpress: () => UI.modalSceneMetadata(),
        }),
    });
    return elController;
};

UI.createLayerController = (layerId) => {
    const elLeft  = ATON.UI.createContainer();
    const elRight = ATON.UI.createContainer();
    
    const layer = THOTH.Layers.layerMap.get(layerId);
    
    // Name
    elLeft.append(
        // Visibility
        ATON.UI.createButton({
            icon   : "visibility",
            size   : "small",
            onpress: () => THOTH.Layers.toggleVisibility(layerId),
        }),
        THOTH.FE.layerNameMap.get(layerId),
    );
    let elCP = ATON.UI.createColorPicker({
        color  : layer.highlightColor,
        id     : `layer${layerId}CP`,
        oninput: (color) => {
            layer.highlightColor = color
            THOTH.updateVisibility();
        },
    });
    elCP.id = `layer${layerId}CP`;
    elRight.append(
        elCP,
        // Metadata
        ATON.UI.createButton({
            icon   : "list",
            size   : "small",
            tooltip: "Edit metadata",
            onpress: () => UI.modalLayerDetails(layerId),
        }),
        // Delete
        ATON.UI.createButton({
            icon   : "trash",
            size   : "small",
            onpress: () => THOTH.fire("deleteLayer", (layerId))
        }),
    );
    
    const elController = UI.createSplitRow({
        // classes   : "bg-body-secondary",
        colLeft   : 7,
        itemsLeft : elLeft,
        itemsRight: elRight,
    });
    
    return elController;
};


// Editors

UI.createModelEditor = (modelName) => {
    const model = THOTH.Models.modelMap.get(modelName);

    const elBody = ATON.UI.createContainer();

    // Top buttons
    const elModelHead = UI.createSplitRow({
        colLeft  : 4,
        itemsLeft: ATON.UI.createButton({
            icon   : "back",
            onpress: () => ATON.UI.showSidePanel({
                header: "Scene",
                body  : THOTH.FE.modelsPanel
            })
        }),
        itemsRight: ATON.UI.createButton({
            text   : "Focus",
            icon   : "focus",
            classes: "btn-default",
            onpress: () => ATON.Nav.requestPOVbyNode(model, 0.2)
        }),
    });

    // Options
    const elVPOptions = ATON.UI.createContainer();
    elVPOptions.append(
        ATON.UI.createButton({
            icon   : "visibility",
            size   : "small",
             onpress: () => THOTH.SVP.toggleVPNodes(vpVisible, modelName)
            // onpress: () => THOTH.SVP.toggleVPNodes(true, modelName)
        }),
        ATON.UI.createButton({
            text   : "Build Viewpoints",
            variant: "info",
            icon   : "pov",
            onpress: () => UI.modalBuildVP(modelName),
        }),
        ATON.UI.createButton({
            text   : "Delete All",
            variant: "secondary",
            icon   : "cancel",
             onpress: () => THOTH.SVP.deleteSVPNodes(modelName),
        })
    ) 
    
    const elOptions = ATON.UI.createTreeGroup({
        items: [
            {
                title  : "Meshes",
                open   : true,
                content: UI.createMeshList(modelName)
            },
            {
                title  : "Viewpoints",
                open   : true,
                content: elVPOptions
            },
            {
                title  : "Transform",
                open   : true,
                content: UI.modelTransformControl({
                    node    : modelName,
                    position: true,
                    scale   : false,
                    rotation: true,
                })
            }
        ]
    });
    elBody.append(elModelHead, elOptions);

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
    const elHeader = ATON.UI.createContainer({classes: "bg-body-secondary"});
    elHeader.append(ATON.UI.createButton({
        text: "Measure Options"
    }));

    const elBody = ATON.UI.createContainer();
    
    // Distance type map
    const distanceTypeMap = new Map();
    
    const elBtnEuclidean = ATON.UI.createButton({
        text: "Euclidean",
        onpress: () => {
            THOTH.FE.handleElementHighlight('euclidean', distanceTypeMap)
        }
    });
    distanceTypeMap.set('euclidean', elBtnEuclidean);
    const elBtnTest = ATON.UI.createButton({
        text: "Test",
        onpress: () => THOTH.FE.handleElementHighlight('test', distanceTypeMap)
    });
    distanceTypeMap.set('test', elBtnTest)
    const elOptions = ATON.UI.createContainer();
    elOptions.append(elBtnTest, elBtnEuclidean);

    const elDistance = UI.createSplitRow({
        colLeft: 7,
        itemsLeft: ATON.UI.createButton({
            text: "Distance",
            tooltip: "Select type of distance for measurement",
        }),
        itemsRight: elOptions,
    });
    elBody.append(elHeader, elDistance)
    return elBody;
};

UI.createBrushOptions = () => {
    const elHeader = ATON.UI.createContainer({classes: "bg-body-secondary"});
    elHeader.append(ATON.UI.createButton({
        text: "Brush/Eraser Options"
    }));
    
    const elBody = ATON.UI.createContainer();
    // Size
    const elBrushSize = UI.createSplitRow({
        colLeft: 7,
        itemsLeft: ATON.UI.createButton({
            text   : "Size",
            tooltop: "Select the size of the tool",
        }),
        itemsRight: ATON.UI.createSlider({
            range  : [
                THOTH.Toolbox.selectorSizeMin,
                THOTH.Toolbox.selectorSizeMax
            ],
            value  : THOTH.Toolbox.selectorSize,
            oninput: (v) => THOTH.Toolbox.setSelectorSize(v)
        })
    });
    elBody.append(elHeader, elBrushSize);
    
    return elBody;
};

UI.createLassoOptions = () => {
    const elHeader = ATON.UI.createContainer({classes: "bg-body-secondary"});
    elHeader.append(ATON.UI.createButton({
        text: "Brush/Eraser Options"
    }));
    
    const elBody = ATON.UI.createContainer();
    // Precision
    const elPrecision = UI.createSplitRow({
        colLeft: 7,
        itemsLeft: ATON.UI.createButton({
            text   : "Pixel precision",
            tooltip: "Select the precision of the lasso tool. \n" +
            "Higher precision leads to more accurate selection but lower performance"
        }),
        itemsRight: ATON.UI.createSlider({
            range  : [0.1, 1],
            value  : THOTH.Toolbox.lassoPrecision,
            step    : 0.1,
            oninput : (v) => THOTH.Toolbox.lassoPrecision = v,
        })
    });
    // Normal
    const elNormal = UI.createSplitRow({
        colLeft: 7,
        itemsLeft: ATON.UI.createButton({
            text: "Normal threshold",
            tooltip: "Select the threshold for face selection. \n" +
            "-1: Highest tolerance. \n" + 
            "+1: Lower tolerance"
        }),
        itemsRight: ATON.UI.createSlider({
            range  : [-1, 1],
            step   : 0.1,
            value  : THOTH.Toolbox.normalThreshold,
            oninput: (v) => THOTH.Toolbox.normalThreshold = v,
        })
    });
    // Occluded
    const elOccluded = UI.createSplitRow({
        colLeft: 7,
        itemsLeft: ATON.UI.createButton({
            text: "Select occluded faces",
            tooltip: "Select obscured areas.\n"
        }),
        itemsRight: UI.createBool({
            onchange: (input) => THOTH.Toolbox.selectObstructedFaces = input,
            tooltip : "Select occluded faces",
        })
    });
    elBody.append(elHeader, elPrecision, elNormal, elOccluded);

    return elBody;
};


// Modals

UI.modalUser = (msg) => {
    ATON.checkAuth(
        // Logged
        (u)=>{
            let elBody = ATON.UI.createContainer({ classes: "d-grid gap-2" });
            elBody.append(
                ATON.UI.createButton({
                    text   : "Logout",
                    icon   : "exit",
                    classes: "aton-btn-highlight",
                    onpress: ()=>{
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
    ATON.checkAuth(
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
                        onaddtag   : (k) => modelList.add(k),
                        onremovetag: (k) => modelList.delete(k)
                    });
        
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
        },
        () => {
            THOTH.FE.showToast("Cannot add model: unauthorized");
        }
    )
};


// Metadata editor

UI.createMetadataEditor = (data, data_temp) => {
    let elData = ATON.UI.createContainer();
    
    if (data === undefined || Object.keys(data).length === 0) {
        elData.append(
            ATON.UI.createButton({
                text: "No metadata found"
            })
        );
        return elData;
    };

    // Properties creation logic
    for (const key in data) {
        if (key === "required") continue;
        if (key === "schemaName") continue;
        
        let elBody;

        const attr = data[key];
        
        // Initialize values

        if (attr["type"]) {
            switch (attr.type.toLowerCase()) {
                case "string":
                    elBody = ATON.UI.createInputText({
                        label      : key,
                        value      : (data_temp && data_temp[key] !== undefined) ? data_temp[key] : undefined,
                        placeholder: "string",
                        oninput    : (v) => data_temp[key] = v,
                    });
                    break;
                case "integer":
                    elBody = ATON.UI.createInputText({
                        placeholder: "integer",
                        value      : (data_temp && data_temp[key] !== undefined) ? data_temp[key] : undefined,
                        label      : key,
                        oninput    : (v) => data_temp[key] = v,
                    });
                    break;
                case "float" :
                    elBody = ATON.UI.createInputText({
                        placeholder: "float",
                        label      : key,
                        value      : (data_temp && data_temp[key] !== undefined) ? data_temp[key] : undefined,
                        oninput    : (v) => data_temp[key] = v,
                    });
                    break;
                case "bool":
                    elBody = UI.createBool({
                        text    : key,
                        value   : (data_temp && data_temp[key] !== undefined) ? data_temp[key] : undefined,
                        onchange: (input) => data_temp[key] = input
                    });
                    break;
                case "enum":
                    let elDisplay = ATON.UI.createButton({
                        text   : data_temp[key],
                    });
                    elBody = THOTH.UI.createSplitRow({
                        colLeft: 6,
                        itemsLeft: ATON.UI.createDropdown({
                            title: key,
                            items: attr.value.map(option => ({
                                title   : option,
                                onselect: () => {
                                    data_temp[key] = option;
                                    elDisplay.textContent = option;
                                }
                            }))
                        }),
                        itemsRight: elDisplay,
                    });
                    
                    break;
                case "enum-multiple":
                    elBody = ATON.UI.createTagsComponent({
                        list    : attr.value,
                        label   : key,
                        tags    : data_temp[key],
                        onaddtag: (k) => {
                            if (!data_temp[key].includes(k)) {
                                data_temp[key].push(k);
                            }
                        },
                        onremovetag: (k) => {
                            const index = data_temp[key].indexOf(k);
                            if (index !== -1) {
                                data_temp[key].splice(index, 1);
                            }
                        },
                    });
                    break;
                default:
                    break;
            }
        }
        else if (typeof attr === "object") {
            elBody = ATON.UI.createTreeGroup({
                items: 
                [
                    {
                        title   : key,
                        open    : false,
                        content : UI.createMetadataEditor(attr, data_temp[key])
                    }
                ]
            });
        }

        if (elBody) {
            elData.append(elBody);
        }
    }
    return elData;
};

UI.modalLayerDetails = (layerId, data_temp) => {
    const layer = THOTH.Layers.layerMap.get(layerId);
    if (layer === undefined || layer.trash) return;

    if (data_temp === undefined) data_temp = structuredClone(layer.metadata) || {};
    
    const schemaName = data_temp?.schemaName;
    const prev_data  = structuredClone(layer.metadata) || {};
    const schema     = THOTH.MD.schemaMap.get(schemaName);

    const metadataBody = ATON.UI.createContainer({classes: "row g-0 w-100"});
    metadataBody.append(
        ATON.UI.createButton({
            text   : "Inherit from Scene",
            variant: "info",
            onpress: () => {
                data_temp = structuredClone(THOTH.sceneMetadata);
                UI.modalLayerDetails(layerId, data_temp);
            }
        }),
        UI.createMetadataEditor(schema, data_temp),
    )

    const ellayerDetails = UI.createSplitRow({
        colLeft: 7,
        itemsLeft: ATON.UI.createColorPicker({
            color: layer.highlightColor,
            onchange: (c) => {
                layer.highlightColor = c,
                THOTH.updateVisibility
            }
        }),
        itemsRight: ATON.UI.createButton({
            text   : "Delete Layer",
            icon   : "trash",
            onpress: () => {
                THOTH.fire("deleteLayer", (layerId));
                ATON.UI.hideModal();
            }
        }),
    });
    
    // Body
    const elBody = ATON.UI.createTreeGroup({
        items: [
            // Name
            {
                title  : "Layer name",
                open   : true,
                content: ATON.UI.createInputText({
                    label   : "Layer name",
                    value   : layer.name,
                    onchange: (v) => THOTH.fire("renameLayer", {
                        id      : layerId,
                        data    : v,
                        prevData: structuredClone(layer.name) || "",
                    }),
                })
            },
            // Layer details
            {
                title  : "Details",
                open   : false,
                content: ellayerDetails
            },
            // Schema selection
            {
                title  : "Metadata schema",
                open   : true,
                content: ATON.UI.createInputText({
                    label      : "Build metadata from schema",
                    value      : schemaName,
                    list       : Array.from(THOTH.MD.schemaMap.keys()),
                    placeholder: "Choose chema",
                    onchange   : (v) => {
                        if (v !== schemaName) {
                            data_temp = THOTH.MD.createPropertiesfromSchema(v);
                            UI.modalLayerDetails(layerId, data_temp);
                        }
                    }
                })
            },
            // Metadata
            {
                title  : "Metadata",
                open   : true,
                content: metadataBody,
            }
        ]
    });
    // Footer
    const elFooter = UI.createModalFooter({
        onsuccess: () => {
            THOTH.fire("editLayerMetadata", {
                id      : layerId,
                data    : data_temp,
                prevData: prev_data
            });
            ATON.UI.hideModal();
        },
        successText: "Save changes"
    });

    ATON.UI.showModal({
        header: `Edit layer with id: ${layerId}`,
        body  : elBody,
        footer: elFooter,
    });
}; 

UI.modalSceneMetadata = (data_temp) => {
    if (data_temp === undefined) data_temp = structuredClone(THOTH.sceneMetadata) || {};
    
    const schemaName = data_temp?.schemaName;
    const prev_data  = THOTH.sceneMetadata || {};
    const schema     = THOTH.MD.schemaMap.get(schemaName);

    // Body
    const elBody = ATON.UI.createTreeGroup({
        items: [
            // Schema
            {
                title  : "Metadata schema",
                open   : true,
                content: ATON.UI.createInputText({
                    label      : "Build metadata from schema",
                    value      : schemaName,
                    list       : Array.from(THOTH.MD.schemaMap.keys()),
                    placeholder: "Choose chema",
                    onchange   : (v) => {
                        if (v !== schemaName) {
                            data_temp = THOTH.MD.createPropertiesfromSchema(v);
                            UI.modalSceneMetadata(data_temp);
                        }
                    }
                })
            },
            // Metadata
            {
                title  : "Metadata",
                open   : true,
                content: UI.createMetadataEditor(schema, data_temp),
            }
        ]
    });    

    // Footer
    const elFooter = UI.createModalFooter({
        onsuccess: () => {
            THOTH.fire("editSceneMetadata", {
                data    : data_temp,
                prevData: prev_data
            });
            ATON.UI.hideModal();
        },
        successText: "Save changes"
    });

    ATON.UI.showModal({
        header: `Edit scene metadata`,
        body  : elBody,
        footer: elFooter,
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
            onpress: () => ATON.UI.hideModal()
        }),
    );
    return elFooter;
};


export default UI;