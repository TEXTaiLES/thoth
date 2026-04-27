/*===========================================================================

    THOTH
    Collaborative utilites

    Author: 
        Stelios Alvanos (steliosalvanos@gmail.com)

===========================================================================*/
let Collab = {};



Collab.syncScene = (sobj) => {
    // Clear existing scene items
    THOTH.Layers.layerMap = new Map();
    THOTH.Models.modelMap = new Map();
    THOTH.sceneMetadata   = {};
    // Reset FE
    THOTH.FE.setupLayerElements();
    THOTH.FE.setupModelElements();
    // Parse scene
    ATON.SceneHub.parseScene(sobj);
};


Collab.parseCollab = (collab) => {
    if (collab === true) THOTH.collaborative = true;
};


export default Collab;