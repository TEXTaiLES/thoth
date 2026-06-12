# Milestone 02 - Operations, History, And Collaboration

## Goal

Route all scene mutations through one operation API. Local history stores inverse operations per user. Photon collaboration sends and receives the same operation payloads without adding remote changes to local undo history.

## Files To Add Or Change

- Add `wapps/thoth/js/src/operations.js`.
- Refactor `wapps/thoth/js/src/history.js`.
- Refactor collaboration event wiring in `wapps/thoth/js/src/events.js` and `wapps/thoth/js/src/collab.js`.
- Update `main.js` imports and setup.

## Operation Shape

Use this payload:

```js
{
    type: "model.create",
    target: {
        model_id: "model_id",
        collection: "selections",
        item_id: "selection_id",
        field: "name"
    },
    value: {},
    prev_value: {},
    user_id: "local_user_id",
    timestamp: 0,
    source: "local"
}
```

`source` values:

- `"local"` for user-created operations.
- `"remote"` for Photon operations.
- `"history"` for undo/redo replay.
- `"system"` for parse/import setup that should not enter history.

## Required Operation Types

Model:

- `model.create`
- `model.delete`
- `model.update_artefact`
- `model.update_metadata`
- `model.update_transform`

Annotation collections:

- `selection.create`
- `selection.update`
- `selection.delete`
- `measurement.create`
- `measurement.update`
- `measurement.delete`
- `semantic_annotation.create`
- `semantic_annotation.update`
- `semantic_annotation.delete`

Visibility can be represented as an update with `visible`.

## Operations API

Expose as `THOTH.Ops`.

Operations are in-memory only in this phase. Do not implement a server-side operation log or persistence endpoint.

Required methods:

```js
Ops.setup()
Ops.apply(operation, options = {})
Ops.applyLocal(operation)
Ops.applyRemote(operation)
Ops.invert(operation)
Ops.broadcast(operation)
Ops.makeOperation(type, target, value, prevValue)
```

`applyLocal` should:

- Fill `user_id`, `timestamp`, and `source`.
- Apply to `SceneStore`.
- Update affected feature rendering/UI through module hooks.
- Push inverse to local history.
- Broadcast if collaborative.

`applyRemote` should:

- Set `source` to `"remote"`.
- Apply to `SceneStore`.
- Update affected rendering/UI.
- Not push to local history.
- Not rebroadcast.

## History API

Refactor history to store operations instead of numeric action constants.

Expose:

```js
History.setup()
History.push(inverseOperation)
History.undo()
History.redo()
History.clear()
```

Undo applies an inverse operation with `source: "history"` and stores the inverse of that inverse in redo. Redo mirrors this.

Keep history local per browser user. Do not undo or redo operations whose `user_id` differs from the current local user.

## Collaboration API

Use one Photon event:

```js
"thoth.operation"
```

Payload is the operation object.

Keep `syncScene` only as a join-time fallback. If kept, it should parse canonical scene data through `SceneStore.parseScene`.

Conflict policy:

- Use last-writer-wins by `timestamp`.
- If timestamps are missing, accept the incoming operation.

## Acceptance Checks

- Creating, updating, deleting a model-scoped object goes through `THOTH.Ops.applyLocal`.
- Undo and redo use operation inverses, not old numeric action constants.
- Remote Photon operations mutate the scene but do not appear in local undo.
- Replaying history broadcasts the resulting operation if collaborative.
- Existing keyboard shortcuts `Ctrl+Z` and `Ctrl+Y` still work.

