import assert from "node:assert/strict";

import Annotations from "../src/annotations.js";
import API from "../src/api_client.js";
import Ops from "../src/operations.js";
import SceneStore from "../src/scene_store.js";
import Selections from "../src/selections.js";


globalThis.THOTH = {
    Annotations,
    API,
    FE: {
        showToast: () => {}
    },
    Selections,
    SceneStore
};
THOTH.Utils = {
    getHighlightColor: () => "#ffffff"
};


Annotations.setup();
SceneStore.setup();
Selections.setup();


const sceneData = {
    ["lay" + "ers"]              : { legacy_selection: {} },
    ["measure" + "ments"]        : { legacy_measurement: {} },
    ["semantic_" + "annotations"]: { legacy_annotation: {} },
    ["scene" + "Metadata"]       : { legacy: true },
    models              : {
        dress: {
            artefact: {
                title    : "Dress",
                gltf_file: "dress.gltf"
            },
            metadata: {
                schema: {
                    name: "puc_schema"
                },
                attributes: {
                    material: "silk"
                }
            },
            transforms: {
                translation: [1, 2, 3]
            },
            selections: {
                sel_1: {
                    name      : "Hem",
                    annotation: {
                        selected_faces : {
                            mesh_1: [1, 2, 2]
                        },
                        selection_color: "#ff0000"
                    },
                    trash: false
                },
                deleted_sel: {
                    trash: true
                }
            },
            measurements: {
                msr_1: {
                    name      : "Width",
                    annotation: {
                        distance     : 4,
                        distance_type: "euclidean"
                    }
                }
            },
            semantic_annotations: {
                ann_1: {
                    name      : "Marker",
                    mesh_id   : "runtime_mesh",
                    annotation: {
                        point: {
                            x      : 1,
                            y      : 2,
                            z      : 3,
                            face_id: 5
                        }
                    }
                }
            }
        }
    }
};

SceneStore.parseScene(sceneData);
const exportedScene = SceneStore.getExportData();

assert.deepEqual(Object.keys(exportedScene), ["models"]);
assert.equal(exportedScene.models.dress.artefact.gltf_file, "dress.gltf");
assert.deepEqual(exportedScene.models.dress.transforms.translation, { x: 1, y: 2, z: 3 });
assert.deepEqual(exportedScene.models.dress.selections.sel_1.annotation.selected_faces.mesh_1, [1, 2]);
assert.equal(exportedScene.models.dress.selections.deleted_sel, undefined);
assert.equal(exportedScene["lay" + "ers"], undefined);
assert.equal(exportedScene["measure" + "ments"], undefined);
assert.equal(exportedScene["semantic_" + "annotations"], undefined);
assert.equal(exportedScene["scene" + "Metadata"], undefined);
assert.equal(exportedScene.models.dress.semantic_annotations.ann_1.mesh_id, undefined);


const normalizedAnnotation = Annotations.normalize({
    id                  : "ann_2",
    name                : "Related item",
    related_rgb_images  : ["rgb_1"],
    related_artefacts   : [{ id: 12, name: "Artefact", url: "/a/12", extra: "kept" }],
    meshName            : "runtime",
    annotation          : {
        point: {
            x: 0,
            y: 0,
            z: 0
        }
    }
});

assert.deepEqual(normalizedAnnotation.related_rgb_images[0], { id: "rgb_1", name: "", url: "" });
assert.equal(normalizedAnnotation.related_artefacts[0].id, "12");
assert.equal(normalizedAnnotation.annotation.meshName, undefined);


const operation = Ops.makeOperation(
    "selection.create",
    {
        model_id  : "dress",
        collection: "selections",
        item_id   : "sel_2"
    },
    { id: "sel_2" },
    undefined
);
operation.user_id = "local";
operation.timestamp = 10;
operation.source = "local";

const inverse = Ops.invert(operation);
assert.equal(inverse.type, "selection.delete");
assert.deepEqual(inverse.value, undefined);
assert.deepEqual(inverse.prev_value, { id: "sel_2" });


API.setup({});
const missingResponse = await API.get("scene_export");
assert.equal(missingResponse.ok, false);
assert.equal(missingResponse.error, "Missing endpoint: scene_export");
