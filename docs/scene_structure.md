# THOTH scene structure

This document describes the canonical scene JSON parsed and exported by THOTH. It is a reference for developers and is not itself consumed by the application.

The examples use TypeScript-like notation: `Record<string, T>` means an object keyed by an ID, `T[]` means an array, and `?` marks an optional field. Coordinates and rotations are stored in model-local space; rotations are in radians.

<details open>
<summary><strong>Scene overview</strong></summary>

```text
Scene
├── models: Record<modelId, Model>
│   └── Model
│       ├── id
│       ├── artefact
│       ├── metadata
│       ├── transforms
│       ├── annotations
│       │   ├── selections: Record<selectionId, Selection>
│       │   ├── measurements: Record<measurementId, Measurement>
│       │   └── semantic_annotations: Record<annotationId, SemanticAnnotation>
│       └── sensors: Sensor[]
└── collaborative: boolean
```

Canonical top-level shape:

```ts
{
  title?: string,
  models: Record<string, Model>,
  collaborative: boolean
}
```

`models` is an object keyed by model ID, not an array. An empty scene is `{ "models": {}, "collaborative": false }`.
`title` is optional presentation metadata. THOTH preserves it when loading and
exporting a scene so scene-management pages can display a user-facing name.

</details>

<details>
<summary><strong>Model</strong></summary>

```ts
type Model = {
  id: string,
  artefact: Artefact,
  metadata: Metadata,
  transforms: Transforms,
  annotations: Annotations,
  sensors: Sensor[]
}
```

The key in `Scene.models` is the authoritative model ID. THOTH also writes that value to the model's `id` field during normalization and export.

Deleted models are marked internally with `trash: true`; trashed models and other runtime-only fields are omitted from export.

<details>
<summary><strong>Artefact</strong></summary>

```ts
type Artefact = {
  title: string,
  gltf_file: string,
  description: string,
  owner: string,
  keywords: string[],
  copyright: string,
  // Additional source fields may be retained.
  [additionalField: string]: unknown
}
```

`gltf_file` is the canonical model URL field despite the fact that it may point to either a `.gltf` or `.glb` resource.

For compatibility, the parser also accepts `glb_file`, `artefact.gltf_file`, `url`, `path`, or `src` as the model URL, and `name` as the title. Export uses the canonical fields above.

</details>

<details>
<summary><strong>Metadata</strong></summary>

```ts
type Metadata = {
  schema: {
    name: string,
    version: string | number,
    description: string,
    url: string
  },
  attributes: Record<string, unknown>
}
```

`attributes` contains values structured according to the schema named by `schema.name`. The PUC schema is intentionally not reproduced here; its runtime copy is `js/res/schema/puc_schema.json`.

Legacy metadata may be supplied as a flat attributes object with an optional `schemaName`. THOTH normalizes it to the canonical `{ schema, attributes }` form. A non-empty legacy object without a schema name defaults to `puc_schema`.

</details>

<details>
<summary><strong>Transforms</strong></summary>

```ts
type Vector3 = {
  x: number,
  y: number,
  z: number
}

type Transforms = {
  translation: Vector3,
  rotation: Vector3
}
```

Defaults:

- `translation`: `{ x: 0, y: 0, z: 0 }`
- `rotation`: `{ x: 0, y: 0, z: 0 }`

The parser also accepts vectors as `[x, y, z]`, `position` as an alias for `translation`, and the legacy singular `transform` container.

Scale is deliberately not part of the canonical scene format. THOTH forces model scale to `{ x: 1, y: 1, z: 1 }` while loading and editing.

</details>

<details>
<summary><strong>Sensors</strong></summary>

```ts
type Sensor = unknown
type Sensors = Sensor[]
```

The scene parser currently treats `sensors` as an opaque array and preserves its entries. It does not validate or otherwise interpret their internal shape.

For sensorial API export, THOTH uses the first entry. A sensor ID may be stored as a primitive value or in an object under `related_sensor_id`, `sensor_id`, or `id`; `latest_reading` is treated as an object and defaults to `{}`.

</details>

</details>

<details>
<summary><strong>Annotations</strong></summary>

```ts
type Annotations = {
  selections: Record<string, Selection>,
  measurements: Record<string, Measurement>,
  semantic_annotations: Record<string, SemanticAnnotation>
}
```

Each collection is an object keyed by annotation ID, not an array. THOTH accepts the three collections directly on a model as a legacy input form, but exports them under `model.annotations`.

<details>
<summary><strong>Fields shared by all annotations</strong></summary>

```ts
type BaseAnnotation = {
  id: string,
  name: string,
  description: string,
  related_rgb_images: Relation[],
  related_multispectral_images: Relation[],
  related_artefacts: Relation[],
  annotation: Record<string, unknown>,
  visible: boolean
}

type Relation = {
  id: string,
  name: string,
  url: string,
  [additionalField: string]: unknown
}
```

Relations retain additional fields. This permits multispectral relations, for example, to include an additional `urls: Record<string, string>` map for wavelength-specific resources.

When normalizing legacy relations, THOTH derives missing canonical fields from aliases such as `title`, `image_name`, `image_url`, `gltf_file`, `path`, and `src`. Primitive relation values are also accepted and become their own `id` and `name`.

The `id` inside an annotation normally matches its collection key. `visible` defaults to `true`.

</details>

<details>
<summary><strong>Selection</strong></summary>

```ts
type Selection = BaseAnnotation & {
  annotation: {
    selected_faces: Record<string, string>,
    selection_color: string
  }
}
```

`selected_faces` is keyed by mesh ID. On export, each value is a comma-separated face list with inclusive ranges, for example:

```json
{
  "mesh_0": "1-3,8,11-14",
  "mesh_1": "4,9"
}
```

The parser also accepts an iterable/array of non-negative integer face IDs for each mesh. It accepts the legacy top-level fields `selected_faces`, `selection`, `selection_color`, and `highlightColor`, but export nests the canonical fields inside `annotation`.

`selection_color` is a hexadecimal color string such as `"#ff8800"`.

</details>

<details>
<summary><strong>Measurement</strong></summary>

```ts
type Measurement = BaseAnnotation & {
  annotation: {
    coordinate_space: "model_local",
    distance: number,
    distance_type: string,
    point1: ScenePoint,
    point2: ScenePoint
  }
}
```

`distance_type` defaults to `"euclidean"`; THOTH also writes `"geodesic"` and
`"geodesicExact"` for approximate and exact surface paths. Canonical export
always writes `coordinate_space: "model_local"`.

THOTH also accepts runtime or legacy forms using top-level `distance`, `distance_type`, `distanceType`, `point1`, `point2`, or `points`. An older annotation without `coordinate_space: "model_local"` is interpreted as using world-space points and converted during normalization.

</details>

<details>
<summary><strong>Semantic annotation</strong></summary>

```ts
type SemanticAnnotation = BaseAnnotation & {
  annotation: {
    coordinate_space: "model_local",
    point: ScenePoint
  }
}
```

Canonical export always writes `coordinate_space: "model_local"`. THOTH also accepts a legacy top-level `point`; an older nested point without the canonical coordinate-space marker is interpreted as world-space and converted during normalization.

</details>

<details>
<summary><strong>Scene point</strong></summary>

```ts
type ScenePoint = {
  x: number,
  y: number,
  z: number,
  face_id: number | null
}
```

The canonical representation uses `face_id`. Runtime and legacy parsing also recognizes `faceId`, `meshId`/`mesh_id`, `meshName`/`mesh_name`, and a nested `coords` vector. Mesh identifiers help the runtime resolve geometry but are not written into the canonical point on export.

</details>

</details>

<details>
<summary><strong>Canonical example</strong></summary>

```json
{
  "models": {
    "textile_01": {
      "id": "textile_01",
      "artefact": {
        "title": "Textile 01",
        "gltf_file": "models/textile_01.glb",
        "description": "",
        "owner": "",
        "keywords": [],
        "copyright": ""
      },
      "metadata": {
        "schema": {
          "name": "puc_schema",
          "version": 1,
          "description": "Dedicated TEXTaiLES schema",
          "url": ""
        },
        "attributes": {}
      },
      "transforms": {
        "translation": { "x": 0, "y": 0, "z": 0 },
        "rotation": { "x": 0, "y": 0, "z": 0 }
      },
      "annotations": {
        "selections": {
          "selection_1": {
            "id": "selection_1",
            "name": "Example selection",
            "description": "",
            "related_rgb_images": [],
            "related_multispectral_images": [],
            "related_artefacts": [],
            "annotation": {
              "selected_faces": {
                "mesh_0": "1-3,8"
              },
              "selection_color": "#ff8800"
            },
            "visible": true
          }
        },
        "measurements": {},
        "semantic_annotations": {}
      },
      "sensors": []
    }
  },
  "collaborative": false
}
```

</details>

<details>
<summary><strong>Parser and export notes</strong></summary>

- Canonical parsing starts at `models`; `collaborative` is parsed separately as a top-level scene property.
- Missing model fields are normalized to empty canonical values.
- Runtime-only state such as `trash`, Three.js nodes, cached paths, materials, and model-local helper fields is not exported.
- Trashed models and annotations are excluded from exported scene JSON.
- Extra artefact, relation, annotation-payload, and sensor fields may survive normalization; consumers should not assume those objects contain only the fields listed here.

</details>
