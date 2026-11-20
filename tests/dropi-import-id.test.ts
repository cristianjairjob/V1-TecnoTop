import { test, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { dropiProductIdSchema } from "../src/lib/dropi-product-id";
import { importDropiProductById } from "../src/services/dropi/inventory";
import { getDropiProduct } from "../src/services/dropi/products";
import { db } from "../src/lib/db";
const originalToken = process.env.DROPI_API_TOKEN;
const originalUrl = process.env.DROPI_API_URL;
const originalTransaction = db.$transaction;
const originalLog = db.syncLog.create;
afterEach(() => {
  mock.restoreAll(); db.$transaction = originalTransaction; db.syncLog.create = originalLog;
  if (originalToken === undefined) delete process.env.DROPI_API_TOKEN; else process.env.DROPI_API_TOKEN = originalToken;
  if (originalUrl === undefined) delete process.env.DROPI_API_URL; else process.env.DROPI_API_URL = originalUrl;
});
function setup() { process.env.DROPI_API_TOKEN = "mock-only"; delete process.env.DROPI_API_URL; }
test("acepta ID numérico con # opcional y rechaza palabras, enlaces y rutas", () => {
  assert.equal(dropiProductIdSchema.parse(" #1970619 "), "1970619");
  assert.equal(dropiProductIdSchema.parse("1970619"), "1970619");
  for (const value of ["", "audífonos", "0", "-1", "1/../../orders", "https://dropi.co/1970619"]) assert.equal(dropiProductIdSchema.safeParse(value).success, false);
});
test("V5 pausa importaciones sin consultar Dropi ni modificar inventario", async () => {
 setup(); mock.method(globalThis,"fetch",async()=>assert.fail("Dropi pausado"));
 db.$transaction=(async()=>assert.fail("No debe cambiar inventario")) as typeof db.$transaction;
 db.syncLog.create=(async()=>({})) as unknown as typeof db.syncLog.create;
 await assert.rejects(importDropiProductById("1970619"),/DROPI_PAUSED/);
});
test("el cliente histórico conserva el manejo de 401",async()=>{
 setup();mock.method(globalThis,"fetch",async()=>new Response("{}",{status:401}));
 await assert.rejects(getDropiProduct("1970619"),/DROPI_HTTP_401/);
});
test("rechaza respuesta con ID diferente al solicitado", async () => {
  setup(); mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ isSuccess: true, objects: { id: 42, name: "Otro producto" } })));
  await assert.rejects(getDropiProduct("1970619"), /DROPI_INVALID_PRODUCT/);
});
