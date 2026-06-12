# THOTH Refactor Clarifications

Use this file to record the resolved implementation decisions for the refactor. These answers are final unless the user explicitly edits them again.

## 1. Server response shapes

**Question:** What exact response shape should artefact, RGB image, multispectral image, and related artefact search endpoints return?

**Answer:** Each endpoint returns an array of objects with at least `{ id, name, url }`. Extra fields are preserved.

## 2. Canonical collection format

**Question:** Should canonical scene JSON use object maps keyed by id or arrays with explicit `id` fields?

**Answer:** Use object maps keyed by id for models and annotation collections.

## 3. Legacy scene loading

**Question:** Should old scenes with `scenegraph`, `layers`, top-level `measurements`, and top-level `semantic_annotations` still load during the transition?

**Answer:** No backward compatibility is necessary. If it complicates the code, do not include it.

## 4. Measurement geodesic paths

**Question:** Should geodesic paths be persisted in scene JSON, recomputed on load, or treated as runtime cache?

**Answer:** Treat geodesic paths as runtime cache unless preserving them is required for performance.

## 5. Point references

**Question:** Should measurement and semantic annotation points persist `mesh_id`, `mesh_name`, and `face_id` in addition to `{ x, y, z }`?

**Answer:** Keep only the `face_id` of the face where each point was raycasted. Since the measurements are now per-model, `mesh_name` and `mesh_id` are unnecessary. Do not allow measurements between different models.

## 6. Unauthenticated UI

**Question:** Should unauthenticated mutating controls be hidden, disabled, or visible but guarded with login prompts?

**Answer:** Keep controls visible but disabled or guarded with clear login prompts.

## 7. Delete behavior

**Question:** Should deletes be hard deletes in runtime, soft deletes in runtime, or hard deletes only at export?

**Answer:** Use soft deletes in runtime for undo/redo, and omit deleted items from export.

## 8. Collaboration conflict policy

**Question:** How should concurrent edits to the same object be resolved?

**Answer:** Last-writer-wins by operation timestamp. If no timestamp exists, accept the incoming operation.

## 9. Transform units

**Question:** Should transforms store rotation as Euler radians, degrees, quaternions, or ATON-native arrays?

**Answer:** Store Euler radians using `{ x, y, z }`, matching Three.js object rotation.

## 10. Selection ownership

**Question:** If a selection spans multiple models, should it be split into one selection per model or stored scene-globally?

**Answer:** Split selections per model because the canonical structure is model-scoped.

## 11. Selection color

**Question:** Should each selection own one color, or should color be controlled by UI/runtime only?

**Answer:** Persist `selection_color` per selection.

## 12. Annotation relations

**Question:** Should related artefacts/images store full objects, IDs only, or both?

**Answer:** Store lightweight objects `{ id, name, url }` so the UI remains useful without refetching.

## 13. Metadata schema source

**Question:** Should metadata schemas come from configured endpoints, local JSON files, or both?

**Answer:** Try configured endpoints first; fall back to existing local schema JSON.

## 14. Export destination

**Question:** Should export remain local JSON download, send to Hestia, patch the ATON scene endpoint, or support multiple modes?

**Answer:** Keep local JSON download as the reliable default; API submission remains guarded by configured endpoints.

## 15. Sensors

**Question:** Should sensors remain omitted entirely, appear as empty placeholders, or preserve existing sensor dashboard behavior?

**Answer:** Keep sensors as model-scoped empty placeholders and do not refactor sensor dashboard behavior now.

## 16. Naming

**Question:** Should UI labels use "Selections" everywhere, or preserve "Layers" where users may already understand it?

**Answer:** Use "Selections" everywhere user-facing.

## 17. Operation persistence

**Question:** Should operations be persisted to the server as a log, or only applied to in-memory state and exported scene JSON?

**Answer:** Operations are in-memory only in this phase.

## 18. Agent workflow

**Question:** After this file is answered, should Codex regenerate all numbered milestone files or only update files affected by changed answers?

**Answer:** Regenerate all numbered milestone files so they remain self-contained and consistent.

