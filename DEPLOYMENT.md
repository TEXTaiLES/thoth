# THOTH Deployment Guide

THOTH supports native ATON, local Docker, and Docker connected to HESTIA. Native ATON and local Docker use ATON's API and username/password authentication. HESTIA mode uses the HESTIA API and offers independent EGI and HESTIA Portal sessions.

## Requirements

- Node.js for native deployment.
- Docker with the Compose plugin for container deployments.
- THOTH checked out as `wapps/thoth` inside an ATON checkout for native deployment.
- A running HESTIA/Directus stack and EGI client registration for HESTIA mode.

The Docker image always uses ATON commit `22afaf28bcb6deb57ff1ea8e3737336a5a85d076`.

## Native ATON

From the ATON repository root, install and start ATON:

```sh
npm install
npm start
```

For PM2 deployments:

```sh
pm2 start ecosystem.config.js
```

Open THOTH at:

```text
http://localhost:8080/a/thoth/?scene_id=<scene-id>
```

Authentication and scene/model storage use ATON's normal `/api/v2` routes. Configure ATON users in ATON's `config/users.json`; THOTH itself needs no environment variables.

## Local Docker (default)

From the THOTH repository root:

```sh
docker compose up --build -d
```

Open:

```text
http://localhost:8054/a/thoth/?scene_id=<scene-id>
```

This mode needs no `.env` file. Named volumes `aton-data` and `aton-config` preserve scenes, models, and ATON users across container recreation. Removing those volumes deletes the persisted local state.

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
