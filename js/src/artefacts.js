/*===========================================================================

    THOTH
    Model artefact helpers

===========================================================================*/
let Artefacts = {};


const ARTEFACT_FIELDS = [
    "title",
    "gltf_file",
    "description",
    "owner",
    "keywords",
    "copyright"
];


// Setup

Artefacts.setup = () => {};


// Normalize

Artefacts._clone = (value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;

    return structuredClone(value);
};

Artefacts.normalize = (data = {}) => {
    const artefact = {
        title      : data.title || data.name || "",
        gltf_file  : data.gltf_file || data.url || data.path || data.src || "",
        description: data.description || "",
        owner      : data.owner || "",
        keywords   : Array.isArray(data.keywords) ? Artefacts._clone(data.keywords) : [],
        copyright  : data.copyright || ""
    };

    for (const key in data) {
        if (artefact[key] === undefined) artefact[key] = Artefacts._clone(data[key]);
    }

    return artefact;
};


// Model data

Artefacts.parseModelArtefact = (modelId, data = {}) => {
    const model = THOTH.SceneStore?.ensureModel(modelId);
    if (!model) return;

    const artefact = Artefacts.normalize(data.artefact || data);
    THOTH.SceneStore.setModelField(modelId, "artefact", artefact);

    return artefact;
};

Artefacts.getModelArtefact = (modelId) => {
    return THOTH.SceneStore?.getModel(modelId)?.artefact;
};

Artefacts.getModelURL = (modelId) => {
    const artefact = Artefacts.getModelArtefact(modelId);

    return artefact?.gltf_file || artefact?.url || artefact?.path || artefact?.src;
};

Artefacts.getExportData = (modelId) => {
    return Artefacts._clone(Artefacts.getModelArtefact(modelId) || Artefacts.normalize());
};


// API

Artefacts.fetchArtefactDetails = async (artefactId) => {
    if (!artefactId) {
        return {
            ok   : false,
            error: "Missing artefact id"
        };
    }

    const response = await THOTH.API.getArtefactData(artefactId);
    if (!response.ok) return response;

    return {
        ...response,
        data: Artefacts.normalize(response.data)
    };
};


// Display

Artefacts.createDetailsView = (modelId) => {
    const artefact = Artefacts.getModelArtefact(modelId) || Artefacts.normalize();
    const elBody = ATON.UI.createContainer({ classes: "d-grid gap-1" });

    for (const fieldName of ARTEFACT_FIELDS) {
        const value = artefact[fieldName];
        const displayValue = Array.isArray(value)
            ? value.join(", ")
            : String(value || "-");

        elBody.append(THOTH.UI.createSplitRow({
            colLeft   : 4,
            itemsLeft : ATON.UI.createButton({
                text: fieldName
            }),
            itemsRight: ATON.UI.createButton({
                text: displayValue
            })
        }));
    }

    return elBody;
};


export default Artefacts;
