/*===========================================================================

    THOTH
    Legacy layer shim for model-scoped selections

===========================================================================*/
let Layers = {};


Layers.setup = () => {
    if (THOTH.Selections?.selectionMap) {
        Layers.layerMap = THOTH.Selections.selectionMap;
    }
    else {
        Layers.layerMap = new Map();
    }

    Layers.activeLayer = undefined;
};

Layers._getModelId = (selectionId) => {
    return THOTH.Selections?.getSelectionById(selectionId)?.model_id ||
        THOTH.Annotations?.getModelId("selections", selectionId);
};

Layers.parseLayers = (layers, modelId) => {
    THOTH.Selections?.parseSelections(modelId, layers);
    Layers.layerMap = THOTH.Selections?.selectionMap || Layers.layerMap;
};

Layers.normalizeLayer = (layerId, data = {}) => {
    return THOTH.Selections?.normalizeSelection(layerId, data) || data;
};

Layers.createLayer = (layerId, data = {}) => {
    const modelId = data.model_id || Layers._getModelId(layerId);
    return THOTH.Selections?.applySelectionData(modelId, layerId, data);
};

Layers.deleteLayer = (layerId) => {
    const modelId = Layers._getModelId(layerId);
    return THOTH.Selections?.deleteSelection(modelId, layerId);
};

Layers.resurrectLayer = (layerId) => {
    const modelId = Layers._getModelId(layerId);
    const selection = THOTH.Selections?.getSelection(modelId, layerId);
    if (!selection) return;

    selection.trash = false;
    THOTH.FE?.addNewLayer(layerId, modelId);
    THOTH.updateVisibility();
};

Layers.renameLayer = (layerId, newName) => {
    const modelId = Layers._getModelId(layerId);
    THOTH.Selections?.updateSelection(modelId, layerId, { name: newName }, "name");
};

Layers.addToSelection = (layerId, selection) => {
    const modelId = Layers._getModelId(layerId);
    const current = THOTH.Selections?.getSelection(modelId, layerId);
    if (!current) return;

    const selectedFaces = THOTH.Selections._clone(THOTH.Selections._getFaces(current)) || {};
    for (const meshId in selection) {
        selectedFaces[meshId] = Array.from(new Set([
            ...(selectedFaces[meshId] || []),
            ...(selection[meshId] || [])
        ]));
    }

    THOTH.Selections.updateFaces(modelId, layerId, selectedFaces);
};

Layers.delFromSelection = (layerId, selection) => {
    const modelId = Layers._getModelId(layerId);
    const current = THOTH.Selections?.getSelection(modelId, layerId);
    if (!current) return;

    const selectedFaces = THOTH.Selections._clone(THOTH.Selections._getFaces(current)) || {};
    for (const meshId in selection) {
        const deleteSet = new Set(selection[meshId] || []);
        selectedFaces[meshId] = (selectedFaces[meshId] || []).filter(face => !deleteSet.has(face));
    }

    THOTH.Selections.updateFaces(modelId, layerId, selectedFaces);
};

Layers.hideLayer = (layerId) => {
    const modelId = Layers._getModelId(layerId);
    THOTH.Selections?.updateVisibility(modelId, layerId, false);
};

Layers.showLayer = (layerId) => {
    const modelId = Layers._getModelId(layerId);
    THOTH.Selections?.updateVisibility(modelId, layerId, true);
};

Layers.toggleVisibility = (layerId) => {
    const modelId = Layers._getModelId(layerId);
    const selection = THOTH.Selections?.getSelection(modelId, layerId);
    if (!selection) return;

    THOTH.Selections.updateVisibility(modelId, layerId, selection.visible === false);
};

Layers.getExportData = () => {
    return {};
};

Layers.setActiveLayer = (layerId, modelId) => {
    if (layerId === null) {
        THOTH.Selections?.setActiveSelection(null, null);
        return;
    }

    const resolvedModelId = modelId || Layers._getModelId(layerId);
    THOTH.Selections?.setActiveSelection(resolvedModelId, layerId);
};


export default Layers;
