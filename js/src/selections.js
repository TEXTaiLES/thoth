/*===========================================================================

    THOTH
    Model-scoped selection annotations

===========================================================================*/
let Selections = {};


// Setup

Selections.setup = () => {
    Selections.selectionMap = new Map();
    Selections.activeSelection = undefined;
};


// Utils

Selections._makeKey = (modelId, selectionId) => {
    return `${modelId}:${selectionId}`;
};

Selections._getDefaultModelId = () => {
    if (THOTH.hoveredModel) return THOTH.hoveredModel;
    if (THOTH.Models?.modelMap?.size > 0) return THOTH.Models.modelMap.keys().next().value;

    const models = THOTH.SceneStore?.getScene()?.models || {};
    return Object.keys(models)[0];
};

Selections._getSelectionColor = (selectionId, data = {}) => {
    return data.annotation?.selection_color ||
        data.selection_color ||
        data.highlightColor ||
        THOTH.Utils.getHighlightColor(selectionId);
};

Selections._parseFaceRangeString = (value = "") => {
    const faces = [];
    const parts = String(value).split(",");

    for (const rawPart of parts) {
        const part = rawPart.trim();
        if (!part) continue;

        const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
        if (rangeMatch) {
            const start = Number(rangeMatch[1]);
            const end   = Number(rangeMatch[2]);
            const step  = start <= end ? 1 : -1;

            for (let face = start; face !== end + step; face += step) {
                faces.push(face);
            }
            continue;
        }

        const face = Number(part);
        if (Number.isInteger(face) && face >= 0) faces.push(face);
    }

    return faces;
};

Selections._normalizeFaceList = (faces) => {
    const rawFaces = typeof faces === "string"
        ? Selections._parseFaceRangeString(faces)
        : Array.from(faces || []);

    return Array.from(new Set(
        rawFaces
            .map(face => Number(face))
            .filter(face => Number.isInteger(face) && face >= 0)
    ));
};

Selections._normalizeSelectedFaces = (data = {}) => {
    const selectedFaces = data.annotation?.selected_faces ||
        data.selected_faces ||
        data.selection ||
        {};

    let output = {};
    for (const meshId in selectedFaces) {
        output[meshId] = Selections._normalizeFaceList(selectedFaces[meshId]);
    }

    return output;
};

Selections.normalizeSelection = (selectionId, data = {}) => {
    const color = Selections._getSelectionColor(selectionId, data);
    const base = THOTH.Annotations?.createBaseAnnotation(selectionId, {
        ...data,
        annotation: {
            ...(data.annotation || {}),
            selected_faces : Selections._normalizeSelectedFaces(data),
            selection_color: color
        }
    }) || {};

    return {
        ...base,
        id             : base.id ?? selectionId,
        name           : base.name || "New Selection",
        metadata       : data.metadata || {},
        visible        : base.visible !== false,
        highlightColor : color,
        selection_color: color,
        selection      : base.annotation.selected_faces,
        trash          : data.trash === true
    };
};

Selections._getFaces = (selection) => {
    return selection?.annotation?.selected_faces || selection?.selection || {};
};

Selections._setFaces = (selection, faces) => {
    if (!selection.annotation) selection.annotation = {};

    selection.annotation.selected_faces = faces || {};
    selection.selection = selection.annotation.selected_faces;
};

Selections._getFaceCount = (selection) => {
    const selectedFaces = Selections._getFaces(selection);
    let count = 0;

    for (const meshId in selectedFaces) {
        count += selectedFaces[meshId]?.length || 0;
    }

    return count;
};

Selections.getNextSelectionId = (modelId) => {
    const collection = THOTH.SceneStore?.getModelCollection(modelId, "selections") || {};
    return THOTH.Utils.getFirstUnusedKey(collection);
};

Selections._applyLocal = (type, modelId, selectionId, value, prevValue, field) => {
    const operation = THOTH.Ops.makeOperation(type, {
        model_id  : modelId,
        collection: "selections",
        item_id   : selectionId,
        field     : field
    }, value, prevValue);

    return THOTH.Ops.applyLocal(operation);
};


// Runtime mutation

Selections.applySelectionData = (modelId, selectionId, data = {}) => {
    if (modelId === undefined || selectionId === undefined) return;

    const selection = Selections.normalizeSelection(selectionId, data);
    selection.model_id = modelId;

    Selections.selectionMap.set(Selections._makeKey(modelId, selectionId), selection);
    THOTH.SceneStore?.setModelCollectionItem(modelId, "selections", selectionId, selection);

    if (THOTH.FE?.addNewSelection) THOTH.FE.addNewSelection(selectionId, modelId);
    Selections.refreshHighlights(modelId);

    return selection;
};

Selections.deleteSelection = (modelId, selectionId) => {
    const selection = Selections.getSelection(modelId, selectionId);
    if (!selection) return;

    if (THOTH.Annotations?.isActive?.("selections", selectionId, modelId)) {
        THOTH.Annotations.clearActive();
    }

    selection.trash = true;

    if (THOTH.FE?.deleteSelection) THOTH.FE.deleteSelection(selectionId, modelId);
    Selections.refreshHighlights(modelId);
};


// API

Selections.parseSelections = (modelId, selections) => {
    if (!selections) return;

    for (const selectionId in selections) {
        Selections.applySelectionData(modelId, selectionId, selections[selectionId]);
    }
};

Selections.createSelection = (modelId, data = {}) => {
    const resolvedModelId = modelId || Selections._getDefaultModelId();
    if (!resolvedModelId) return false;

    const selectionId = data.id ?? Selections.getNextSelectionId(resolvedModelId);
    const selection = Selections.normalizeSelection(selectionId, {
        name   : "New Selection",
        visible: true,
        ...data
    });

    return Selections._applyLocal(
        "selection.create",
        resolvedModelId,
        selectionId,
        selection
    );
};

Selections.clearActiveSelection = (clearUI = true) => {
    if (THOTH.Annotations?.getActive?.()?.modality === "selections") {
        THOTH.Annotations.clearActive({
            refreshSceneTree: clearUI
        });
        return;
    }

    Selections.activeSelection = undefined;

    if (clearUI) {
        THOTH.FE?.handleElementHighlight(null, THOTH.FE.selectionControllerMap);
    }
};

Selections.setActiveSelection = (modelId, selectionId) => {
    if (modelId === null || selectionId === null) {
        THOTH.Annotations?.clearActive?.();
        return;
    }

    if (THOTH.Annotations?.select) {
        return THOTH.Annotations.select("selections", selectionId, {
            modelId: modelId
        });
    }

    const selection = Selections.getSelection(modelId, selectionId) ||
        Selections.getSelectionById(selectionId);
    if (!selection || selection.trash) return false;

    Selections.activeSelection = selection;
    return true;
};

Selections.getSelection = (modelId, selectionId) => {
    if (modelId === undefined || selectionId === undefined) return undefined;

    return Selections.selectionMap.get(Selections._makeKey(modelId, selectionId));
};

Selections.getSelectionById = (selectionId) => {
    for (const selection of Selections.selectionMap.values()) {
        if (String(selection.id) === String(selectionId) && selection.trash !== true) return selection;
    }

    return undefined;
};

Selections.getActiveSelection = () => {
    return THOTH.Annotations?.getActiveSelection?.() || Selections.activeSelection;
};

Selections.addFaces = (modelId, selectionId, meshId, faces) => {
    const selection = Selections.getSelection(modelId, selectionId);
    if (!selection || !meshId || !faces?.length) return false;

    const selectedFaces = structuredClone(Selections._getFaces(selection)) || {};
    selectedFaces[meshId] = Array.from(new Set([
        ...(selectedFaces[meshId] || []),
        ...faces
    ]));

    return Selections.updateFaces(modelId, selectionId, selectedFaces);
};

Selections.deleteFaces = (modelId, selectionId, meshId, faces) => {
    const selection = Selections.getSelection(modelId, selectionId);
    if (!selection || !meshId || !faces?.length) return false;

    const deleteSet = new Set(faces);
    const selectedFaces = structuredClone(Selections._getFaces(selection)) || {};
    selectedFaces[meshId] = (selectedFaces[meshId] || []).filter(face => !deleteSet.has(face));

    return Selections.updateFaces(modelId, selectionId, selectedFaces);
};

Selections.clearFaces = (modelId, selectionId) => {
    return Selections.updateFaces(modelId, selectionId, {});
};

Selections.updateFaces = (modelId, selectionId, selectedFaces) => {
    const prevValue = structuredClone(Selections.getSelection(modelId, selectionId));
    if (!prevValue) return false;

    const value = Selections.normalizeSelection(selectionId, prevValue);
    Selections._setFaces(value, selectedFaces);

    return Selections._applyLocal(
        "selection.update",
        modelId,
        selectionId,
        value,
        prevValue,
        "selected_faces"
    );
};

Selections.updateSelection = (modelId, selectionId, data, field) => {
    const prevValue = structuredClone(Selections.getSelection(modelId, selectionId));
    if (!prevValue) return false;

    const value = Selections.normalizeSelection(selectionId, {
        ...prevValue,
        ...data,
        annotation: {
            ...(prevValue.annotation || {}),
            ...(data.annotation || {})
        }
    });

    return Selections._applyLocal(
        "selection.update",
        modelId,
        selectionId,
        value,
        prevValue,
        field
    );
};

Selections.updateVisibility = (modelId, selectionId, visible) => {
    return Selections.updateSelection(modelId, selectionId, {
        visible: Boolean(visible)
    }, "visible");
};

Selections.refreshHighlights = (modelId) => {
    if (!THOTH.clearHighlights || !THOTH.highlightSelection) return;

    THOTH.clearHighlights();
    Selections.refreshAllHighlights();
};

Selections.refreshAllHighlights = () => {
    if (!THOTH.highlightSelection) return;

    for (const selection of Selections.selectionMap.values()) {
        if (!selection || selection.trash || selection.visible === false) continue;

        const selectedFaces = Selections._getFaces(selection);
        const highlightColor = THOTH.Utils.hex2rgb(selection.selection_color);

        for (const meshId in selectedFaces) {
            THOTH.highlightSelection(
                selectedFaces[meshId],
                highlightColor,
                selection.model_id,
                meshId
            );
        }
    }
};

Selections._encodeFaceRangeString = (faces) => {
    const sortedFaces = Selections._normalizeFaceList(faces)
        .sort((a, b) => a - b);
    const ranges = [];

    let rangeStart = null;
    let previousFace = null;

    for (const face of sortedFaces) {
        if (rangeStart === null) {
            rangeStart = face;
            previousFace = face;
            continue;
        }

        if (face === previousFace + 1) {
            previousFace = face;
            continue;
        }

        ranges.push(rangeStart === previousFace
            ? String(rangeStart)
            : `${rangeStart}-${previousFace}`);
        rangeStart = face;
        previousFace = face;
    }

    if (rangeStart !== null) {
        ranges.push(rangeStart === previousFace
            ? String(rangeStart)
            : `${rangeStart}-${previousFace}`);
    }

    return ranges.join(",");
};

Selections._encodeSelectedFaces = (selectedFaces = {}) => {
    let output = {};

    for (const meshId in selectedFaces) {
        output[meshId] = Selections._encodeFaceRangeString(selectedFaces[meshId]);
    }

    return output;
};

Selections.getExportData = (modelId) => {
    const collection = THOTH.SceneStore?.getModelCollection(modelId, "selections") || {};
    let output = {};

    for (const selectionId in collection) {
        const selection = Selections.normalizeSelection(selectionId, collection[selectionId]);
        if (selection.trash === true) continue;

        output[selectionId] = {
            id                          : selection.id,
            name                        : selection.name,
            description                 : selection.description,
            related_rgb_images          : selection.related_rgb_images,
            related_multispectral_images: selection.related_multispectral_images,
            related_artefacts           : selection.related_artefacts,
            annotation                  : {
                selected_faces : Selections._encodeSelectedFaces(Selections._getFaces(selection)),
                selection_color: selection.selection_color
            },
            visible                     : selection.visible !== false
        };
    }

    return output;
};

Selections.getFaceCount = (selection) => {
    return Selections._getFaceCount(selection);
};


export default Selections;
