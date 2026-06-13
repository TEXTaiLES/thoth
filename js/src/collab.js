/*===========================================================================

    THOTH
    Collaborative utilites

    Author: 
        Stelios Alvanos (steliosalvanos@gmail.com)

===========================================================================*/
let Collab = {};



Collab.syncScene = (sobj) => {
    // Clear existing scene items
    THOTH.Selections.selectionMap = new Map();
    THOTH.Selections.activeSelection = undefined;
    THOTH.Layers.layerMap = THOTH.Selections.selectionMap;
    THOTH.Layers.activeLayer = undefined;
    THOTH.Models.modelMap = new Map();
    THOTH.SceneStore?.parseScene(sobj);
    if (THOTH.SemAnnotations.nodes) {
        THOTH.SemAnnotations.nodes.clear();
    }
    THOTH.SemAnnotations.semMap = new Map();
    THOTH.SemAnnotations.semNodeMap = new Map();
    THOTH.sceneMetadata   = {};
    // Reset FE
    THOTH.FE.setupLayerElements();
    THOTH.FE.setupModelElements();
    THOTH.FE.setupSemAnnotationElements();
    // Parse scene
    ATON.SceneHub.parseScene(sobj);
};


Collab.parseCollab = (collab) => {
    if (collab === true) THOTH.collaborative = true;
};


export default Collab;
