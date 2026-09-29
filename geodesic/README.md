# Geodesic Distance Computation 
THOTH exposes two methods for computing geodesic distances:
- Kirsanov/Mitchell-Mount-Papadimitriou exact geodesic
algorithm gi
- Heat method for geodesic distance computation 

through a Node.js N-API addon. The Kirsanov headers under
`geodesic_addon/include/` retain their MIT license notices.

The browser welds coincident vertices, removes invalid and duplicate
triangles, rejects non-manifold edges, and lazily uploads a mesh the first
time an exact measurement is requested. Endpoints are registered by
`server/geodesic-routes.js`:

- `POST /api/v2/geodesic/load` initializes a mesh in server memory for MMP algorithm.
- `POST /api/v2/geodesic/exact` computes the exact geodesic distance and surface path between two mesh-local points.
- `POST /api/v2/geodesic/heat_load` initializes a mesh in server memory for the Heat method algorithm
- `POST /api/v2/geodesic/heat` computes a distance and surface path between a source and a target on the same mesh.

Build and test the addon from this directory:

```sh
cd geodesic/geodesic_addon
npm ci
npm test
```

A native build requires Python, a C++17 compiler, and the platform tooling
required by `node-gyp`. Docker installs these prerequisites and builds the
addon automatically.

##### Note: Mesh Requirements
Geodesic distances can only be computed on triangular meshes that are 2D manifolds (closed and boundary meshes) and do not consist of multiple isolated parts.