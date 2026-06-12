# THOTH Refactor Master Plan

## Purpose

Refactor `wapps/thoth` in place into a model-scoped scene-object application. The canonical scene JSON is the structure described in `wapps/thoth/instructions/scene_structure`: a scene owns models, and each model owns artefact, metadata, transforms, selections, measurements, semantic annotations, and sensor placeholders.

The implementation must preserve the working ATON integration and existing visual behavior while replacing the internal API in controlled milestones.

## Global Decisions

- Refactor the existing `wapps/thoth` app in place.
- Do not create or rely on `wapps/thoth_new`.
- Use the new scene structure as canonical immediately.
- Do not implement backward compatibility for old scene shapes unless a small compatibility adapter is trivial and does not complicate the code.
- Do not keep legacy top-level `layers`, `measurements`, or `semantic_annotations` as canonical data.
- Replace annotation layers with model-scoped selection annotations.
- Keep sensors as placeholders only.
- Do not implement backend routes in this phase.
- Add frontend API wrappers that handle missing endpoint URLs gracefully.
- Store annotation relations as lightweight `{ id, name, url }` objects.
- Store transform rotations as Three.js Euler radians.
- Store operations in memory only in this phase.
- Keep local JSON download as the default export path.
- Keep all THOTH modules under `wapps/thoth/js/src`.
- Do not modify ATON internals.

## Development Order

Each milestone should be implemented in a separate Codex session or PR-sized change. Do not skip ahead unless the previous milestone is already merged and manually checked.

1. `01_scene_model_and_store.md`
2. `02_operations_history_collab.md`
3. `03_auth_and_api_client.md`
4. `04_artefacts_metadata_transforms.md`
5. `05_annotations_common_api.md`
6. `06_selections_tools.md`
7. `07_measurements_semantic_annotations.md`
8. `08_frontend_ui_layout.md`
9. `09_cleanup_acceptance.md`

Before starting implementation, review `clarifications.md`. It has been resolved; treat its answers as final unless the user explicitly edits them again.

## Canonical Runtime Shape

Use this model-scoped shape as the source of truth:

```js
{
    models: {
        [model_id]: {
            id: "model_id",
            artefact: {},
            metadata: {
                schema: {},
                attributes: {}
            },
            transforms: {
                translation: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                scale: { x: 1, y: 1, z: 1 }
            },
            selections: {},
            measurements: {},
            semantic_annotations: {},
            sensors: []
        }
    }
}
```

Runtime-only data such as Three/ATON nodes, UI elements, soft-delete flags, geodesic caches, and active tool state must not be exported.

## Compatibility Policy

New scene JSON is canonical. Do not implement old-scene compatibility by default. A tiny legacy adapter is acceptable only if it does not add meaningful branching or slow down the refactor. Export must always write model-scoped data only.

## Agent Rules

- Keep changes small and local to the milestone.
- Prefer adapters over large rewrites while behavior is still shared with old modules.
- Preserve visual behavior before improving UI.
- Use operation-based mutations once `operations.js` exists.
- Do not introduce dependencies unless required.
- Run at least syntax/static checks relevant to edited files.
- Document any skipped acceptance checks in the final response for that milestone.

## Final Acceptance

The refactor is complete when:

- A new scene loads from `models`.
- Models, artefacts, metadata, transforms, selections, measurements, and semantic annotations are model-scoped.
- Export emits only the canonical model-scoped scene shape.
- Undo/redo works per local user.
- Remote Photon operations apply without entering local undo history.
- Unauthenticated users cannot mutate scene state or export.
- Missing endpoint URLs fail with clear UI messages.
- The right-side scene structure UI is the primary object navigation surface.

