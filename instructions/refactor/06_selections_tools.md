# Milestone 06 - Selections And Face Tools

## Goal

Replace legacy layers with model-scoped selection annotations while preserving brush, eraser, lasso, and face highlight behavior.

## Files To Add Or Change

- Add or refactor `wapps/thoth/js/src/selections.js`.
- Refactor `wapps/thoth/js/src/toolbox.js`.
- Retire `layers.js` from user-facing behavior.
- Update `events.js`, `fe.js`, and `ui.js` selection paths.

## Selection Shape

Use:

```js
{
    id: "",
    name: "",
    description: "",
    related_rgb_images: [],
    related_multispectral_images: [],
    related_artefacts: [],
    annotation: {
        selected_faces: {
            [mesh_id]: [1, 2, 3]
        },
        selection_color: "#ffffff"
    },
    visible: true
}
```

This is a practical model-scoped version of `scene_structure/model/selection/selection.json`.

Selections are split per model. Do not create one selection object that spans multiple models.

## Layer Migration

Remove the old user-facing layer concept.

Temporary implementation bridge is allowed:

- `THOTH.Layers` may remain as a shim for one milestone if needed.
- The UI must refer to "Selections", not "Layers".
- Export must only emit model-scoped `selections`.

## Tool Behavior

Preserve:

- Brush.
- Eraser.
- Lasso add.
- Lasso delete.
- Holding space pauses tools and enables navigation.
- Selection highlight color.
- Obstructed face and normal-threshold options.

The active selection replaces active layer.

Required selection API:

```js
Selections.setup()
Selections.createSelection(modelId, data = {})
Selections.setActiveSelection(modelId, selectionId)
Selections.addFaces(modelId, selectionId, meshId, faces)
Selections.deleteFaces(modelId, selectionId, meshId, faces)
Selections.clearFaces(modelId, selectionId)
Selections.updateVisibility(modelId, selectionId, visible)
Selections.refreshHighlights(modelId)
Selections.refreshAllHighlights()
```

## UI

Selection controllers should show:

- Name.
- Short face count.
- Visibility button.
- Color swatch.
- Details/edit button.
- Delete button.

## Acceptance Checks

- New selection can be created per model.
- Brush/eraser/lasso modify active selection.
- Highlights update after every modification.
- Undo/redo works for face add/delete operations.
- Export contains selected faces under the owning model.
- No top-level `layers` export remains.

