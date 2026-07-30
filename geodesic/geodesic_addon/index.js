const path = require("path");

const native = require(path.join(
        __dirname,
        "build",
        "Release",
        "geodesic_addon.node"
    )
);


module.exports = {loadMesh(model_id, vertices, faces)
    {
        return native.loadMesh( model_id,
            vertices,
            faces
        );
    },


    query( model_id, x1,y1,z1,x2,y2,z2)
    {
        return native.query({ model_id,
                x1,
                y1,
                z1,
                x2,
                y2,
                z2
            }
        );
    }
};