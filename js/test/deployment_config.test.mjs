import assert from "node:assert/strict";
import test from "node:test";
import DeploymentConfig from "../src/deployment_config.js";

test("deployment configuration only accepts the matching committed source", () => {
    assert.equal(DeploymentConfig.getSource({ mode: "local", source: "local.json" }), "local.json");
    assert.throws(
        () => DeploymentConfig.getSource({ mode: "hestia", source: "local.json" }),
        /Invalid THOTH deployment selector/
    );
});

test("runtime values merge without allowing prototype keys", () => {
    const config = DeploymentConfig.resolve(
        { mode: "hestia", source: "hestia.json", runtime: { auth: { portalUrl: "https://portal.example" } } },
        { deploymentMode: "hestia", auth: { mode: "hestia" } }
    );
    assert.equal(config.auth.mode, "hestia");
    assert.equal(config.auth.portalUrl, "https://portal.example");
});
