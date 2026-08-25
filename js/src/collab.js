/*===========================================================================

    THOTH
    Collaborative utilites

===========================================================================*/
let Collab = {};



Collab.syncScene = (sobj) => {
    // Clear existing scene items
    THOTH.Selections.selectionMap = new Map();
    THOTH.Selections.activeSelection = undefined;
    
    if (THOTH.Annotations) THOTH.Annotations.activeAnnotation = null;
    if (THOTH.MSR) THOTH.MSR.currentMeasurementLine = null;
    if (THOTH.SemAnnotations) THOTH.SemAnnotations.currentAnnotation = null;
    
    THOTH.Models.modelMap = new Map();
    THOTH.SceneStore?.parseScene(sobj);

    if (THOTH.SemAnnotations.nodes) THOTH.SemAnnotations.nodes.clear();
    if (THOTH.MSR.nodes) THOTH.MSR.nodes.clear();
    
    THOTH.MSR.msrMap = new Map();
    THOTH.MSR.msrSemMap = new Map();
    THOTH.SemAnnotations.semMap = new Map();
    THOTH.SemAnnotations.semNodeMap = new Map();

    // Reset FE
    THOTH.FE.setupSelectionElements();
    THOTH.FE.setupMsrElements();
    THOTH.FE.setupSemAnnotationElements();
    
    // Parse scene
    ATON.SceneHub.parseScene(sobj);
};


Collab.parseCollab = (collab) => {
    THOTH.collaborative = collab === true;
};


export default Collab;
