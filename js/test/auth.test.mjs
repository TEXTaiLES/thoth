import assert from "node:assert/strict";
import test from "node:test";
import Auth from "../src/auth.js";

const originalWindow = globalThis.window;

test.after(() => {
    globalThis.window = originalWindow;
});

test("local authentication uses injected ATON and updates the shared app", async () => {
    const app = {};
    const aton = { checkAuth: onLogged => onLogged({ username: "alice" }) };
    globalThis.window = {
        location: {
            href: "http://localhost:8080/a/thoth/",
            pathname: "/a/thoth/",
            search: "",
            hash: ""
        }
    };
    Auth.setup({ config: { auth: { mode: "aton" } }, app, aton });
    const user = await Auth.getUser();
    Auth.setAuthState(user);
    assert.equal(user.username, "alice");
    assert.equal(app.user.username, "alice");
    assert.equal(Auth.isAuthenticated(), true);
});

test("HESTIA login URLs carry the caller-selected My Scenes return path", () => {
    let assigned = "";
    globalThis.window = {
        location: {
            href: "https://thoth.example/a/thoth/",
            pathname: "/a/thoth/",
            search: "",
            hash: "",
            assign: value => { assigned = value; }
        }
    };
    Auth.setup({
        config: { auth: { mode: "hestia" } },
        baseURL: "/a/thoth",
        app: {}
    });
    Auth.startEgiLogin("/a/thoth/myscenes/");
    const target = new URL(assigned);
    assert.equal(target.pathname, "/a/thoth/egi-login");
    assert.equal(target.searchParams.get("redirect"), "/a/thoth/myscenes/");
});

test("authentication reasons are consumed without dropping other scene parameters", () => {
    let replacement = "";
    globalThis.window = {
        location: {
            href: "https://thoth.example/a/thoth/?scene_id=alice%2Fone&reason=SESSION_EXPIRED#view",
            pathname: "/a/thoth/",
            search: "?scene_id=alice%2Fone&reason=SESSION_EXPIRED",
            hash: "#view"
        },
        history: { replaceState: (_state, _title, value) => { replacement = value; } }
    };
    Auth.setup({ config: { auth: { mode: "hestia" } }, app: {} });
    assert.match(Auth.consumeRedirectReason(), /session has expired/i);
    assert.equal(replacement, "/a/thoth/?scene_id=alice%2Fone#view");
});
