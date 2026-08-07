# Geodesic Addon

A native Node.js addon exposing the Kirsanov Exact Geodesic algorithm to ATON/THOTH.

The addon allows exact geodesic distance computation directly on meshes loaded in THOTH. Measurements are therefore computed completely inside the Node process.

---

# Overview
The geodesic_addon folder must be placed in ATON's root folder. 
On the server side, the v2.js script located in ATON-->services-->API-->v2.js must be edited with a variable containing the the addon :

```js
const geodesic = require("../../geodesic_addon/build/Release/geodesic_addon.node");
```
while adding the following functions inside API.init = (app)=>{}:

```js
//add on
    app.post(API.BASE +"geodesic/exact", async (req,res)=>{
        const p=req.body;
        const result = geodesic.query(p.model_id,
            p.x1,p.y1, p.z1, p.x2, p.y2, p.z2);
            
        console.log("QUERY RESULT:", result);
        res.json({ok:true,data:result});
    });

    app.post(API.BASE +"geodesic/load",(req,res)=>{

        const p=req.body;
        const ok =geodesic.loadMesh(p.model_id, p.vertices, p.faces);
        res.json({ok:true, data:{
            status: ok ? "ok":"error"
            }
        });
    });
```



---

# Architecture

```
THOTH
 │
 │ POST /api/v2/geodesic/load
 ▼
Node.js (v2.js)
 │
 ▼
Node Addon (N-API)
 │
 ▼
Kirsanov Geodesic Library
```

Measurements are therefore computed completely inside the Node process without spawning an external executable.

---

# API
The addon exposes two functions:

```js
loadMesh(model_id, vertices, faces)
```

Loads a mesh into memory and builds the geodesic data structures.

```js
query(model_id, x1, y1, z1, x2, y2, z2)
```

Computes the exact geodesic distance between two points lying on the loaded mesh.

The addon keeps every loaded mesh in memory and identifies them through `model_id`.

## loadMesh()

### Input

```cpp
loadMesh(model_id,vertices,faces)
```

### Parameters

| Name | Type | Description |
|------|------|-------------|
| model_id | string | Unique model identifier |
| vertices | double[] | xyz xyz xyz... |
| faces | uint[] | triangle indices |

Example

```json
{
    "model_id":"cube.glb",
    "vertices":[0,0,0,1,0,0,0,1,0],
    "faces":[0,1,2]
}
```

### Returns

```json
{
    "status":true
}
```
or
```json
{
    "status":false,
    "error":"Invalid mesh"
}
```

---

## query()

### Input

```cpp
query(model_id,x1,y1,z1,x2,y2,z2)
```

Example

```json
{
    "model_id":"cube.glb",
    "x1":0.23,
    "y1":0.51,
    "z1":0.92,
    "x2":0.67,
    "y2":0.28,
    "z2":0.33
}
```

### Returns

```json
{
    "status":true,
    "distance":0.534,
    "path":[
        {
            "x":...,
            "y":...,
            "z":...
        }
    ]
}
```

---

# Internal Workflow

## Mesh Loading

```
THOTH
    ↓
Extract vertices/faces
    ↓
Sanitize mesh
    ↓
POST /geodesic/load
    ↓
Addon
    ↓
initialize_mesh_data()
    ↓
Build Exact Geodesic structures
```

---

## Query

```
Pick point
      ↓
Convert world → local
      ↓
POST /geodesic/exact
      ↓
findNearestSurfacePoint()
      ↓
Exact propagation
      ↓
Traceback
      ↓
Return path
      ↓
Convert local → world
      ↓
Render measurement
```

---

# Mesh Requirements

The Exact Geodesic algorithm requires a valid manifold triangular mesh.

Supported:

- triangular meshes
- indexed geometry
- closed meshes
- boundary meshes

Unsupported:

- non-manifold edges
- duplicate triangles
- degenerate triangles
- invalid indices
- zero-length edges

---

# Mesh Sanitization

Before sending meshes to the addon THOTH performs:

- merge duplicated vertices
- remove duplicated triangles
- remove degenerate triangles
- remove invalid indices
- remove tiny-area triangles
- detect non-manifold edges

If validation fails the mesh is rejected before reaching the addon.

---

# Coordinate Systems

The addon operates exclusively in mesh local coordinates.

Workflow:

```
World coordinates
        ↓
matrixWorld.inverse()
        ↓
Local coordinates
        ↓
Exact Geodesic
        ↓
Local path
        ↓
matrixWorld
        ↓
World path
```

---

# Data Structures

Each loaded mesh stores:

```
MeshData
{
    std::vector<double> points;
    std::vector<unsigned> faces;

    std::unique_ptr<Mesh> mesh;

    std::unique_ptr<GeodesicAlgorithmExact> algorithm;
}
```

Meshes are stored inside

```cpp
std::unordered_map<std::string, MeshData> meshDB;
```

using the model name as key.

---


---

# Building

Requirements

- Visual Studio 2022
- Node.js
- node-addon-api
- node-gyp

Install dependencies

```bash
npm install
```

Build

```bash
node-gyp configure
node-gyp build
```

Rebuild

```bash
node-gyp rebuild
```

---

# Integration

THOTH

```
Models.onLoad()
        ↓
geodesicLoad()
```

Measurement

```
createExactGeodesicMeasurement()
        ↓
geodesicExact()
        ↓
measurement visualization
```

Server

```
POST /api/v2/geodesic/load
POST /api/v2/geodesic/exact
```




