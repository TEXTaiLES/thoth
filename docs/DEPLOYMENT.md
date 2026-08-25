# THOTH Deployment Guide

THOTH supports native ATON, local Docker, and Docker connected to HESTIA. Native ATON and local Docker use ATON's API and username/password authentication. HESTIA mode uses the HESTIA API and offers independent EGI and HESTIA Portal sessions.

## Requirements

- Node.js for native deployment. Exact geodesic measurements additionally
  require Python, a C++17 compiler, and the platform build tools used by
  `node-gyp`.
- Docker with the Compose plugin for container deployments.
- THOTH checked out as `wapps/thoth` inside an ATON checkout for native deployment.
- A running HESTIA/Directus stack and EGI client registration for HESTIA mode.

The Docker image uses the verified ATON commit `5a7582d7c92d44066f50feddcb3576ed1027d32e` (ATON `3.0.3-18-g5a7582d7`, 2026-08-24). Native deployments should use that commit as well.

## ATON source boundary and CORS

THOTH does not modify the host ATON checkout automatically. Native ATON and local Docker use ATON's existing API, authentication, and static routes without loading any HESTIA code. The THOTH gateway extension also owns the same-origin exact-geodesic routes in every deployment mode.

HESTIA mode avoids browser CORS requests with a same-origin `/hestia` gateway owned entirely by THOTH. The browser calls THOTH, and THOTH authenticates the user, injects the service credential, and forwards the allow-listed request to HESTIA.

During a Docker build, THOTH shallow-fetches the pinned ATON commit into the image and verifies the exact checkout. Then `server/deployment/install-gateway.cjs` adds one loader line to that private image copy. The gateway implementation remains under `server/deployment/gateway-extension.js` in THOTH. No host ATON file is mounted or edited.

The installer requires an explicit target path and is not run by `npm start`. A maintainer enabling exact geodesic measurements in a non-Docker ATON checkout must run it manually from the ATON root:

```sh
node wapps/thoth/server/deployment/install-gateway.cjs services/ATON.service.main.js
```

That manual operation adds one idempotent loader line to the supplied ATON file. It is required only for exact geodesic measurements in native ATON; both Docker modes install the loader in their private image copy automatically.

## Configuration selection

Both browser configurations live under `config/`:

- `local.json` uses ATON authentication and API fallbacks.
- `hestia.json` uses THOTH authentication and same-origin HESTIA API routes.
- `deployment.json` is the selector and defaults to `local.json`.

The browser first loads `/a/thoth/config/deployment.json`, validates its `mode` and `source`, and then loads the selected file. Native ATON and local Docker receive the committed local selector through ATON's static-file handler.

In HESTIA Docker mode, THOTH's gateway handles that selector URL before ATON's static handler and returns `mode: hestia`, `source: hestia.json`, and non-secret runtime values such as the public API and Portal URLs. The browser merges those public values into `hestia.json`. Secrets are never part of the selector or either browser configuration.

## Native ATON

From the ATON repository root, install ATON and build THOTH's exact-geodesic addon:

```sh
npm install
cd wapps/thoth/geodesic/geodesic_addon
npm ci
cd ../../../..
node wapps/thoth/server/deployment/install-gateway.cjs services/ATON.service.main.js
npm start
```

For PM2 deployments:

```sh
pm2 start ecosystem.config.js
```

Open the THOTH landing page at:

```text
http://localhost:8080/a/thoth/
```

Open a scene directly at:

```text
http://localhost:8080/a/thoth/?scene_id=<scene-id>
```

Authentication and scene/model storage use ATON's normal `/api/v2` routes. Configure ATON users in ATON's `config/users.json`; THOTH itself needs no environment variables.

## Local Docker (default)

From the THOTH repository root:

```sh
docker compose up --build -d
```

Open the landing page at:

```text
http://localhost:8054/a/thoth/
```

Open a scene directly at:

```text
http://localhost:8054/a/thoth/?scene_id=<scene-id>
```

This mode needs no `.env` file. Named volumes `aton-data` and `aton-config` preserve scenes, models, and ATON users across container recreation. Removing those volumes deletes the persisted local state.

The image builds and verifies the exact-geodesic addon automatically. Its
compiled copy lives outside `/aton/wapps/thoth`, so the development bind mount
below does not hide the native module.

For development with the local checkout mounted over the image copy:

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

The development override is intended for source iteration. Do not use it when testing the exact contents baked into a release image.

## HESTIA Docker

HESTIA is an independent stack. Start its Compose project first and confirm that its external `textailes` network exists:

```sh
docker network inspect textailes
```

Copy `.env.example` to `.env` and set all blank values. Required secrets are:

- `HESTIA_API_AUTH_KEY`
- `THOTH_SESSION_SECRET`
- `EGI_CLIENT_ID`
- `EGI_CLIENT_SECRET`

Required EGI configuration is:

- `EGI_AUTHORIZE_URL`
- `EGI_TOKEN_URL`
- `EGI_USERINFO_URL`
- `EGI_REDIRECT_URI`

The EGI client must register the redirect URI byte-for-byte. For the default production host it is:

```text
https://thoth.textailes.athenarc.gr/a/thoth/egi-callback
```

Non-secret HESTIA settings and their defaults are:

| Variable | Default | Purpose |
| --- | --- | --- |
| `HESTIA_API_TARGET` | `http://api:5000` | HESTIA API address on the Docker network |
| `HESTIA_API_PUBLIC_URL` | `https://api.textailes.athenarc.gr` | Origin found in HESTIA asset URLs |
| `HESTIA_DIRECTUS_TARGET` | `http://directus:8055` | Directus address on the Docker network |
| `HESTIA_PORTAL_URL` | `https://textailes.athenarc.gr` | Browser-visible Archive Portal origin |
| `HESTIA_COOKIE_NAME` | `textailes_refresh_token` | Directus refresh cookie |
| `HESTIA_COOKIE_DOMAIN` | `.textailes.athenarc.gr` | Shared parent cookie domain |
| `THOTH_HOST_DOMAIN` | `thoth.textailes.athenarc.gr` | Traefik host rule |

Start HESTIA mode with the override:

```sh
docker compose -f docker-compose.yml -f docker-compose.hestia.yml up --build -d
```

The browser never receives `HESTIA_API_AUTH_KEY`. THOTH validates either its EGI session or the shared Directus refresh cookie, then its gateway forwards only supported HESTIA routes and injects the service key upstream.

The login modal offers two intentionally separate flows:

- **Login with EGI** uses THOTH's own EGI flow and accepts any identity confirmed by EGI.
- **Login through HESTIA Portal** redirects through `/archive/user/login`; HESTIA applies its Directus registration and account-status rules before returning to the same THOTH scene.

Logging out a HESTIA Portal session clears the shared Directus cookie and therefore logs the browser out of the Archive Portal as well.

For live-mounted HESTIA development, combine all three Compose files:

```sh
docker compose -f docker-compose.yml -f docker-compose.hestia.yml -f docker-compose.dev.yml up --build
```

## Troubleshooting

- **Compose reports a missing variable:** fill every required value in `.env`; HESTIA mode deliberately fails before startup when secrets or EGI settings are absent.
- **`network textailes declared as external` error:** start HESTIA first or create the shared network with `docker network create textailes`.
- **EGI returns to an error page:** verify the registered redirect URI, public HTTPS host, client credentials, and EGI endpoint URLs.
- **HESTIA Portal returns to the archive instead of THOTH:** ensure THOTH and HESTIA hostnames are both under `HESTIA_COOKIE_DOMAIN` and use HTTPS in production.
- **Authentication service unavailable:** confirm the `directus` container is reachable from the `textailes` network at `HESTIA_DIRECTUS_TARGET`.
- **Models or images return 401:** confirm `HESTIA_API_PUBLIC_URL` matches the origin emitted by HESTIA and that the browser has completed one of the two login flows.
- **Local scenes disappear:** confirm the `aton-data` and `aton-config` named volumes were not removed.

## Verification

Validate both Compose configurations before deployment:

```sh
docker compose -f docker-compose.yml config
docker compose -f docker-compose.yml -f docker-compose.hestia.yml config
```

For focused exact-geodesic verification in a native checkout:

```sh
node server/geodesic-routes.smoke.cjs
cd geodesic/geodesic_addon
npm test
```
