# Milestone 04 - Artefacts, Metadata, And Transforms

## Goal

Move artefact details, metadata, and transforms into model-scoped scene records. Preserve current model loading and transform gizmo behavior.

## Files To Add Or Change

- Add `wapps/thoth/js/src/artefacts.js`.
- Add `wapps/thoth/js/src/transforms.js`.
- Refactor `wapps/thoth/js/src/metadata.js`.
- Refactor relevant model transform code out of `models.js`.
- Update `main.js` setup/imports.

## Artefacts

Expose as `THOTH.Artefacts`.

Responsibilities:

- Parse artefact data from each model record.
- Provide read-only artefact display helpers.
- Retrieve artefact details through `THOTH.API` when configured.
- Export artefact data from `SceneStore`.

Do not allow direct user editing of artefact core fields in this phase.

Target structure:

```js
{
    title: "",
    gltf_file: "",
    description: "",
    owner: "",
    keywords: [],
    copyright: ""
}
```

## Metadata

Metadata is model-scoped:

```js
model.metadata = {
    schema: {
        name: "",
        version: "",
        description: "",
        url: ""
    },
    attributes: {}
}
```

Keep dynamic schema parsing from the existing metadata implementation, including grouped schemas and basic field types.

Required behavior:

- Load schema list from configured endpoints first.
- Fall back to existing local schema JSON when endpoints are missing or fail.
- Default to `puc_schema`.
- Generate metadata editor from schema.
- Save metadata through an operation: `model.update_metadata`.
- Export only model-scoped metadata.

## Transforms

Move transform management into `THOTH.Transforms`.

Required methods:

```js
Transforms.setup()
Transforms.parseModelTransform(modelId, data)
Transforms.getModelTransform(modelId)
Transforms.applyModelTransform(modelId, transform)
Transforms.attachGizmo(modelId)
Transforms.detachGizmo()
Transforms.getExportData(modelId)
```

Use radians for Euler rotation.

Transform changes must flow through `THOTH.Ops.applyLocal` after milestone 02 exists.

## Models Integration

`models.js` should focus on:

- Loading model resources.
- Maintaining ATON scene node references.
- Mesh lookup utilities.
- Model visibility.

It should not own canonical artefact, metadata, or transform data after this milestone.

## Acceptance Checks

- Loading a model creates a `SceneStore` model record.
- Metadata edits update `SceneStore.models[modelId].metadata`.
- Transform UI and gizmo update model transforms and history.
- Export includes `artefact`, `metadata`, and `transforms` under each model.
- No top-level `sceneMetadata` export remains.

