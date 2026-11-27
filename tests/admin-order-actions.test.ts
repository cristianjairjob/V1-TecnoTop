import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { deleteAdminOrder, deleteOrderSchema, dispatchOrderSchema, setOrderDispatch } from "../src/lib/admin-order-actions";
import { PATCH, DELETE } from "../src/app/api/admin/pedidos/route";
const restores: (() => void)[] = [];
function stub(target: object, key: string, value: unknown) { const t = target as Record<string, unknown>; const old = t[key]; t[key] = value; restores.push(() => { t[key] = old; }); }
afterEach(() => restores.splice(0).reverse().forEach(f => f()));
function transaction() { stub(db, "$transaction", async (fn: (tx: typeof db) => unknown, options: { isolationLevel: string }) => { assert.equal(options.isolationLevel, "Serializable"); return fn(db); }); }
test("dispatch and reversal persist status with audit and tracking, rejecting stale edits", async () => {
  transaction(); let status = "PENDIENTE"; const events: string[] = []; let audits = 0;
  stub(db.order, "updateMany", async ({ where, data }: { where: { id: string; status: string }; data: { status: string } }) => {
    assert.equal(where.id, "order"); if (where.status !== status) return { count: 0 }; status = data.status; return { count: 1 };
  });
  stub(db.trackingEvent, "create", async ({ data }: { data: { status: string } }) => { events.push(data.status); });
  stub(db.auditLog, "create", async () => { audits++; });
  assert.deepEqual(await setOrderDispatch("admin", { id: "order", expectedStatus: "PENDIENTE", status: "DESPACHADO" }), { id: "order", status: "DESPACHADO" });
  await assert.rejects(setOrderDispatch("admin", { id: "order", expectedStatus: "PENDIENTE", status: "DESPACHADO" }), /cambió/);
  await setOrderDispatch("admin", { id: "order", expectedStatus: "DESPACHADO", status: "PENDIENTE" });
  assert.equal(status, "PENDIENTE"); assert.deepEqual(events, ["DESPACHADO", "PENDIENTE"]); assert.equal(audits, 2);
});
test("delete removes only the target's children before the order, preserving customer and stock", async () => {
  transaction(); const removed: string[] = [];
  stub(db.order, "findUnique", async () => ({ id: "order" }));
  stub(db.notificationPart, "deleteMany", async (args: unknown) => { assert.deepEqual(args, { where: { notification: { orderId: "order" } } }); removed.push("parts"); });
  for (const [name, delegate] of [["notifications", db.notification], ["dropi", db.dropiOrder], ["shipments", db.shipment], ["tracking", db.trackingEvent], ["items", db.orderItem]] as const) {
    stub(delegate, "deleteMany", async (args: unknown) => { assert.deepEqual(args, { where: { orderId: "order" } }); removed.push(name); });
  }
  stub(db.order, "delete", async (args: unknown) => { assert.deepEqual(args, { where: { id: "order" } }); removed.push("order"); });
  stub(db.auditLog, "create", async () => { removed.push("audit"); });
  stub(db.product, "updateMany", async () => assert.fail("Stock must not change"));
  stub(db.customer, "delete", async () => assert.fail("Customer must not be deleted"));
  await deleteAdminOrder("admin", "order");
  assert.deepEqual(removed, ["parts", "notifications", "dropi", "shipments", "tracking", "items", "order", "audit"]);
});
test("missing orders and invalid confirmations/statuses are rejected", async () => {
  transaction(); stub(db.order, "findUnique", async () => null);
  await assert.rejects(deleteAdminOrder("admin", "missing"), /ya no existe/);
  for (const confirm of [false, undefined, "true"]) assert.equal(deleteOrderSchema.safeParse({ id: "order", confirm }).success, false);
  assert.equal(dispatchOrderSchema.safeParse({ id: "order", expectedStatus: "INVALIDO", status: "PENDIENTE" }).success, false);
});
test("admin mutations reject foreign origins before database access", async () => {
  const url = process.env.APP_URL || "https://tecnotop.com.co";
  for (const [method, handler] of [["PATCH", PATCH], ["DELETE", DELETE]] as const) {
    const response = await handler(new Request(new URL("/api/admin/pedidos", url), { method, headers: { origin: "https://untrusted.invalid" }, body: "{}" }));
    assert.equal(response.status, 403);
  }
});
