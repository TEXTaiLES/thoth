# Milestone 08 - Frontend And UI Layout

## Goal

Rebuild the THOTH frontend around model-scoped scene structure navigation while keeping existing tool ergonomics.

## Files To Add Or Change

- Update `wapps/thoth/index.html`.
- Update `wapps/thoth/js/res/css/main.css`.
- Refactor `wapps/thoth/js/src/fe.js`.
- Refactor `wapps/thoth/js/src/ui.js`.

## Layout

Top toolbar:

- TEXTaiLES redirect.
- Add model.
- Settings.
- Info.

User toolbar:

- Login/logout.
- Export.

Left toolbar:

- Brush.
- Eraser.
- Lasso.
- No tool.
- Measurement.
- Semantic annotation.
- Undo.
- Redo.

Right toolbar:

- Expandable model tree.
- For each model: artefact, selections, semantic annotations, measurements, transforms, metadata, sensors placeholder.
- Clicking an item opens the corresponding panel or swaps the active right-panel content.

Tool options toolbar:

- Keep existing location and behavior for active tool settings.

## FE Responsibilities

`fe.js` owns:

- Toolbar setup.
- Panel setup.
- Controller registration and update.
- Highlighting active controls.
- Toasts.
- Right-side scene tree rendering.

`fe.js` must not own canonical scene data.

## UI Responsibilities

`ui.js` owns pure DOM/component creation:

- Buttons.
- Bool controls.
- Color pickers.
- Text inputs.
- Text areas.
- Schema selector.
- Metadata editor.
- Annotation controllers.
- Annotation modals.
- Transform controls.
- Scene tree rows.

`ui.js` should not mutate scene state directly except through callbacks passed by callers.

## Auth UI

For unauthenticated users:

- Show read-only data.
- Disable mutating buttons or route them to login prompt.
- Keep export disabled or guarded.

## Acceptance Checks

- Right toolbar appears and is usable on desktop.
- Existing left tool workflow still works.
- Scene tree updates when models or annotations are created/deleted.
- UI text says "Selections" instead of "Layers".
- Modals fit on typical desktop and mobile widths.
- No buttons cause uncaught errors when endpoint URLs are missing.

