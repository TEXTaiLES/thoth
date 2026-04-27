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
        const layer = layers[layerId];
        Layers.layerMap.set(Number(layerId), layer);
        THOTH.FE.addNewLayer(Number(layerId));
    };

    // Active layer
    Layers.activeLayer = undefined;
};


// Management

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
    const layerData = {
        id            : layerId,
        name          : `New Layer`,
        metadata      : {},
        selection     : {},
        visible       : true,
        highlightColor: THOTH.Utils.getHighlightColor(layerId),
        trash         : false
    };

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

    layer.name = newName;
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
    const layerControler = THOTH.FE?.layerMap.get(layerId);
    
    if (layer === undefined) return;
    
    if (layer.visible) {
        Layers.hideLayer(layerId);
        THOTH.FE.toggleControllerVisibility(layerControler, false);
    }
    else {
        Layers.showLayer(layerId);
        THOTH.FE.toggleControllerVisibility(layerControler, true);
    }
};


// Export

Layers.getExportData = () => {
    const layerObjects = {};
    for (const [id, layer] of Layers.layerMap.entries()) {
        if (!layer || layer.trash === true) continue;
        layerObjects[id] = layer;
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