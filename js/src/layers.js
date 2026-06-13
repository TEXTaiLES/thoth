/*===========================================================================

    THOTH
    Layer management

    Authors: 
        Stelios Alvanos (steliosalvanos@gmail.com)

===========================================================================*/
let Layers = {};



// Setup

Layers.setup = () => {
    // Create layer map for easy access
    Layers.layerMap = new Map();
};

Layers.parseLayers = (layers) => {
    if (layers === undefined) return;

    for (const layerId in layers) {
        const id = Number(layerId);
        const layer = Layers.normalizeLayer(id, layers[layerId]);
        Layers.layerMap.set(id, layer);
        THOTH.FE.addNewLayer(id);
    };

    // Active layer
    Layers.activeLayer = undefined;
};


// Management

Layers.normalizeLayer = (layerId, data = {}) => {
    const base = THOTH.Annotations?.createBaseAnnotation(layerId, data) || {
        id                            : layerId,
        name                          : data.name || "",
        description                   : data.description || "",
        related_rgb_images            : data.related_rgb_images || [],
        related_multispectral_images  : data.related_multispectral_images || [],
        related_artefacts             : data.related_artefacts || [],
        annotation                    : data.annotation || {},
        visible                       : data.visible !== false
    };

    return {
        ...base,
        metadata      : data.metadata || {},
        selection     : data.selection || base.annotation.selection || {},
        highlightColor: data.highlightColor || data.selection_color || THOTH.Utils.getHighlightColor(layerId),
        trash         : data.trash === true
    };
};

Layers.createLayer = (layerId) => {
    if (layerId === undefined) return;

    const layer = Layers.layerMap.get(layerId);

    // Resolve id conflict
    if (layer !== undefined) {
        if (layer.trash === true) Layers.resurrectLayer(layerId);
        else alert(`Layer id conflict ${layerId}`);

        return;
    }

    // Build layer data
    const layerData = Layers.normalizeLayer(layerId, {
        name          : "New Layer",
        metadata      : {},
        selection     : {},
        annotation    : {},
        visible       : true,
        highlightColor: THOTH.Utils.getHighlightColor(layerId),
        trash         : false
    });

    // Append to map
    Layers.layerMap.set(layerId, layerData);

    // Update front end
    THOTH.FE.addNewLayer(layerId);
};

Layers.deleteLayer = (layerId) => {
    if (layerId === undefined) return;

    const layer = Layers.layerMap.get(layerId);

    layer.trash = true;
    THOTH.Layers.setActiveLayer(null);

    // Update FE
    THOTH.FE.deleteLayer(layerId);
    
    THOTH.updateVisibility();
};

Layers.resurrectLayer = (layerId) => {
    if (layerId === undefined) return;

    const layer = Layers.layerMap.get(layerId);
    if (!layer.trash) return;
    
    layer.trash = false;
    
    // Update FE
    THOTH.FE.addNewLayer(layerId);
    
    THOTH.updateVisibility();
};

Layers.renameLayer = (layerId, newName) => {
    if (layerId === undefined) return;
    
    const layer = Layers.layerMap.get(layerId);
    if (!layer) return;

    Object.assign(layer, THOTH.Annotations?.normalize({
        ...layer,
        name: newName
    }) || { name: newName });
    let layerNameBtn = THOTH.FE.layerNameMap.get(layerId);
    layerNameBtn.textContent = newName;
};

Layers.addToSelection = (layerId, selection) => {
    const layer = Layers.layerMap.get(layerId);

    const tempSelection = layer.selection || {};
    for (const modelName of Object.keys(selection)) {
        tempSelection[modelName] = tempSelection[modelName] || {};

        for (const meshName of Object.keys(selection[modelName])) {
            tempSelection[modelName][meshName] =
            [...THOTH.Toolbox.addFacesToSelection(selection[modelName][meshName], layer.selection[modelName][meshName])];
        }
    }  
    
    layer.selection = tempSelection;
    THOTH.updateVisibility();
};

Layers.delFromSelection = (layerId, selection) => {
    const layer = Layers.layerMap.get(layerId);

    const tempSelection = layer.selection || {};
    for (const modelName of Object.keys(selection)) {
        tempSelection[modelName] = tempSelection[modelName] || {};

        for (const meshName of Object.keys(selection[modelName])) {
            tempSelection[modelName][meshName] =
            [...THOTH.Toolbox.delFacesFromSelection(selection[modelName][meshName], layer.selection[modelName][meshName])];
        }
    }  

    layer.selection = tempSelection;
    THOTH.updateVisibility();
};


// Visibility

Layers.hideLayer = (layerId) => {
    if (layerId === undefined) return;

    const layer = Layers.layerMap.get(layerId);

    layer.visible = false;
    THOTH.updateVisibility();
};

Layers.showLayer = (layerId) => {
    if (layerId === undefined) return;

    const layer = Layers.layerMap.get(layerId);

    layer.visible = true;
    THOTH.updateVisibility();
};

Layers.toggleVisibility = (layerId) => {
    if (layerId === undefined) return;

    const layer = Layers.layerMap.get(layerId);
    if (layer === undefined) return;

    if (THOTH.Annotations) {
        const applied = THOTH.Annotations.setVisible(
            THOTH.Annotations.getModelId("selections", layerId),
            "selections",
            layerId,
            layer.visible === false
        );
        if (applied) return;
    }

    if (layer.visible) Layers.hideLayer(layerId);
    else Layers.showLayer(layerId);
};


// Export

Layers.getExportData = () => {
    const layerObjects = {};
    for (const [id, layer] of Layers.layerMap.entries()) {
        if (!layer || layer.trash === true) continue;
        layerObjects[id] = THOTH.Annotations?.toExportAnnotation(layer) || layer;
    }
    return layerObjects;
};


// Misc

Layers.setActiveLayer = (layerId) => {
    if (layerId === null || Layers.layerMap.has(layerId)) {
        Layers.activeLayer = Layers.layerMap.get(layerId);
        THOTH.FE.handleElementHighlight(layerId, THOTH.FE.layerMap);
    }
};



export default Layers;
