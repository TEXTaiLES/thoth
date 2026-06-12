# Milestone 03 - Auth And API Client

## Goal

Add a frontend API layer and central auth guard. Mutating app features must require authentication, while missing future endpoint URLs must fail gracefully.

## Files To Add Or Change

- Add `wapps/thoth/js/src/api_client.js`.
- Add `wapps/thoth/js/src/auth.js` if the logic becomes large enough; otherwise keep auth helpers in `main.js`.
- Update `main.js`, `ui.js`, `fe.js`, and mutation event paths to use auth checks.

## API Client

Expose as `THOTH.API`.

Required methods:

```js
API.setup(config)
API.hasEndpoint(name)
API.getEndpoint(name)
API.get(name, params = {})
API.post(name, body = {})
API.put(name, body = {})
API.delete(name, body = {})
API.withAuth(callback, options = {})
```

Endpoint names should be stable even if URLs are not configured yet:

- `artefacts`
- `artefact`
- `metadata`
- `metadata_schema_list`
- `metadata_schema`
- `rgb_images`
- `multispectral_images`
- `related_artefacts`
- `scene_export`
- `model_import`

If an endpoint URL is undefined:

- Return a rejected promise or `{ ok: false, error }`.
- Show a short toast for user-triggered actions.
- Do not throw uncaught exceptions.

Configured endpoint responses are assumed to be arrays of lightweight objects with at least `{ id, name, url }`. Preserve any additional fields returned by the server.

## Auth Guard

Use native `ATON.checkAuth`.

Expose:

```js
THOTH.requireAuth(actionName, onAllowed)
THOTH.isAuthenticated()
THOTH.setAuthState(user)
```

If unauthenticated:

- Do not perform the mutation.
- Keep controls visible, but disable them or guard them with a clear login prompt/toast.
- Keep view-only controls available.

## Locked Features

Require auth for:

- Importing models.
- Exporting changes.
- Creating/updating/deleting selections.
- Creating/updating/deleting measurements.
- Creating/updating/deleting semantic annotations.
- Editing metadata.
- Editing transforms.
- Editing artefact-linked fields if added later.

Read-only display remains available without auth.

## Login And Logout

Login should unlock controls after user data is available.

Logout should:

- Show a warning that the page will reload.
- Call `ATON.REQ.logout`.
- Reload the page after logout completes.

## Acceptance Checks

- Unauthenticated users can load and inspect a scene.
- Unauthenticated users cannot mutate scene data or export.
- Authenticated users can use mutating controls.
- Missing endpoint URLs produce clear no-op failures.
- Existing user button behavior continues to work.

