# Exact geodesic computation

THOTH exposes the Kirsanov/Mitchell-Mount-Papadimitriou exact geodesic
algorithm through a Node.js N-API addon. The Kirsanov headers under
`geodesic_addon/include/` retain their MIT license notices.

The browser welds coincident vertices, removes invalid and duplicate
triangles, rejects non-manifold edges, and lazily uploads a mesh the first
time an exact measurement is requested. Endpoints are registered by
`server/geodesic-routes.js`:

- `POST /api/v2/geodesic/load` initializes a mesh in server memory.
- `POST /api/v2/geodesic/exact` computes a distance and surface path between
  two mesh-local points.

Build and test the addon from this directory:

```sh
cd geodesic/geodesic_addon
npm ci
npm test
```

A native build requires Python, a C++17 compiler, and the platform tooling
required by `node-gyp`. Docker installs these prerequisites and builds the
addon automatically.
