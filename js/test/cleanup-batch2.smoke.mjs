import assert from "node:assert/strict";


class Vector3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    clone() {
        return new Vector3(this.x, this.y, this.z);
    }
}

class ThreeStub {}

const createElement = (children = []) => ({
    children,
    className: "",
    classList: {
        add() {}
    },
    append(...items) {
        this.children.push(...items);
    },
    prepend(item) {
        this.children.unshift(item);
    }
});

globalThis.THREE = new Proxy(
    {
        Mesh    : ThreeStub,
        Object3D: ThreeStub,
        Vector3 : Vector3
    },
    {
        get: (target, property) => target[property] || ThreeStub
    }
);
globalThis.ATON = {
    Node: class {},
    NTYPES: { UI: 1 },
    Utils: {
        generateID: prefix => `${prefix}-test`
    },
    UI: {
        elem(markup) {
            if (!markup.includes("<input")) return createElement();

            const values = Array.from(markup.matchAll(/value="([^"]*)"/g), match => match[1]);
            return createElement(values.map(value => ({ value, onchange: null })));
        },
        createButton(options) {
            return {
                ...createElement(),
                onpress: options.onpress
            };
        }
    }
};
globalThis.THOTH = {};

const [
    { default: Annotations },
    { default: Artefacts },
    { default: History },
    { default: Models },
    { default: MSR },
    { default: Ops },
    { default: SceneStore },
    { default: Selections },
    { default: SemAnnotations },
    { default: Transforms },
    { default: UI }
] = await Promise.all([
    import("../src/annotations.js"),
    import("../src/artefacts.js"),
    import("../src/history.js"),
    import("../src/models.js"),
    import("../src/measurements.js"),
    import("../src/operations.js"),
    import("../src/scene_store.js"),
    import("../src/selections.js"),
    import("../src/semantic_annotations.js"),
    import("../src/transforms.js"),
    import("../src/ui.js")
]);

Object.assign(THOTH, {
    Annotations,
    Artefacts,
    History,
    Models,
    MSR,
    Ops,
    SceneStore,
    Selections,
    SemAnnotations,
    Transforms,
    UI,
    config: {
        defaultSchemaName: "puc_schema"
    }
});

const tests = [];
const test = (name, callback) => tests.push({ name, callback });


test("annotation normalization is idempotent after the base canonical pass", () => {
    const source = {
        id: "annotation-1",
        name: "Annotation",
        description: "Description",
        related_rgb_images: [
            {
                image_name: "rgb-1",
                image_url: "/rgb-1.png",
                extra: { retained: true }
            },
            "rgb-2"
        ],
        related_multispectral_images: ["multi-1"],
        related_artefacts: [{ title: "model-1", gltf_file: "/model.glb" }],
        annotation: {
            confidence: 0.75,
            path: [1, 2, 3]
        },
        visible: false
    };
    const original = structuredClone(source);

    assert.deepStrictEqual(
        Annotations.normalize(source),
        Annotations.createBaseAnnotation(source.id, source)
    );
    assert.deepStrictEqual(source, original);
});

test("canonical and legacy scenes preserve their parse/export shapes", () => {
    SceneStore.setup();
    const canonical = {
        models: {
            canonical: {
                id: "canonical",
                artefact: {
                    title: "Canonical",
                    gltf_file: "/canonical.glb",
                    description: "",
                    owner: "owner",
                    keywords: ["textile"],
                    copyright: ""
                },
                metadata: {
                    schema: {
                        name: "puc_schema",
                        version: "1",
                        description: "schema",
                        url: "/schema.json"
                    },
                    attributes: { accession: "A-1" }
                },
                transforms: {
                    translation: { x: 1, y: 2, z: 3 },
                    rotation: { x: 0.1, y: 0.2, z: 0.3 }
                },
                annotations: {
                    selections: {},
                    measurements: {},
                    semantic_annotations: {}
                },
                sensors: [{ id: "sensor-1" }]
            }
        }
    };

    SceneStore.parseScene(canonical);
    assert.deepStrictEqual(SceneStore.getExportData(), canonical);

    const legacy = {
        models: {
            legacy: {
                artefact: {
                    name: "Legacy",
                    url: "/legacy.glb",
                    custom: "retained"
                },
                metadata: {
                    schemaName: "legacy_schema",
                    accession: "L-1"
                },
                transform: {
                    position: [4, 5, 6],
                    rotation: [0.4, 0.5, 0.6]
                }
            }
        }
    };

    SceneStore.parseScene(legacy);
    assert.deepStrictEqual(SceneStore.getExportData(), {
        models: {
            legacy: {
                id: "legacy",
                artefact: {
                    name: "Legacy",
                    url: "/legacy.glb",
                    custom: "retained",
                    title: "Legacy",
                    gltf_file: "/legacy.glb",
                    description: "",
                    owner: "",
                    keywords: [],
                    copyright: ""
                },
                metadata: {
                    schema: {
                        name: "legacy_schema",
                        version: "",
                        description: "",
                        url: ""
                    },
                    attributes: { accession: "L-1" }
                },
                transforms: {
                    translation: { x: 4, y: 5, z: 6 },
                    rotation: { x: 0.4, y: 0.5, z: 0.6 }
                },
                annotations: {
                    selections: {},
                    measurements: {},
                    semantic_annotations: {}
                },
                sensors: []
            }
        }
    });
});

test("transform containers, aliases, vectors, and model loading stay canonical", () => {
    const fixtures = [
        {
            input: {
                transforms: {
                    translation: [1, "2", 3],
                    rotation: { x: "0.1", y: 0.2, z: "0.3" }
                }
            },
            expected: {
                translation: { x: 1, y: 2, z: 3 },
                rotation: { x: 0.1, y: 0.2, z: 0.3 }
            }
        },
        {
            input: {
                transforms: {
                    position: { x: 4, y: "5", z: 6 },
                    rotation: [0.4, "0.5", 0.6]
                }
            },
            expected: {
                translation: { x: 4, y: 5, z: 6 },
                rotation: { x: 0.4, y: 0.5, z: 0.6 }
            }
        },
        {
            input: {
                transform: {
                    position: [7, 8, 9],
                    rotation: { x: 0.7, y: 0.8, z: 0.9 }
                }
            },
            expected: {
                translation: { x: 7, y: 8, z: 9 },
                rotation: { x: 0.7, y: 0.8, z: 0.9 }
            }
        }
    ];

    for (const { input, expected } of fixtures) {
        assert.deepStrictEqual(Transforms.normalize(input), expected);

        SceneStore.parseScene({ models: { model: input } });
        assert.deepStrictEqual(SceneStore.getModel("model").transforms, expected);
        assert.deepStrictEqual(
            SceneStore.getExportData().models.model.transforms,
            expected
        );

        const modelNode = {
            position: { set(x, y, z) { this.value = [x, y, z]; } },
            rotation: { set(x, y, z) { this.value = [x, y, z]; } },
            scale: { set(x, y, z) { this.value = [x, y, z]; } }
        };
        Models._applyCanonicalTransforms(expected, modelNode);
        assert.deepStrictEqual(modelNode.position.value, [
            expected.translation.x,
            expected.translation.y,
            expected.translation.z
        ]);
        assert.deepStrictEqual(modelNode.rotation.value, [
            expected.rotation.x,
            expected.rotation.y,
            expected.rotation.z
        ]);
        assert.deepStrictEqual(modelNode.scale.value, [1, 1, 1]);
    }
});

test("artefact URL aliases, wrappers, unknown fields, and scene export stay canonical", () => {
    const domainFixtures = [
        {
            input: { title: "Canonical", gltf_file: "/canonical.glb" },
            expectedUrl: "/canonical.glb"
        },
        {
            input: { name: "URL", url: "/url.glb" },
            expectedUrl: "/url.glb"
        },
        {
            input: { title: "GLB", glb_file: "/glb.glb" },
            expectedUrl: "/glb.glb"
        },
        {
            input: { title: "Dotted", "artefact.gltf_file": "/dotted.glb" },
            expectedUrl: "/dotted.glb"
        },
        {
            input: {
                artefact_data: {
                    artefact_data: {
                        "artefact.title": "Wrapped",
                        "artefact.glb_file": "/wrapped.glb",
                        custom: { retained: true }
                    }
                }
            },
            expectedUrl: "/wrapped.glb"
        },
        {
            input: { title: "Path", path: "/path.glb", custom: [1, 2] },
            expectedUrl: "/path.glb"
        },
        {
            input: { title: "Source", src: "/src.glb" },
            expectedUrl: "/src.glb"
        },
        {
            input: {
                title: "Conflicting",
                gltf_file: "/canonical.glb",
                glb_file: "/legacy.glb"
            },
            expectedUrl: "/legacy.glb"
        }
    ];

    for (const { input, expectedUrl } of domainFixtures) {
        const normalized = Artefacts.normalize(input);
        assert.strictEqual(normalized.gltf_file, expectedUrl);
    }

    for (const { input, expectedUrl } of domainFixtures) {
        SceneStore.clear();
        Artefacts.parseModelArtefact("model", input);
        assert.strictEqual(Artefacts.getModelURL("model"), expectedUrl);
        assert.strictEqual(
            SceneStore.getExportData().models.model.artefact.gltf_file,
            expectedUrl
        );
    }

    const expectedArtefact = (title, gltfFile, sourceFields) => ({
        title      : title,
        gltf_file  : gltfFile,
        description: "",
        owner      : "",
        keywords   : [],
        copyright  : "",
        ...sourceFields
    });
    const sceneFixtures = [
        {
            input: { name: "URL", url: "/url.glb", custom: { retained: true } },
            expected: expectedArtefact("URL", "/url.glb", {
                name: "URL",
                url: "/url.glb",
                custom: { retained: true }
            })
        },
        {
            input: { title: "GLB", glb_file: "/glb.glb", custom: { retained: true } },
            expected: expectedArtefact("GLB", "", {
                glb_file: "/glb.glb",
                custom: { retained: true }
            })
        },
        {
            input: {
                title: "Dotted",
                "artefact.gltf_file": "/dotted.glb",
                custom: { retained: true }
            },
            expected: expectedArtefact("Dotted", "", {
                "artefact.gltf_file": "/dotted.glb",
                custom: { retained: true }
            })
        },
        {
            input: { title: "Path", path: "/path.glb", custom: { retained: true } },
            expected: expectedArtefact("Path", "/path.glb", {
                path: "/path.glb",
                custom: { retained: true }
            })
        },
        {
            input: { title: "Source", src: "/src.glb", custom: { retained: true } },
            expected: expectedArtefact("Source", "/src.glb", {
                src: "/src.glb",
                custom: { retained: true }
            })
        },
        {
            input: {
                title: "Conflicting",
                gltf_file: "/canonical.glb",
                glb_file: "/legacy.glb",
                custom: { retained: true }
            },
            expected: expectedArtefact("Conflicting", "/canonical.glb", {
                glb_file: "/legacy.glb",
                custom: { retained: true }
            })
        },
        {
            input: {
                artefact_data: {
                    artefact_data: {
                        "artefact.title": "Wrapped",
                        "artefact.glb_file": "/wrapped.glb"
                    }
                },
                custom: { retained: true }
            },
            expected: expectedArtefact("", "", {
                artefact_data: {
                    artefact_data: {
                        "artefact.title": "Wrapped",
                        "artefact.glb_file": "/wrapped.glb"
                    }
                },
                custom: { retained: true }
            })
        }
    ];

    for (const { input, expected } of sceneFixtures) {
        SceneStore.parseScene({ models: { model: { artefact: input } } });
        const exported = SceneStore.getExportData().models.model.artefact;
        const expectedExport = structuredClone(expected);
        delete expectedExport.path;

        assert.deepStrictEqual(
            Artefacts.normalize(input, { preserveSceneInput: true }),
            expected
        );
        assert.deepStrictEqual(exported, expectedExport);
        assert.deepStrictEqual(exported.custom, { retained: true });
    }

    SceneStore.parseScene({ models: { model: { artefact: "invalid" } } });
    assert.deepStrictEqual(
        SceneStore.getExportData().models.model.artefact,
        expectedArtefact("", "", {})
    );
});

test("point normalization preserves mutation, aliases, and model/mesh lookup", () => {
    const modelNode = {
        isMesh: false,
        runtimeScale: 20,
        traverse(callback) {
            callback({ isMesh: true, name: "first-mesh" });
            callback({ isMesh: true, name: "target-mesh" });
        }
    };
    const atonNode = { name: "aton-model" };
    const createdNode = { name: "created-model" };
    Models.modelMap = new Map([["model", modelNode]]);
    THOTH.Utils = { getModelScale: model => model.runtimeScale };
    THOTH.sceneScale = 5;
    ATON.getSceneNode = modelId => modelId === "aton-model" ? atonNode : null;
    ATON.getOrCreateSceneNode = modelId => modelId === "created-model" ? createdNode : null;

    for (const pointApi of [MSR, SemAnnotations]) {
        const mesh = {
            name: "source-mesh",
            parent: { name: "model", type: "SceneNode" }
        };
        const point = {
            mesh,
            x: "1",
            y: 2,
            z: "3",
            face_id: 7,
            custom: { retained: true }
        };
        const normalized = pointApi.normalizePoint(point);

        assert.strictEqual(normalized, point);
        assert.strictEqual(point.mesh, undefined);
        assert.strictEqual(point.meshId, "model");
        assert.strictEqual(point.meshName, "source-mesh");
        assert.deepStrictEqual(point.coords, new Vector3(1, 2, 3));
        assert.strictEqual(point.face_id, 7);
        assert.strictEqual(point.faceId, 7);
        assert.deepStrictEqual(point.custom, { retained: true });
        assert.deepStrictEqual(pointApi.toCanonicalPoint(point), {
            x: 1,
            y: 2,
            z: 3,
            face_id: 7
        });

        const canonical = pointApi.fromCanonicalPoint({
            coords   : { x: "4", y: 5, z: "6" },
            mesh_id : "model",
            mesh_name: "target-mesh",
            faceId  : 8
        }, "fallback-model");
        assert.strictEqual(canonical.meshId, "model");
        assert.strictEqual(canonical.meshName, "target-mesh");
        assert.strictEqual(canonical.faceId, 8);
        assert.deepStrictEqual(canonical.coords, new Vector3(4, 5, 6));

        assert.strictEqual(pointApi.getPointModel({ meshId: "model" }), modelNode);
        assert.strictEqual(
            pointApi.getPointMesh({ meshId: "model", meshName: "target-mesh" }).name,
            "target-mesh"
        );
        assert.strictEqual(
            pointApi.getPointMesh({ meshId: "model" }).name,
            "first-mesh"
        );
        assert.strictEqual(pointApi.getPointMesh({ mesh: mesh }), mesh);
        assert.strictEqual(pointApi.getPointModelId({ meshId: "model" }), "model");
        assert.strictEqual(pointApi.getPointModelId({ mesh: mesh }), "model");
        assert.strictEqual(pointApi.getModelNode("model"), modelNode);
        assert.strictEqual(pointApi.getModelNode("aton-model"), atonNode);
        assert.strictEqual(pointApi.getModelNode("created-model"), null);
        assert.strictEqual(pointApi.getModelNode("created-model", true), createdNode);
        assert.strictEqual(pointApi.getPointMarkerScale({ meshId: "model" }), 0.2);
        assert.strictEqual(pointApi.getPointMarkerScale({ meshId: "missing" }), 0.05);
        const marker = {
            scale: {
                set(x, y, z) {
                    this.value = [x, y, z];
                }
            }
        };
        pointApi.applyPointMarkerScale(marker, { meshId: "model" });
        assert.deepStrictEqual(marker.scale.value, [0.2, 0.2, 0.2]);
    }
});

test("point coordinate conversion preserves transformed-model and identity behavior", () => {
    const transformedModel = {
        updates: 0,
        updateMatrixWorld(force) {
            assert.strictEqual(force, true);
            this.updates += 1;
        },
        worldToLocal(point) {
            point.x -= 10;
            point.y -= 20;
            point.z -= 30;
            return point;
        },
        localToWorld(point) {
            point.x += 10;
            point.y += 20;
            point.z += 30;
            return point;
        }
    };
    Models.modelMap = new Map([["model", transformedModel]]);

    for (const pointApi of [MSR, SemAnnotations]) {
        const world = new Vector3(11, 22, 33);
        const local = pointApi.worldToModelLocal("model", world);
        assert.deepStrictEqual(local, new Vector3(1, 2, 3));
        assert.notStrictEqual(local, world);
        assert.deepStrictEqual(world, new Vector3(11, 22, 33));
        assert.deepStrictEqual(
            pointApi.modelLocalToWorld("model", [1, 2, 3]),
            new Vector3(11, 22, 33)
        );

        const runtimePoint = {
            meshId: "model",
            x: 11,
            y: 22,
            z: 33,
            face_id: 9
        };
        const converted = pointApi.pointWorldToModelLocal(undefined, runtimePoint);
        assert.notStrictEqual(converted, runtimePoint);
        assert.deepStrictEqual(runtimePoint.coords, new Vector3(11, 22, 33));
        assert.strictEqual(runtimePoint.faceId, 9);
        assert.deepStrictEqual(converted.coords, new Vector3(1, 2, 3));

        const orphanCoords = new Vector3(5, 6, 7);
        const orphanResult = pointApi.worldToModelLocal("missing", orphanCoords);
        assert.deepStrictEqual(orphanResult, orphanCoords);
        assert.notStrictEqual(orphanResult, orphanCoords);
    }
    assert.strictEqual(transformedModel.updates, 6);
});

test("hit-derived points preserve measurement and semantic return behavior", () => {
    const transformedModel = {
        updateMatrixWorld() {},
        worldToLocal(point) {
            point.x -= 10;
            point.y -= 20;
            point.z -= 30;
            return point;
        }
    };
    const mesh = {
        name: "hit-mesh",
        parent: { name: "model", type: "SceneNode" }
    };
    Models.modelMap = new Map([["model", transformedModel]]);
    ATON._hitsScene = [{
        object: mesh,
        faceIndex: 12,
        point: new Vector3(11, 22, 33)
    }];
    MSR.points = [];
    MSR.addMeasurementPointSem = () => {};

    assert.strictEqual(MSR.addMeasurementPoint(), undefined);
    assert.deepStrictEqual(MSR.points, [{
        meshId: "model",
        meshName: "hit-mesh",
        faceId: 12,
        coords: new Vector3(1, 2, 3)
    }]);
    assert.deepStrictEqual(SemAnnotations.createPointFromHit(), MSR.points[0]);

    ATON._hitsScene = [];
    assert.strictEqual(MSR.addMeasurementPoint(), undefined);
    assert.strictEqual(SemAnnotations.createPointFromHit(), null);
});

test("measurement and semantic local/legacy exports preserve exact point serialization", () => {
    const transformedModel = {
        updateMatrixWorld() {},
        worldToLocal(point) {
            point.x -= 10;
            point.y -= 20;
            point.z -= 30;
            return point;
        },
        localToWorld(point) {
            point.x += 10;
            point.y += 20;
            point.z += 30;
            return point;
        }
    };
    Models.modelMap = new Map([["model", transformedModel]]);

    const runtimePoint1 = { meshId: "model", x: 1, y: 2, z: 3, face_id: 10 };
    const runtimePoint2 = { meshId: "model", x: 4, y: 5, z: 6, face_id: 11 };
    const runtimeMeasurement = MSR.normalizeMeasurement("runtime-measurement", {
        model_id: "model",
        points: [runtimePoint1, runtimePoint2],
        distance: 5,
        distanceType: "euclidean"
    });
    assert.strictEqual(runtimeMeasurement.points[0], runtimePoint1);
    assert.strictEqual(runtimeMeasurement.points[1], runtimePoint2);
    assert.deepStrictEqual(runtimePoint1.coords, new Vector3(1, 2, 3));
    assert.strictEqual(runtimePoint1.faceId, 10);

    const runtimeSemanticPoint = {
        meshId: "model",
        x: 2,
        y: 3,
        z: 4,
        face_id: 12
    };
    const runtimeSemantic = SemAnnotations.normalizeAnnotation({
        id: "runtime-semantic",
        model_id: "model",
        point: runtimeSemanticPoint
    });
    assert.strictEqual(runtimeSemantic.point, runtimeSemanticPoint);
    assert.deepStrictEqual(runtimeSemanticPoint.coords, new Vector3(2, 3, 4));
    assert.strictEqual(runtimeSemanticPoint.faceId, 12);

    const localMeasurement = MSR.normalizeMeasurement("local-measurement", {
        model_id: "model",
        annotation: {
            coordinate_space: "model_local",
            distance: 5,
            distance_type: "euclidean",
            point1: { x: 1, y: 2, z: 3, face_id: 1 },
            point2: { x: 4, y: 6, z: 3, faceId: 2 }
        }
    });
    const legacyMeasurement = MSR.normalizeMeasurement("legacy-measurement", {
        model_id: "model",
        annotation: {
            coordinate_space: "world",
            distance: 5,
            distance_type: "euclidean",
            point1: { x: 11, y: 22, z: 33, face_id: 3 },
            point2: { x: 14, y: 26, z: 33, face_id: 4 }
        }
    });
    const localSemantic = SemAnnotations.normalizeAnnotation({
        id: "local-semantic",
        model_id: "model",
        annotation: {
            coordinate_space: "model_local",
            point: { x: 2, y: 3, z: 4, face_id: 5 }
        }
    });
    const legacySemantic = SemAnnotations.normalizeAnnotation({
        id: "legacy-semantic",
        model_id: "model",
        annotation: {
            coordinate_space: "world",
            point: { x: 12, y: 23, z: 34, face_id: 6 }
        }
    });

    assert.deepStrictEqual(
        localMeasurement.points.map(point => point.coords),
        [new Vector3(1, 2, 3), new Vector3(4, 6, 3)]
    );
    assert.deepStrictEqual(
        legacyMeasurement.points.map(point => point.coords),
        [new Vector3(1, 2, 3), new Vector3(4, 6, 3)]
    );
    assert.deepStrictEqual(localSemantic.point.coords, new Vector3(2, 3, 4));
    assert.deepStrictEqual(legacySemantic.point.coords, new Vector3(2, 3, 4));

    SceneStore.parseScene({ models: { model: {} } });
    SceneStore.setModelCollectionItem(
        "model",
        "measurements",
        "local-measurement",
        MSR.toCanonicalMeasurement("local-measurement", localMeasurement)
    );
    SceneStore.setModelCollectionItem(
        "model",
        "measurements",
        "legacy-measurement",
        MSR.toCanonicalMeasurement("legacy-measurement", legacyMeasurement)
    );
    SceneStore.setModelCollectionItem(
        "model",
        "semantic_annotations",
        "local-semantic",
        SemAnnotations.toCanonicalAnnotation("local-semantic", localSemantic)
    );
    SceneStore.setModelCollectionItem(
        "model",
        "semantic_annotations",
        "legacy-semantic",
        SemAnnotations.toCanonicalAnnotation("legacy-semantic", legacySemantic)
    );

    const expectedBase = (id, name, annotation) => ({
        id,
        name,
        description: "",
        related_rgb_images: [],
        related_multispectral_images: [],
        related_artefacts: [],
        annotation,
        visible: true
    });
    assert.deepStrictEqual(Annotations.getExportData("model", "measurements"), {
        "local-measurement": expectedBase(
            "local-measurement",
            "Measurement local-measurement",
            {
                coordinate_space: "model_local",
                distance: 5,
                distance_type: "euclidean",
                point1: { x: 1, y: 2, z: 3, face_id: 1 },
                point2: { x: 4, y: 6, z: 3, face_id: 2 }
            }
        ),
        "legacy-measurement": expectedBase(
            "legacy-measurement",
            "Measurement legacy-measurement",
            {
                coordinate_space: "model_local",
                distance: 5,
                distance_type: "euclidean",
                point1: { x: 1, y: 2, z: 3, face_id: 3 },
                point2: { x: 4, y: 6, z: 3, face_id: 4 }
            }
        )
    });
    assert.deepStrictEqual(Annotations.getExportData("model", "semantic_annotations"), {
        "local-semantic": expectedBase(
            "local-semantic",
            "Semantic local-semantic",
            {
                coordinate_space: "model_local",
                point: { x: 2, y: 3, z: 4, face_id: 5 }
            }
        ),
        "legacy-semantic": expectedBase(
            "legacy-semantic",
            "Semantic legacy-semantic",
            {
                coordinate_space: "model_local",
                point: { x: 2, y: 3, z: 4, face_id: 6 }
            }
        )
    });
    assert.deepStrictEqual(SceneStore.getExportData().models.model.annotations, {
        selections: {},
        measurements: Annotations.getExportData("model", "measurements"),
        semantic_annotations: Annotations.getExportData(
            "model",
            "semantic_annotations"
        )
    });
});

test("model parsing does not change canonical store export or transforms", () => {
    SceneStore.parseScene({
        models: {
            model: {
                artefact: {},
                transforms: {
                    translation: { x: 7, y: 8, z: 9 },
                    rotation: { x: 0.7, y: 0.8, z: 0.9 }
                }
            }
        }
    });
    const before = SceneStore.getExportData();
    const modelNode = {
        name: "model",
        position: {
            set(x, y, z) {
                this.value = [x, y, z];
            }
        },
        rotation: {
            set(x, y, z) {
                this.value = [x, y, z];
            }
        },
        scale: {
            set() {}
        },
        removeChildren() {
            return this;
        },
        attachToRoot() {}
    };

    ATON.getOrCreateSceneNode = () => modelNode;
    THOTH.Transforms = {
        normalize: Transforms.normalize,
        parseModelTransform(modelId, value) {
            return SceneStore.setModelField(modelId, "transforms", value);
        },
        getModelTransform(modelId) {
            return structuredClone(SceneStore.getModel(modelId).transforms);
        }
    };
    THOTH.Selections = {
        parseSelections() {},
        getExportData: modelId => structuredClone(
            SceneStore.getModel(modelId).annotations.selections
        )
    };
    THOTH.MSR = {
        parseMeasurements() {},
        getExportData: modelId => structuredClone(
            SceneStore.getModel(modelId).annotations.measurements
        )
    };
    THOTH.SemAnnotations = {
        parseAnnotations() {},
        getExportData: modelId => structuredClone(
            SceneStore.getModel(modelId).annotations.semantic_annotations
        )
    };
    Models.modelMap = new Map();
    Models._hasFocusedInitialScene = false;
    Models._pendingInitialFocusModelId = null;

    Models.parseModels(SceneStore.getScene().models);

    assert.deepStrictEqual(SceneStore.getExportData(), before);
    assert.deepStrictEqual(modelNode.position.value, [7, 8, 9]);
    assert.deepStrictEqual(modelNode.rotation.value, [0.7, 0.8, 0.9]);
});

test("measurement normalization preserves its canonical and runtime fields", () => {
    const canonical = MSR.toCanonicalMeasurement("measurement-1", {
        id: "measurement-1",
        name: "Measurement",
        model_id: "model",
        annotation: {
            coordinate_space: "model_local",
            distance: 5,
            distance_type: "euclidean",
            point1: { x: 1, y: 2, z: 3, face_id: 4 },
            point2: { x: 4, y: 6, z: 3, face_id: 5 }
        }
    });
    const runtime = MSR.normalizeMeasurement("measurement-1", {
        ...canonical,
        model_id: "model"
    });

    assert.deepStrictEqual(runtime, {
        ...canonical,
        distance: 5,
        distanceType: "euclidean",
        points: [
            {
                meshId: "model",
                meshName: undefined,
                faceId: 4,
                coords: new Vector3(1, 2, 3)
            },
            {
                meshId: "model",
                meshName: undefined,
                faceId: 5,
                coords: new Vector3(4, 6, 3)
            }
        ],
        path: undefined,
        trash: false
    });
});

test("exposed clone APIs preserve null, undefined, and deep-copy semantics", () => {
    assert.strictEqual(Annotations.clone(undefined), undefined);
    assert.strictEqual(Annotations.clone(null), null);
    assert.strictEqual(SemAnnotations.cloneAnnotation(undefined), undefined);
    assert.strictEqual(SemAnnotations.cloneAnnotation(null), null);

    const source = { nested: { value: 1 } };
    const cloned = Annotations.clone(source);
    cloned.nested.value = 2;
    assert.strictEqual(source.nested.value, 1);

    const operation = Ops.makeOperation(
        "model.update_metadata",
        { model_id: "model", nested: { value: 1 } },
        undefined,
        null
    );
    assert.strictEqual(operation.value, undefined);
    assert.strictEqual(operation.prev_value, null);
    operation.target.nested.value = 2;
    assert.strictEqual(operation.target.model_id, "model");
});

test("undo and redo preserve stack movement and operation ordering", () => {
    const calls = [];
    THOTH.user = { id: "local-user" };
    THOTH.Ops = {
        invert(operation) {
            return {
                ...structuredClone(operation),
                type: operation.type === "item.create" ? "item.delete" : "item.create"
            };
        },
        apply(operation, options) {
            calls.push({ operation: structuredClone(operation), options });
            return true;
        }
    };
    History.setup();
    const inverse = {
        type: "item.delete",
        target: { item_id: "item" },
        value: null,
        prev_value: { id: "item" },
        user_id: "local-user"
    };
    History.push(inverse);
    inverse.prev_value.id = "mutated";

    History.undo();
    History.redo();

    assert.strictEqual(calls.length, 2);
    assert.deepStrictEqual(calls.map(call => call.operation.type), ["item.delete", "item.create"]);
    assert.deepStrictEqual(calls.map(call => call.options), [
        { pushHistory: false, broadcast: true },
        { pushHistory: false, broadcast: true }
    ]);
    assert.strictEqual(calls[0].operation.prev_value.id, "item");
    assert.strictEqual(History.undoStack.length, 1);
    assert.strictEqual(History.redoStack.length, 0);
});

test("selection face edits clone their source before producing operations", () => {
    Selections.setup();
    const selection = {
        id: "selection",
        model_id: "model",
        annotation: {
            selected_faces: { mesh: [1] },
            selection_color: "#ffffff"
        },
        selection: { mesh: [1] },
        visible: true
    };
    Selections.selectionMap.set("model:selection", selection);
    let appliedOperation;
    THOTH.Ops = {
        makeOperation(type, target, value, prevValue) {
            return { type, target, value, prev_value: prevValue };
        },
        applyLocal(operation) {
            appliedOperation = operation;
            return true;
        }
    };

    Selections.addFaces("model", "selection", "mesh", [2]);

    assert.deepStrictEqual(selection.annotation.selected_faces.mesh, [1]);
    assert.deepStrictEqual(appliedOperation.value.annotation.selected_faces.mesh, [1, 2]);
});

test("relation lists preserve first occurrence, order, empty-ID handling, and shape", () => {
    assert.deepStrictEqual(UI._normalizeImageRelations([
        null,
        " first ",
        { id: "second", name: "Second", image_url: "/second.png" },
        { id: "first", name: "Duplicate" },
        { id: "", name: "ignored" },
        "third",
        "third"
    ]), [
        { id: "first", name: "first", url: "" },
        { id: "second", name: "Second", url: "/second.png" },
        { id: "third", name: "third", url: "" }
    ]);

    assert.deepStrictEqual(UI._normalizeMultispectralImageRelations([
        "multi-1",
        { id: "multi-2", name: "Multi 2", image_url: { "500nm": "/500.png" } },
        { id: "multi-1", urls: { rgb: "/duplicate.png" } },
        { id: "", name: "ignored" }
    ]), [
        { id: "multi-1", name: "multi-1", urls: {} },
        { id: "multi-2", name: "Multi 2", urls: { "500nm": "/500.png" } }
    ]);

    assert.deepStrictEqual(UI._normalizeArtefactRelations([
        { title: "artefact-1", gltf_file: "/one.glb" },
        "artefact-2",
        { id: "artefact-1", url: "/duplicate.glb" },
        { id: "", title: "ignored" }
    ]), [
        { id: "artefact-1", name: "artefact-1", url: "/one.glb" },
        { id: "artefact-2", name: "artefact-2", url: "" }
    ]);

    assert.deepStrictEqual(UI._normalizeImageRelations(null), []);
});

test("vector edits and resets fire once before one update with unchanged value types", () => {
    const positionTrace = [];
    THOTH.fire = (name, payload) => {
        positionTrace.push({ type: "fire", name, payload: structuredClone(payload) });
    };
    const position = UI.createVectorControl({
        vector: { x: 1, y: 2, z: 3 },
        modelName: "model",
        onupdate: () => positionTrace.push({ type: "update" })
    }, "position");

    for (let index = 0; index < 3; ++index) {
        positionTrace.length = 0;
        position.children[index].value = String(index + 4);
        position.children[index].onchange({ type: "change" });

        assert.strictEqual(positionTrace.length, 2);
        assert.strictEqual(positionTrace[0].type, "fire");
        assert.strictEqual(positionTrace[0].name, "modelTransformPos");
        assert.strictEqual(positionTrace[1].type, "update");
        assert.deepStrictEqual(positionTrace[0].payload.value, {
            x: position.children[0].value,
            y: position.children[1].value,
            z: position.children[2].value
        });
    }

    const resetTrace = [];
    THOTH.fire = (name, payload) => {
        resetTrace.push({ type: "fire", name, payload: structuredClone(payload) });
    };
    const rotation = UI.createVectorControl({
        vector: { x: 1, y: 2, z: 3 },
        reset: [0, 0, 0],
        modelName: "model",
        onupdate: () => resetTrace.push({ type: "update" })
    }, "rotation");
    rotation.children[3].onpress();

    assert.deepStrictEqual(resetTrace, [
        {
            type: "fire",
            name: "modelTransformRot",
            payload: {
                modelName: "model",
                value: { x: 0, y: 0, z: 0 }
            }
        },
        { type: "update" }
    ]);
});


for (const { name, callback } of tests) {
    await callback();
    console.log(`ok - ${name}`);
}

console.log(`${tests.length} cleanup regression tests passed`);
