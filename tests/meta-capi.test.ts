import { test, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { buildMetaEvent, metaHash, metaUserData, normalizeMetaText, purchaseAllowed, purchaseReceipt, readPurchaseReceipt, sendMetaEvent, type MetaEvent } from "../src/lib/meta-capi";
import { metaRequestSchema } from "../src/lib/meta-schema";
import { POST } from "../src/app/api/meta-capi/route";
import { db } from "../src/lib/db";
import { POST as checkoutPOST } from "../src/app/api/checkout/route";
import { checkoutSchema } from "../src/lib/validation";
import { metaConfig } from "../src/lib/meta-config";

const originalEnv = { ...process.env };
const restores: (() => void)[] = [];
function stub(target: object, key: string, value: unknown) { const t = target as Record<string, unknown>; const old = t[key]; t[key] = value; restores.push(() => { t[key] = old; }); }
afterEach(() => {
  restores.splice(0).reverse().forEach(f => f()); mock.restoreAll();
  for (const key of ["APP_URL", "NEXT_PUBLIC_META_PIXEL_ID", "META_CAPI_ACCESS_TOKEN", "META_TEST_EVENT_CODE", "META_CLIENT_IP_HEADER", "CHECKOUT_ENABLED", "TELEGRAM_NOTIFICATIONS_ENABLED", "DATABASE_URL"]) {
    if (originalEnv[key] === undefined) delete process.env[key]; else process.env[key] = originalEnv[key];
  }
});
function configure() {
  process.env.APP_URL = "https://tecnotop.com.co";
  process.env.NEXT_PUBLIC_META_PIXEL_ID = "123456789";
  process.env.META_CAPI_ACCESS_TOKEN = "test-not-a-real-secret";
  process.env.META_CLIENT_IP_HEADER = "x-forwarded-for";
  delete process.env.META_TEST_EVENT_CODE;
  stub(db.rateLimit, "upsert", async () => ({ count: 1 }));
}
const context = () => ({ consent: true as const, event_id: randomUUID(), event_source_url: "https://tecnotop.com.co/checkout?email=private#secret", fbp: "fb.1.123.456", fbc: "fb.1.123.click-id" });
const person = { firstName: "  ANA   María ", lastName: " DE LA CRUZ ", phone: "+57 304 123 4567", email: " ANA@Example.com ", city: " SAN JOSÉ DE CÚCUTA ", state: " Norte  de Santander " };
function request(body: unknown, origin = "https://tecnotop.com.co") { return new Request("https://tecnotop.com.co/api/meta-capi", { method: "POST", headers: { origin, "content-type": "application/json", "x-forwarded-for": "203.0.113.8, 10.0.0.1", "user-agent": "MetaMockBrowser" }, body: JSON.stringify(body) }); }
function ledger() {
  const entries = new Map<string, { id: string; sentAt: Date | null; lockedUntil: Date | null; createdAt: Date }>();
  stub(db.metaEvent, "upsert", async ({ where }: { where: { id: string } }) => {
    if (!entries.has(where.id)) entries.set(where.id, { id: where.id, sentAt: null, lockedUntil: null, createdAt: new Date() });
    return { ...entries.get(where.id)! };
  });
  stub(db.metaEvent, "updateMany", async ({ where, data }: { where: { id: string; OR?: unknown }; data: { lockedUntil: Date | null } }) => {
    const entry = entries.get(where.id)!;
    if (entry.sentAt || (where.OR && entry.lockedUntil && entry.lockedUntil > new Date())) return { count: 0 };
    Object.assign(entry, data); return { count: 1 };
  });
  stub(db.metaEvent, "update", async ({ where, data }: { where: { id: string }; data: object }) => Object.assign(entries.get(where.id)!, data));
  return entries;
}
test("InitiateCheckout contains only raw network/cookie data and canonical event metadata", () => {
  configure(); const c = context(); const e = buildMetaEvent("InitiateCheckout", request({}), c, person);
  assert.equal(e.event_name, "InitiateCheckout"); assert.equal(e.event_id, c.event_id);
  assert.equal(e.action_source, "website"); assert.equal(e.event_source_url, "https://tecnotop.com.co/checkout");
  assert.equal(Number.isInteger(e.event_time), true);
  assert.deepEqual(e.user_data, { client_ip_address: "203.0.113.8", client_user_agent: "MetaMockBrowser", fbp: c.fbp, fbc: c.fbc });
  assert.equal(e.custom_data, undefined);
});
test("personal data is normalized and SHA256 hashed only on server; phone keeps one country code", () => {
  configure(); assert.equal(normalizeMetaText("  A   B "), "a b");
  assert.equal(metaHash("test"), "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08");
  const payment = metaUserData("AddPaymentInfo", request({}), context(), person);
  for (const [key, value] of Object.entries({ em: "ana@example.com", ph: "573041234567", fn: "ana maría", ln: "de la cruz" })) assert.deepEqual(payment[key], [metaHash(value)]);
  assert.equal(payment.ct, undefined); assert.equal(payment.st, undefined);
  const purchase = buildMetaEvent("Purchase", request({}), context(), person, 199800);
  assert.deepEqual(purchase.user_data.ct, [metaHash("san josé de cúcuta")]);
  assert.deepEqual(purchase.user_data.st, [metaHash("norte de santander")]);
  assert.deepEqual(purchase.custom_data, { currency: "COP", value: 199800 });
  assert.equal(metaUserData("Purchase", request({}), context(), { ...person, email: "" }).em, undefined);
  assert.deepEqual(metaUserData("Purchase", request({}), context(), { ...person, phone: "3041234567" }).ph, purchase.user_data.ph);
});
test("does not invent cookies/IP and rejects foreign source URL, missing consent, malformed IDs and invalid phone", () => {
  configure(); delete process.env.META_CLIENT_IP_HEADER;
  const c = { ...context(), fbp: undefined, fbc: undefined };
  const u = metaUserData("InitiateCheckout", request({ client_ip_address: "1.1.1.1" }), c);
  assert.deepEqual(u, { client_user_agent: "MetaMockBrowser" });
  assert.throws(() => buildMetaEvent("InitiateCheckout", request({}), { ...c, event_source_url: "https://evil.test" }));
  for (const change of [{ consent: false }, { consent: undefined }, { event_id: "bad" }, { fbc: "invented" }]) assert.equal(metaRequestSchema.safeParse({ ...c, ...change, event_name: "InitiateCheckout" }).success, false);
  assert.equal(metaRequestSchema.safeParse({ ...c, event_name: "AddPaymentInfo", person: { ...person, email: "", phone: "123" } }).success, false);
});
test("sender uses v21, optional test code and same ID, deduplicates repeated and concurrent sends", async () => {
  configure(); ledger(); process.env.META_TEST_EVENT_CODE = "TEST_MOCK";
  const e = buildMetaEvent("InitiateCheckout", request({}), context()); let calls = 0;
  mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    calls++; assert.equal(url, "https://graph.facebook.com/v21.0/123456789/events?access_token=test-not-a-real-secret");
    const body = JSON.parse(init.body as string); assert.equal(body.test_event_code, "TEST_MOCK"); assert.equal(body.data[0].event_id, e.event_id);
    return Response.json({ events_received: 1 });
  });
  await Promise.all([sendMetaEvent(e), sendMetaEvent(e)]);
  assert.equal(await sendMetaEvent(e), "sent"); assert.equal(calls, 1);
});
test("transient failures retry identical ID/time; permanent errors do not leak token or raw data", async () => {
  configure(); const entries = ledger(); const payloads: MetaEvent[] = [];
  mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    payloads.push(JSON.parse(init.body as string).data[0]);
    return payloads.length === 1 ? Response.json({}, { status: 503 }) : Response.json({ events_received: 1 });
  });
  const e = buildMetaEvent("AddPaymentInfo", request({}), context(), person);
  assert.equal(await sendMetaEvent(e), "sent"); assert.equal(payloads.length, 2);
  assert.deepEqual(payloads[0], payloads[1]); assert.ok(entries.get(`AddPaymentInfo:${e.event_id}`)?.sentAt);
  const serialized = JSON.stringify(payloads); assert.equal(serialized.includes("ANA@Example"), false); assert.equal(serialized.includes("3041234567"), false);
});
test("purchase receipt binds persisted order and ID, expires and rejects forgery", () => {
  configure(); const order = { id: "order1", idempotencyKey: randomUUID(), createdAt: new Date() };
  const receipt = purchaseReceipt(order); assert.equal(readPurchaseReceipt(receipt, order.idempotencyKey), order.id);
  assert.throws(() => readPurchaseReceipt(`${receipt}x`, order.idempotencyKey));
  assert.throws(() => readPurchaseReceipt(receipt, randomUUID()));
  assert.throws(() => readPurchaseReceipt(purchaseReceipt({ ...order, createdAt: new Date(0) }), order.idempotencyKey));
  assert.equal(purchaseAllowed({ number: "TT-PRUEBA-test", createdAt: new Date() }), false);
  process.env.META_TEST_EVENT_CODE = "TEST_MOCK";
  assert.equal(purchaseAllowed({ number: "TT-PRUEBA-test", createdAt: new Date() }), true);
});
test("endpoint Purchase ignores forged totals and PII, retrieves immutable buyer snapshot and deduplicates", async () => {
  configure(); ledger(); const c = context();
  const order = { id: "order1", idempotencyKey: c.event_id, number: "TT-real", createdAt: new Date(), total: 199800, address: { buyer: person, city: person.city, state: person.state } };
  stub(db.order, "findUnique", async () => order);
  let calls = 0;
  mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    calls++; const e = JSON.parse(init.body as string).data[0];
    assert.deepEqual(e.custom_data, { currency: "COP", value: 199800 });
    assert.deepEqual(e.user_data.fn, [metaHash("ana maría")]);
    return Response.json({ events_received: 1 });
  });
  const input = { ...c, event_name: "Purchase", receipt: purchaseReceipt(order), value: 1, person: { firstName: "Forged" } };
  assert.equal((await POST(request(input))).status, 200);
  assert.equal((await POST(request(input))).status, 200); assert.equal(calls, 1);
});
test("endpoint rejects unconfirmed purchases, other origins and consent=false without external requests", async () => {
  configure(); mock.method(globalThis, "fetch", async () => assert.fail("Must not send"));
  const c = context();
  assert.equal((await POST(request({ ...c, event_name: "Purchase", receipt: "forged" }))).status, 403);
  assert.equal((await POST(request({ ...c, event_name: "InitiateCheckout" }, "https://evil.test"))).status, 403);
  assert.equal((await POST(request({ ...c, event_name: "InitiateCheckout", consent: false }))).status, 400);
});
test("missing config disables sending and non-2xx responses are sanitized", async () => {
  configure(); ledger(); delete process.env.META_CAPI_ACCESS_TOKEN;
  mock.method(globalThis, "fetch", async () => assert.fail("Not configured"));
  const input = { ...context(), event_name: "InitiateCheckout" };
  const disabled = await POST(request(input));
  assert.equal(disabled.status, 503);
  assert.deepEqual(await disabled.json(), { status: "disabled", code: "META_CONFIG_MISSING" });
  mock.restoreAll(); process.env.META_CAPI_ACCESS_TOKEN = "test-not-a-real-secret";
  mock.method(globalThis, "fetch", async () => Response.json({ error: { message: "PRIVATE-TOKEN-DATA" } }, { status: 400 }));
  const response = await POST(request(input)); assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { status: "failed" });
});

test("runtime Meta variables are trimmed and Graph diagnostics never expose response messages or token", async () => {
  configure(); ledger();
  process.env.NEXT_PUBLIC_META_PIXEL_ID = " 123456789 ";
  process.env.META_CAPI_ACCESS_TOKEN = " secret-token ";
  process.env.META_TEST_EVENT_CODE = " TEST87719 ";
  process.env.META_CLIENT_IP_HEADER = " X-Forwarded-For ";
  assert.deepEqual(metaConfig(), { pixelId: "123456789", accessToken: "secret-token", testEventCode: "TEST87719", ipHeader: "x-forwarded-for" });
  const logs: unknown[][] = [];
  mock.method(console, "warn", (...args: unknown[]) => logs.push(args));
  mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    assert.equal(JSON.parse(init.body as string).test_event_code, "TEST87719");
    return Response.json({ error: { code: 190, error_subcode: 463, message: "secret-token personal-data" } }, { status: 400 });
  });
  assert.equal(await sendMetaEvent(buildMetaEvent("InitiateCheckout", request({}), context())), "failed");
  assert.ok(logs.some(row => row[1] === "GRAPH_REJECTED"));
  assert.equal(JSON.stringify(logs).includes("secret-token"), false);
  assert.equal(JSON.stringify(logs).includes("personal-data"), false);
});

test("checkout confirms an existing idempotent order even when Meta database fails, without creating orders or Telegram messages", async () => {
  configure(); process.env.CHECKOUT_ENABLED = "true"; process.env.TELEGRAM_NOTIFICATIONS_ENABLED = "true";
  process.env.DATABASE_URL = "mysql://mock:mock@localhost/mock";
  const c = context();
  const input = checkoutSchema.parse({ firstName: "Ana", lastName: "Cruz", phone: "3041234567", email: "", state: "BOGOTÁ, D.C.", city: "BOGOTÁ, D.C.", address: "Calle 12 # 15-30", complement: "Casa", additionalNotes: "", requestedDate: "", items: [{ productId: "p", quantity: 1 }], promotionCode: "", idempotencyKey: c.event_id, consent: true });
  const { idempotencyKey, ...canonical } = input;
  const order = { id: "order1", idempotencyKey, requestHash: metaHash(JSON.stringify(canonical)), number: "TT-existing", status: "PENDIENTE", createdAt: new Date(), total: 99900, address: { buyer: input, state: input.state, city: input.city } };
  stub(db.siteSetting, "findUnique", async ({ where }: { where: { key: string } }) => {
    if (where.key === "store") return { value: { legalName: "Titular", address: "Dirección", contactEmail: "test@example.com", whatsapp: "573041234567", policiesApproved: true, privacy: "p", terms: "t", shipping: "s", returns: "r" } };
    if (where.key === "telegram-binding") return { value: { chatId: "123456", adminId: "admin", linkedAt: "2026-01-01", testSentAt: "2026-01-01", receiptConfirmed: true } };
    return { value: true };
  });
  stub(db.order, "findUnique", async () => order);
  stub(db.order, "create", async () => assert.fail("Do not create orders"));
  stub(db.metaEvent, "upsert", async () => { throw Error("Simulated Meta ledger outage"); });
  mock.method(globalThis, "fetch", async () => assert.fail("No external calls"));
  const response = await checkoutPOST(request({ ...input, meta: c }));
  const json = await response.json();
  assert.equal(response.status, 201, JSON.stringify(json));
  assert.equal(json.total, 99900); assert.equal(json.number, order.number);
  assert.equal(json.meta.eventId, idempotencyKey);
  assert.equal(readPurchaseReceipt(json.meta.receipt, idempotencyKey), order.id);
  assert.equal((await checkoutPOST(request({ ...input, phone: "123", meta: c }))).status, 400);
});
