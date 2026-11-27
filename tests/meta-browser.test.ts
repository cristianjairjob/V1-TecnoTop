import { test, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { initMetaPixel, metaConsent, metaPreference, metaContext, metaPageView, readMetaCookie, setMetaConsent, showMetaBanner, trackMetaAction } from "../src/lib/meta-browser";

const restore: (() => void)[] = [];
function globalValue(name: string, value: unknown) {
  const old = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, value });
  restore.push(() => { if (old) Object.defineProperty(globalThis, name, old); else Reflect.deleteProperty(globalThis, name); });
}
afterEach(() => { restore.splice(0).reverse().forEach(f => f()); mock.restoreAll(); });
function setup(accepted = true) {
  const values = new Map<string, string>();
  if (accepted) values.set("tecnotop-meta-consent-v1", "accepted");
  const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v) };
  globalValue("localStorage", storage); globalValue("sessionStorage", storage);
  const windowMock = { dispatchEvent() {}, fbq: undefined as undefined | ((...args: unknown[]) => void) & { queue: unknown[][] } };
  globalValue("window", windowMock);
  globalValue("location", { href: "https://tecnotop.com.co/checkout", origin: "https://tecnotop.com.co", pathname: "/checkout", protocol: "https:", hostname: "tecnotop.com.co" });
  const scripts: object[] = [];
  const doc = { cookie: "_fbp=fb.1.123.browser; _fbc=fb.1.456.click", createElement: () => ({}), head: { appendChild: (s: object) => scripts.push(s) } };
  globalValue("document", doc);
  return { values, scripts, windowMock, doc };
}
test("opt-out starts Pixel and CAPI without a saved decision; rejecting prevents all subsequent sends", async () => {
  const s = setup(false);
  let sends = 0;
  mock.method(globalThis, "fetch", async () => { sends++; return Response.json({ status: "sent" }); });
  initMetaPixel("123456789"); metaPageView(); await trackMetaAction("InitiateCheckout", randomUUID());
  assert.equal(s.scripts.length, 1); assert.ok(metaContext()); assert.equal(sends, 1); assert.equal(metaPreference(), "");
  setMetaConsent(false); metaPageView(); await trackMetaAction("InitiateCheckout", randomUUID());
  assert.equal(metaContext(), null); assert.equal(sends, 1);
  assert.deepEqual(s.windowMock.fbq?.queue.at(-1), ["consent", "revoke"]);
  setMetaConsent(true); initMetaPixel("123456789"); initMetaPixel("123456789"); metaPageView();
  assert.equal(s.scripts.length, 1);
  assert.equal(s.windowMock.fbq?.queue.filter(q => q[0] === "init").length, 1);
  assert.deepEqual(s.windowMock.fbq?.queue.at(-1), ["track", "PageView"]);
});
test("Pixel eventID matches backend event_id and PII is absent from browser Pixel", async () => {
  const s = setup(); initMetaPixel("123456789"); const id = randomUUID(); const bodies: Record<string, unknown>[] = [];
  mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => { bodies.push(JSON.parse(init.body as string)); return Response.json({ status: "sent" }); });
  const person = { firstName: "Ana", lastName: "Cruz", email: "ana@example.com", phone: "3041234567" };
  await trackMetaAction("AddPaymentInfo", id, { person });
  await trackMetaAction("AddPaymentInfo", id, { person });
  const pixel = s.windowMock.fbq!.queue.filter(q => q[1] === "AddPaymentInfo");
  assert.equal(pixel.length, 1); assert.deepEqual(pixel[0], ["track", "AddPaymentInfo", {}, { eventID: id }]);
  assert.equal(bodies[0].event_id, id); assert.equal(bodies[0].fbp, "fb.1.123.browser"); assert.deepEqual(bodies[0].person, person);
  assert.equal(JSON.stringify(pixel).includes("ana@example.com"), false);
});
test("Purchase Pixel uses authoritative response value and matching signed receipt; failed backend retries same ID", async () => {
  const s = setup(); initMetaPixel("123456789"); const id = randomUUID(); const bodies: object[] = [];
  mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => { bodies.push(JSON.parse(init.body as string)); return Response.json({}, { status: bodies.length === 1 ? 503 : 200 }); });
  await trackMetaAction("Purchase", id, { receipt: "signed-receipt", value: 199800 });
  assert.deepEqual(s.windowMock.fbq?.queue.at(-1), ["track", "Purchase", { currency: "COP", value: 199800 }, { eventID: id }]);
  assert.equal(bodies.length, 2); assert.deepEqual(bodies[0], bodies[1]);
  assert.equal("value" in bodies[0], false);
});
test("revoking stops subsequent events and malformed cookies are omitted", async () => {
  const s = setup(); initMetaPixel("123456789");
  s.doc.cookie = "_fbp=%ZZ; _fbc=not-a-meta-cookie";
  assert.equal(readMetaCookie("_fbp"), undefined); assert.equal(readMetaCookie("_fbc"), undefined);
  setMetaConsent(false); assert.equal(metaContext(), null);
  mock.method(globalThis, "fetch", async () => assert.fail("Revoked"));
  await trackMetaAction("InitiateCheckout", randomUUID());
  assert.deepEqual(s.windowMock.fbq?.queue.at(-1), ["consent", "revoke"]);
});
test("disabled cookie access does not interrupt a consented checkout context or withdrawal", () => {
  const s = setup(); initMetaPixel("123456789");
  Object.defineProperty(s.doc, "cookie", { configurable: true, get() { throw Error("Cookies disabled"); }, set() { throw Error("Cookies disabled"); } });
  const context = metaContext(randomUUID());
  assert.ok(context); assert.equal(context.fbp, undefined); assert.equal(context.fbc, undefined);
  assert.doesNotThrow(() => setMetaConsent(false));
  assert.equal(metaContext(), null);
});
test("invalid saved consent cannot hide the banner; blocked storage still accepts an explicit choice", () => {
  const s = setup();
  s.values.set("tecnotop-meta-consent-v1", "invalid");
  assert.equal(metaPreference(), "");
  assert.equal(metaConsent(), "accepted");
  globalValue("localStorage", { getItem() { throw Error("blocked"); }, setItem() { throw Error("blocked"); } });
  setMetaConsent(true); assert.equal(metaConsent(), "accepted");
  initMetaPixel("123456789"); assert.equal(s.scripts.length, 1);
  setMetaConsent(false); assert.equal(metaConsent(), "declined");
});
test("banner appears only on home without a decision", () => {
  assert.equal(showMetaBanner("/", ""), true);
  for (const route of ["/producto/a", "/checkout", "/admin", "/politicas"]) assert.equal(showMetaBanner(route, ""), false);
  for (const preference of ["accepted", "declined"]) assert.equal(showMetaBanner("/", preference), false);
});
