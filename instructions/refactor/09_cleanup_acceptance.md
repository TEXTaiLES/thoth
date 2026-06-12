# Milestone 09 - Cleanup And Final Acceptance

## Goal

Remove obsolete legacy APIs, verify canonical export, and run full manual acceptance.

## Cleanup Targets

Remove or retire:

- Top-level `layers` export.
- Top-level `measurements` export.
- Top-level `semantic_annotations` export.
- Top-level `sceneMetadata` export.
- Numeric history action constants.
- Direct feature mutations that bypass `THOTH.Ops`.
- User-facing "Layer" naming.
- Any temporary legacy scene conversion unless it is isolated, trivial, and still needed for local development.

Keep compatibility shims only if they are explicitly documented and not used by current UI.

## Static Review Checklist

Search for and resolve unexpected active references to:

```txt
THOTH.Layers
layerMap
activeLayer
parseLayers
sem_annotations
History.ACTIONS
firePhoton("createMeasurement"
firePhoton("addToSelection"
sceneMetadata
```

Some references may remain in comments or compatibility code, but they must not be part of canonical runtime behavior.

## Manual Acceptance

Run these scenarios:

1. Load a scene with multiple models.
2. Open the right scene tree and inspect each model.
3. Add a model while authenticated.
4. Edit model metadata and export.
5. Transform a model with input fields and gizmo.
6. Create a selection, add faces with brush, remove faces with eraser, use lasso add/delete.
7. Toggle selection visibility and delete selection.
8. Create an euclidean measurement.
9. Create a geodesic measurement where applicable.
10. Toggle and delete measurements.
11. Create and edit a semantic annotation.
12. Click a semantic marker to open its modal.
13. Undo and redo each mutation type.
14. Join with a collaborative second client and confirm remote changes apply.
15. Confirm remote changes do not enter local undo.
16. Export and verify only canonical `models` data exists.
17. Verify unauthenticated users cannot mutate or export.
18. Verify missing endpoints show clear messages.

## Automated Checks

Add tests if a local test setup exists. If not, create lightweight browser-independent test files only when they can run without major tooling changes.

Recommended test coverage:

- Scene store parse/export.
- Operation inversion.
- API wrapper missing endpoint behavior.
- Annotation normalization.
- Import/export round trip.

## Final Documentation

Update:

- `wapps/thoth/instructions/refactor/00_master_plan.md` with any changed decisions.
- `wapps/thoth/instructions/refactor/clarifications.md` with resolved answers.
- Project README only if user-facing setup or scene JSON format changed enough to matter.

## Completion Criteria

The refactor is complete only when the app is usable end-to-end with the model-scoped scene structure and no legacy top-level annotation data is emitted on export.

