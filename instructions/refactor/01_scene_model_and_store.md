# Milestone 01 - Scene Model And Store

## Goal

Create a central scene store that becomes the only canonical runtime owner of model-scoped scene data. This milestone should not refactor every feature yet; it should establish the new data boundary and export shape.

## Files To Add Or Change

- Add `wapps/thoth/js/src/scene_store.js`.
- Update `wapps/thoth/js/main.js` to import and initialize the store.
- Update model parsing/export wiring enough to populate `SceneStore.models`.

## Public API

Expose the module as `THOTH.SceneStore`.

Required methods:

```js
SceneStore.setup()
SceneStore.clear()
SceneStore.parseScene(data)
SceneStore.getScene()
SceneStore.getExportData()
SceneStore.ensureModel(modelId, data = {})
SceneStore.getModel(modelId)
SceneStore.deleteModel(modelId)
SceneStore.setModelField(modelId, fieldName, value)
SceneStore.getModelCollection(modelId, collectionName)
SceneStore.setModelCollectionItem(modelId, collectionName, itemId, value)
SceneStore.deleteModelCollectionItem(modelId, collectionName, itemId)
```

Collection names are:

```js
"selections"
"measurements"
"semantic_annotations"
"sensors"
```

## Canonical Shape

Each model record must include:

```js
{
    id,
    artefact,
    metadata,
    transforms,
    selections,
    measurements,
    semantic_annotations,
    sensors
}
```

Default missing object fields to empty objects and `sensors` to an empty array. Default transforms to translation `{0,0,0}`, rotation `{0,0,0}`, and scale `{1,1,1}`.

## Import Behavior

Implement new-shape parsing:

```js
{
    models: {
        [model_id]: { ... }
    }
}
```

Do not implement legacy scene conversion by default. The old shapes using `scenegraph`, `layers`, top-level `measurements`, and top-level `semantic_annotations` are not required to load.

A minimal `scenegraph.nodes` adapter is acceptable only if it is needed to keep existing local test scenes rendering and it stays isolated in `SceneStore.parseScene`. Do not add complex conversion for old annotations or layers.

## Export Behavior

`THOTH.getExportData()` must return:

```js
{
    models: THOTH.SceneStore.getExportData().models
}
```

Do not include legacy top-level keys in export:

- `scenegraph`
- `layers`
- `measurements`
- `semantic_annotations`
- `sceneMetadata`

During this milestone, old feature modules may still maintain their own maps, but export must be sourced from `SceneStore`.

## Runtime Data Policy

Do not export:

- `trash`
- `visible_node`
- `ui_node`
- `three_node`
- `mesh`
- `material`
- `path_cache`
- `mesh_cache`
- temporary tool selections

Normalize Three vectors into plain `{ x, y, z }` objects before storing/exporting.

## Acceptance Checks

- Loading a new-shape scene populates `THOTH.SceneStore.getScene().models`.
- Calling `THOTH.getExportData()` returns a `models` object and no legacy top-level keys.
- Adding a model through the current model path calls `SceneStore.ensureModel`.
- Deleting a model removes or marks only that model in the store without breaking existing UI.
- New-shape scene loading reaches the point where models render.

