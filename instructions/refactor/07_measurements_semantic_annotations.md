# Milestone 07 - Measurements And Semantic Annotations

## Goal

Move measurements and semantic annotations onto the shared annotation API and store them under their owning model.

## Files To Add Or Change

- Refactor `wapps/thoth/js/src/measurements.js`.
- Add `wapps/thoth/js/src/semantic_annotations.js`.
- Replace imports from `sem_annotations.js`.
- Keep `measurements.label.js` if it remains useful.
- Update `events.js`, `fe.js`, and `ui.js`.

## Measurement Shape

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
        distance: 0,
        distance_type: "euclidean",
        point1: {
            x: 0,
            y: 0,
            z: 0,
            face_id: null
        },
        point2: {
            x: 0,
            y: 0,
            z: 0,
            face_id: null
        }
    },
    visible: true
}
```

Treat geodesic path data as runtime cache unless performance later requires persistence.

## Semantic Annotation Shape

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
        point: {
            x: 0,
            y: 0,
            z: 0,
            face_id: null
        }
    },
    visible: true
}
```

## Ownership

Determine owning model from the hit mesh using existing model parent lookup at creation time. Store the annotation under that model, but do not persist `mesh_id` or `mesh_name` in the annotation point.

Do not allow a measurement between different models. If point 1 and point 2 resolve to different owning models, discard the second point or reject creation with a toast.

## Visual Behavior

Preserve:

- Measurement endpoint markers.
- Measurement line rendering.
- Euclidean distance calculation.
- Geodesic distance calculation where already implemented.
- Floating measurement labels.
- Semantic annotation spherical marker.
- Floating semantic annotation label.
- Clicking semantic marker opens edit modal.

## UI

Measurement controllers should show:

- Name.
- Distance value and distance type.
- Visibility.
- Details/edit.
- Delete.

Semantic annotation controllers should show:

- Name.
- Point/model hint.
- Visibility.
- Details/edit.
- Delete.

## Acceptance Checks

- Measurement create/edit/delete/visibility works under a model.
- Semantic annotation create/edit/delete/visibility works under a model.
- Undo/redo works for both modalities.
- Remote collaboration operations apply for both modalities.
- Export contains model-scoped `measurements` and `semantic_annotations`.
- No top-level measurement or semantic annotation export remains.

