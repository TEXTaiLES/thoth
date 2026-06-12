/*===========================================================================

    THOTH
    Operation history

===========================================================================*/
let History = {};


// Setup

History.setup = () => {
    History.undoStack = [];
    History.redoStack = [];
};


// Utils

History._clone = (value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;

    return structuredClone(value);
};

History._getLocalUserId = () => {
    return THOTH.user?.id || THOTH.user?.username || THOTH.user?.name || "local";
};

History._isLocalOperation = (operation) => {
    return operation?.user_id === undefined || operation.user_id === History._getLocalUserId();
};


// API

History.push = (inverseOperation) => {
    if (!inverseOperation?.type) return;
    if (!History._isLocalOperation(inverseOperation)) return;

    History.undoStack.push(History._clone(inverseOperation));
    History.redoStack = [];
};

History.undo = () => {
    while (History.undoStack.length > 0) {
        const operation = History.undoStack.pop();
        if (!History._isLocalOperation(operation)) continue;

        const redoOperation = THOTH.Ops.invert(operation);
        THOTH.Ops.apply(
            {
                ...History._clone(operation),
                source   : "history",
                timestamp: Date.now()
            },
            {
                pushHistory: false,
                broadcast  : true
            }
        );
        History.redoStack.push(redoOperation);
        return;
    }
};

History.redo = () => {
    while (History.redoStack.length > 0) {
        const operation = History.redoStack.pop();
        if (!History._isLocalOperation(operation)) continue;

        const undoOperation = THOTH.Ops.invert(operation);
        THOTH.Ops.apply(
            {
                ...History._clone(operation),
                source   : "history",
                timestamp: Date.now()
            },
            {
                pushHistory: false,
                broadcast  : true
            }
        );
        History.undoStack.push(undoOperation);
        return;
    }
};

History.clear = () => {
    History.undoStack = [];
    History.redoStack = [];
};


export default History;
