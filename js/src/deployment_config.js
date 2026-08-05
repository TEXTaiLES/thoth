/*===========================================================================

    THOTH
    Deployment configuration selection

===========================================================================*/
const DeploymentConfig = {};

DeploymentConfig.BASE_URL = "../../a/thoth/config/";
DeploymentConfig.SOURCES = Object.freeze({
    local : "local.json",
    hestia: "hestia.json"
});

DeploymentConfig.isObject = (value) => Boolean(
    value && typeof value === "object" && !Array.isArray(value)
);

DeploymentConfig.merge = (base, override) => {
    const result = DeploymentConfig.isObject(base) ? { ...base } : {};
    if (!DeploymentConfig.isObject(override)) return result;

    for (const key of Object.keys(override)) {
        if (["__proto__", "constructor", "prototype"].includes(key)) continue;
        result[key] = DeploymentConfig.isObject(result[key]) && DeploymentConfig.isObject(override[key])
            ? DeploymentConfig.merge(result[key], override[key])
            : override[key];
    }
    return result;
};

DeploymentConfig.getSource = (selector) => {
    const expectedSource = DeploymentConfig.SOURCES[selector?.mode];
    if (!expectedSource || selector?.source !== expectedSource) {
        throw new Error("Invalid THOTH deployment selector");
    }
    return expectedSource;
};

DeploymentConfig.resolve = (selector, baseConfig) => {
    DeploymentConfig.getSource(selector);
    if (baseConfig?.deploymentMode !== selector.mode) {
        throw new Error("Deployment selector and configuration mode do not match");
    }
    return DeploymentConfig.merge(baseConfig, selector.runtime);
};

export default DeploymentConfig;
