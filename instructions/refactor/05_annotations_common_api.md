# Milestone 05 - Shared Annotation API

## Goal

Create a shared annotation API for selections, measurements, and semantic annotations. The modality-specific modules should only handle geometry/tool specifics.

## Files To Add Or Change

- Add `wapps/thoth/js/src/annotations.js`.
- Refactor `selections.js`, `measurements.js`, and `semantic_annotations.js` after this API exists.
- Update UI helper calls to use shared annotation fields.

## Shared Annotation Shape

All annotation modalities share:

```js
{
    id: "",
    name: "",
    description: "",
    related_rgb_images: [],
    related_multispectral_images: [],
    related_artefacts: [],
    annotation: {},
    visible: true
}
```

Runtime-only fields such as `trash`, node handles, and caches are allowed but must not export.

## API

Expose as `THOTH.Annotations`.

Required methods:

```js
Annotations.setup()
Annotations.createBaseAnnotation(id, data = {})
Annotations.normalize(annotation)
Annotations.clone(annotation)
Annotations.getCollection(modelId, modality)
Annotations.get(modelId, modality, annotationId)
Annotations.create(modelId, modality, annotation)
Annotations.update(modelId, modality, annotationId, data)
Annotations.delete(modelId, modality, annotationId)
Annotations.setVisible(modelId, modality, annotationId, visible)
Annotations.getExportData(modelId, modality)
```

Modality names:

- `"selections"`
- `"measurements"`
- `"semantic_annotations"`

## Relation Fields

Related images and artefacts are arrays. Until backend endpoints are defined, UI can store manually selected or placeholder objects but must not assume server response shape.

Recommended placeholder shape:

```js
{
    id: "",
    name: "",
    url: ""
}
```

Use this lightweight relation object shape as the persisted representation unless a future backend contract requires IDs only.

## Operation Integration

All create/update/delete/visibility changes should use operation types from milestone 02.

The shared API may expose low-level mutation helpers, but user-triggered changes must flow through `THOTH.Ops.applyLocal`.

## UI Integration

Shared annotation modals should edit:

- Name.
- Description.
- Related RGB images.
- Related multispectral images.
- Related artefacts.
- Visibility if appropriate.

Modality-specific modals may add read-only geometry details.

## Acceptance Checks

- A base annotation can be created for any modality.
- Shared fields serialize identically across modalities.
- Visibility toggles update data and rendering.
- Deleted annotations do not export.
- Modality modules no longer duplicate name/description/relation logic.

