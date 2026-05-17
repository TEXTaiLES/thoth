/*===========================================================================

    THOTH
    History management

    Authors: 
        Stelios Alvanos (steliosalvanos@gmail.com)
        Apostolos Kastritsis

===========================================================================*/
let History = {};

/*
HISTORY API:
{
    type,
    id,
    value,
    prevValue
}
*/


// Action list
History.ACTIONS = {};

History.ACTIONS.CREATE_LAYER = 0;
History.ACTIONS.DELETE_LAYER = 1;
History.ACTIONS.RENAME_LAYER = 2;

History.ACTIONS.SELEC_ADD = 4;
History.ACTIONS.SELEC_DEL = 5;

History.ACTIONS.EDIT_METADATA_LAYER = 3;
History.ACTIONS.EDIT_METADATA_SCENE = 6;

History.ACTIONS.TRANSFORM_MODEL_POS = 7;
History.ACTIONS.TRANSFORM_MODEL_ROT = 8;

History.ACTIONS.ADD_MODEL = 9;
History.ACTIONS.DEL_MODEL = 10;

History.ACTIONS.ADD_MEASUREMENT = 11;
History.ACTIONS.DEL_MEASUREMENT = 12;
History.ACTIONS.RENAME_MEASUREMENT = 2;

// Setup

History.setup = () => {
    History.historyIdx = 0;

    History.undoStack = [];
    History.redoStack = [];
};


// Add to history

History.pushAction = (action) => {
    if (action.type === undefined) return;

    History.undoStack.push(action);
    History.redoStack = [];
};

// Undo/redo

History.undo = () => {
    if (History.undoStack.length === 0) return;

    const action        = History.undoStack.pop();
    const inverseAction = History.fireAndInverse(action);

    // Store inverse action in redo stack
    History.redoStack.push(inverseAction);
    History.historyIdx -= 1;
};

History.redo = () => {
    if (History.redoStack.length === 0) return;
    const action        = History.redoStack.pop();
    const inverseAction = History.fireAndInverse(action);
    
    // Store inverse action in undo stack
    History.undoStack.push(inverseAction);
    History.historyIdx += 1;
};

History.fireAndInverse = (action) => {
    const type      = action.type;
    const id        = action.id;
    let   value     = action.value;
    let   prevValue = action.prevValue;

    let inverseType = null;

    // Re-enact the inverse action
    switch(type) {
        // Layers
        case History.ACTIONS.CREATE_LAYER:
            inverseType = History.ACTIONS.DELETE_LAYER;
            THOTH.Layers.deleteLayer(id);
            THOTH.firePhoton("deleteLayer", id);
            break;
        case History.ACTIONS.DELETE_LAYER:
            inverseType = History.ACTIONS.CREATE_LAYER;
            THOTH.Layers.createLayer(id);
            THOTH.firePhoton("createLayer", id);
            break;
        case History.ACTIONS.RENAME_LAYER:
            inverseType = History.ACTIONS.RENAME_LAYER;
            // Swap
            [value, prevValue] = [prevValue, value];
            THOTH.Layers.renameLayer(id, value);
            THOTH.firePhoton("renameLayer", {
                id   : id,
                value: value
            });
            break;
        case History.ACTIONS.EDIT_METADATA_LAYER:
            inverseType = History.ACTIONS.EDIT_METADATA_LAYER;
            // Swap
            [value, prevValue] = [prevValue, value];
            THOTH.MD.editLayerMetadata(id, value);
            THOTH.firePhoton("editLayerMetadata", {
                id   : id,
                value: value
            });
            break;
        case History.ACTIONS.EDIT_METADATA_SCENE:
            inverseType = History.ACTIONS.EDIT_METADATA_SCENE;
            // Swap
            [value, prevValue] = [prevValue, value];
            THOTH.MD.editSceneMetadata(value);
            THOTH.firePhoton("editSceneMetadata", value);
            break;
        case History.ACTIONS.SELEC_ADD:
            inverseType = History.ACTIONS.SELEC_DEL;
            THOTH.Layers.delFromSelection(id, value);
            THOTH.firePhoton("delFromSelection", {
                id       : id,
                selection: value
            });
            break;
        case History.ACTIONS.SELEC_DEL:
            inverseType = History.ACTIONS.SELEC_ADD;
            THOTH.Layers.addToSelection(id, value);
            THOTH.firePhoton("addToSelection", {
                id       : id,
                selection: value
            });
            break;
        // Models
        case History.ACTIONS.TRANSFORM_MODEL_POS:
            inverseType = History.ACTIONS.TRANSFORM_MODEL_POS;
            [value, prevValue] = [prevValue, value];
            THOTH.Models.modelTransformPos(id, value);
            THOTH.firePhoton("modelTransformPos", {
                modelName: id,
                value    : value
            });
            break;
        case History.ACTIONS.TRANSFORM_MODEL_ROT:
            inverseType = History.ACTIONS.TRANSFORM_MODEL_ROT;
            // Swap
            [value, prevValue] = [prevValue, value];
            THOTH.Models.modelTransformRot(id, value);
            THOTH.firePhoton("modelTransformRot", {
                modelName: id,
                value    : value
            });
            break;
        case History.ACTIONS.ADD_MODEL:
            inverseType = History.ACTIONS.DEL_MODEL;
            THOTH.Models.deleteModel(id);
            THOTH.firePhoton("deleteModel", id);
            break;
        case History.ACTIONS.DEL_MODEL:
            inverseType = History.ACTIONS.ADD_MODEL;
            THOTH.Models.addModelFromURL(id);
            THOTH.firePhoton("addModel");
            break; 
        case History.ACTIONS.ADD_MEASUREMENT:
            inverseType = History.ACTIONS.DEL_MEASUREMENT;
            THOTH.MSR.deleteMeasurement(id);
            THOTH.firePhoton("deleteMeasurement", id);
            break;
        case History.ACTIONS.DEL_MEASUREMENT:
            inverseType = History.ACTIONS.ADD_MEASUREMENT;
            THOTH.MSR.addMeasurement(id, value.point1, value.point2);
            THOTH.firePhoton("createMeasurement", {
                id    : id,
                point1: value.point1,
                point2: value.point2,
            });
        /*case History.ACTIONS.RENAME_MEASUREMENT:
            inverseType = History.ACTIONS.RENAME_MEASUREMENT;
            // Swap
            [value, prevValue] = [prevValue, value];
            THOTH.MSR.renameMeasurement(id, value);
            THOTH.firePhoton("renameMeasurement", {
                id    : id,
                value: value, 
                prevValue: prevValue               
            });*/
            break;

        default:
            THOTH.UI.showToast("Invalid action type: " + type);
            console.warn("Invalid action: " + type);
            return;
    }

    const inverseAction = {
        type     : inverseType,
        id       : id,
        value    : value,
        prevValue: prevValue
    };

    return inverseAction;
};



export default History;