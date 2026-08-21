/*===========================================================================

    THOTH
    Model transform management

===========================================================================*/
import {TransformControls} from "./transform_controls.js";

let Transforms = {};


// Setup

Transforms.setup = () => {
    Transforms.transformStart = null;
    Transforms._eventsReady = false;
};


// Normalize

Transforms._vector = (value, defaultValue) => {
    if (Array.isArray(value)) {
        return {
            x: Number(value[0] ?? defaultValue.x),
            y: Number(value[1] ?? defaultValue.y),
            z: Number(value[2] ?? defaultValue.z)
        };
    }

    if (value && typeof value === "object") {
        return {
            x: Number(value.x ?? defaultValue.x),
            y: Number(value.y ?? defaultValue.y),
            z: Number(value.z ?? defaultValue.z)
        };
    }

    return { ...defaultValue };
};

Transforms.normalize = (data = {}) => {
    const transform = data.transform || {};
    const transforms = data.transforms || data;

    return {
        translation: Transforms._vector(
            transforms.translation || transforms.position || transform.translation || transform.position,
            { x: 0, y: 0, z: 0 }
        ),
        rotation: Transforms._vector(
            transforms.rotation || transform.rotation,
            { x: 0, y: 0, z: 0 }
        )
    };
};

Transforms.fromNode = (model) => {
    if (!model) return Transforms.normalize();

    return {
        translation: {
            x: Number(model.position.x),
            y: Number(model.position.y),
            z: Number(model.position.z)
        },
        rotation: {
            x: Number(model.rotation.x),
            y: Number(model.rotation.y),
            z: Number(model.rotation.z)
        }
    };
};


// Model data

Transforms.parseModelTransform = (modelId, data = {}) => {
    const model = THOTH.SceneStore?.ensureModel(modelId);
    if (!model) return;

    const transforms = Transforms.normalize(data);
    THOTH.SceneStore.setModelField(modelId, "transforms", transforms);

    return transforms;
};

Transforms.getModelTransform = (modelId) => {
    return structuredClone(
        THOTH.SceneStore?.getModel(modelId)?.transforms || Transforms.normalize()
    );
};

Transforms.applyModelTransform = (modelId, transform) => {
    if (!modelId) return;

    const transforms = Transforms.normalize(transform);
    const model = THOTH.Models?.modelMap?.get(modelId);

    THOTH.SceneStore?.setModelField(modelId, "transforms", transforms);

    if (model) {
        model.position.set(
            transforms.translation.x,
            transforms.translation.y,
            transforms.translation.z
        );
        model.rotation.set(
            transforms.rotation.x,
            transforms.rotation.y,
            transforms.rotation.z
        );
        model.scale.set(1, 1, 1);

        if (THOTH.transform && THOTH.transform.object === model) {
            THOTH.transform.updateMatrixWorld(true);
            THOTH.UI?.syncTransformUI?.(model);
        }
    }

    return transforms;
};

Transforms.applyLocalModelTransform = (modelId, patch) => {
    const prevValue = Transforms.getModelTransform(modelId);
    const value = Transforms.normalize({
        ...prevValue,
        ...patch
    });

    THOTH.Ops.applyLocal(THOTH.Ops.makeOperation(
        "model.update_transform",
        {
            model_id: modelId,
            field   : Object.keys(patch || {})[0] || "transforms"
        },
        value,
        prevValue
    ));
};

Transforms.getExportData = (modelId) => {
    return Transforms.getModelTransform(modelId);
};


// Gizmo

Transforms._ensureGizmo = () => {
    if (THOTH.transform) return THOTH.transform;

    THOTH.transform = new TransformControls(
        ATON.Nav._camera,
        ATON._renderer.domElement
    );

    const gizmoNode = new ATON.Node("transformGizmo");
    ATON._mainRoot.add(gizmoNode);
    gizmoNode.add(THOTH.transform);

    return THOTH.transform;
};

Transforms._setupGizmoEvents = () => {
    if (Transforms._eventsReady || !THOTH.transform) return;

    THOTH.transform.addEventListener("dragging-changed", (event) => {
        ATON.Nav._controls.enabled = !event.value;
    });

    THOTH.transform.addEventListener("mouseDown", () => {
        const obj = THOTH.transform.object;
        if (!obj) return;

        if (THOTH.transform.getMode() === "scale") {
            obj.scale.set(1, 1, 1);
            THOTH.transform.setMode("translate");
        }
        Transforms.transformStart = Transforms.fromNode(obj);
    });

    THOTH.transform.addEventListener("change", () => {
        const obj = THOTH.transform.object;
        if (!obj) return;

        if (THOTH.transform.getMode() === "scale") {
            obj.scale.set(1, 1, 1);
            THOTH.transform.setMode("translate");
        }
        THOTH.UI.syncTransformUI(obj);
    });

    THOTH.transform.addEventListener("mouseUp", () => {
        const obj = THOTH.transform.object;
        if (!obj || !Transforms.transformStart) return;

        const modelId = obj.name;
        const mode = THOTH.transform.getMode();
        const prevValue = Transforms.getModelTransform(modelId);
        const nextValue = Transforms.fromNode(obj);

        if (mode === "scale") {
            obj.scale.set(1, 1, 1);
            THOTH.transform.setMode("translate");
            THOTH.transform.updateMatrixWorld(true);
            THOTH.UI?.syncTransformUI?.(obj);
            Transforms.transformStart = null;
            return;
        }

        let field = "transforms";
        if (mode === "translate") field = "translation";
        if (mode === "rotate") field = "rotation";

        const value = {
            ...prevValue,
            [field]: nextValue[field]
        };
        const startValue = {
            ...prevValue,
            [field]: Transforms.transformStart[field]
        };

        THOTH.Ops.applyLocal(THOTH.Ops.makeOperation(
            "model.update_transform",
            {
                model_id: modelId,
                field   : field
            },
            value,
            startValue
        ));

        Transforms.transformStart = null;
    });

    Transforms._eventsReady = true;
};

Transforms.attachGizmo = (modelId) => {
    const model = THOTH.Models?.modelMap?.get(modelId);
    if (!model) {
        console.warn("model not found");
        return;
    }

    const transform = Transforms._ensureGizmo();
    Transforms._setupGizmoEvents();

    if (transform.getMode() === "scale") {
        transform.setMode("translate");
    }
    transform.attach(model);
    transform.traverse(o => {
        if (o.material) {
            o.material.depthTest = false;
            o.material.transparent = false;
            o.material.opacity = 1;
        }
    });
    transform.visible = true;
    transform.setSize(1, 1, 1);
    transform.updateMatrixWorld(true);
};

Transforms.detachGizmo = () => {
    if (!THOTH.transform) return;

    THOTH.transform.detach();
    THOTH.transform.visible = false;
};


export default Transforms;
