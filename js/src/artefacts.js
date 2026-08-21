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

Artefacts._unwrap = (data = {}) => {
    return data?.artefact_data?.artefact_data ||
        data?.artefact_data ||
        data;
};

Artefacts._getField = (data, fieldName, fallbackFieldNames = [], includeQualified = true) => {
    const keys = [
        fieldName,
        ...(includeQualified ? [ `artefact.${fieldName}` ] : []),
        ...fallbackFieldNames
    ];

    for (const key of keys) {
        if (data?.[key] !== undefined && data[key] !== null) return data[key];
    }

    return undefined;
};

Artefacts.normalize = (data = {}, options = {}) => {
    const preserveSceneInput = options.preserveSceneInput === true;
    const source = preserveSceneInput
        ? data !== null && typeof data === "object" && !Array.isArray(data) ? data : {}
        : Artefacts._unwrap(data);
    const getField = (fieldName, fallbackFieldNames = []) => {
        return Artefacts._getField(
            source,
            fieldName,
            fallbackFieldNames,
            !preserveSceneInput
        );
    };
    const modelUrl = preserveSceneInput
        ? getField("gltf_file", [ "url", "path", "src" ])
        : getField("glb_file", [
            "gltf_file",
            "artefact.gltf_file",
            "url",
            "path",
            "src"
        ]);
    const artefact = {
        title      : getField("title", [ "name" ]) || "",
        gltf_file  : modelUrl || "",
        description: getField("description") || "",
        owner      : getField("owner") || "",
        keywords   : Array.isArray(getField("keywords"))
            ? structuredClone(getField("keywords"))
            : [],
        copyright  : getField("copyright") || ""
    };

    for (const key in source) {
        if (artefact[key] === undefined) artefact[key] = structuredClone(source[key]);
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
    return structuredClone(Artefacts.getModelArtefact(modelId) || Artefacts.normalize());
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
