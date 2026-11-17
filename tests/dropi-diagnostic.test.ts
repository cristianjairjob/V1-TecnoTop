import { test, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { diagnoseDropi } from "../src/services/dropi/diagnostic";
const original = { ...process.env };
afterEach(() => {
  mock.restoreAll();
  for (const key of ["DROPI_API_TOKEN", "DROPI_API_URL"]) {
    if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key];
  }
});
test("diagnóstico expone solo estado e IP, sin secretos ni productos", async () => {
  process.env.DROPI_API_TOKEN = "mock-only";
  delete process.env.DROPI_API_URL;
  let calls = 0;
  mock.method(globalThis, "fetch", async (url: URL | RequestInfo, init?: RequestInit) => {
    calls++;
    assert.equal(String(url), "https://api.dropi.co/integrations/products/index");
    assert.equal(JSON.parse(String(init?.body)).pageSize, 1);
    return new Response(JSON.stringify({ isSuccess: false, message: "Access denied", ip: "192.0.2.1", token: "never-expose", objects: ["private"] }), { status: 401 });
  });
  const result = await diagnoseDropi();
  assert.equal(result.connected, false);
  assert.equal(result.observedIp, "192.0.2.1");
  assert.equal(result.accessDenied, true);
  assert.equal(calls, 1);
  assert.equal(JSON.stringify(result).includes("never-expose"), false);
  assert.equal(JSON.stringify(result).includes("private"), false);
});
test("diagnóstico exige respuesta de catálogo válida", async () => {
  process.env.DROPI_API_TOKEN = "mock-only";
  delete process.env.DROPI_API_URL;
  mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ isSuccess: true, objects: [] })));
  assert.equal((await diagnoseDropi()).connected, true);
});
