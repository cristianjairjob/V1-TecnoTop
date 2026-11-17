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
test("importa solo el ID solicitado y preserva campos comerciales al sincronizar", async () => {
  setup(); let requests = 0; let calls = 0;
  mock.method(globalThis, "fetch", async (url: URL | RequestInfo, init?: RequestInit) => {
    requests++; assert.equal(String(url), "https://api.dropi.co/integrations/products/v2/1970619");
    assert.equal(init?.method, "GET"); assert.equal(init?.body, undefined);
    return new Response(JSON.stringify({ isSuccess: true, objects: { id: 1970619, name: "Producto de prueba", stock: 10, sale_price: 20000, user_id: 2 } }));
  });
  db.syncLog.create = (async () => ({})) as unknown as typeof db.syncLog.create;
  db.$transaction = (async (fn: (tx: unknown) => unknown) => fn({
    product: { upsert: async ({ where, create, update }: { where: { dropiId: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
      calls++; assert.equal(where.dropiId, "1970619");
      assert.equal(create.status, undefined); // Prisma defaults to DRAFT.
      for (const key of ["name", "description", "images", "salePrice", "categoryId", "status"]) assert.equal(key in update, false);
      return { id: "local-product", dropiId: "1970619", name: "Producto de prueba", status: "DRAFT" };
    } },
    dropiProduct: { upsert: async () => ({}) },
    productVariant: { updateMany: async () => ({ count: 0 }) },
  })) as typeof db.$transaction;
  for (let i = 0; i < 2; i++) assert.equal((await importDropiProductById("#1970619")).id, "local-product");
  assert.equal(requests, 2); assert.equal(calls, 2);
});
test("401 no escribe productos y se registra como error de acceso", async () => {
  setup(); let requests = 0; let log: unknown;
  mock.method(globalThis, "fetch", async () => { requests++; return new Response("{}", { status: 401 }); });
  db.$transaction = (async () => assert.fail("No debe importar")) as typeof db.$transaction;
  db.syncLog.create = (async ({ data }: { data: unknown }) => { log = data; return {}; }) as unknown as typeof db.syncLog.create;
  await assert.rejects(importDropiProductById("1970619"), /DROPI_HTTP_401/);
  assert.equal(requests, 1);
  assert.deepEqual(log, { operation: "IMPORT_ID", status: "ERROR", count: 0, errorCode: "DROPI_HTTP_401" });
});
test("rechaza respuesta con ID diferente al solicitado", async () => {
  setup(); mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ isSuccess: true, objects: { id: 42, name: "Otro producto" } })));
  await assert.rejects(getDropiProduct("1970619"), /DROPI_INVALID_PRODUCT/);
});
