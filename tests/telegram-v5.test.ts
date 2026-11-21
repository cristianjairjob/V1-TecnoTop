import { test, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { hash } from "../src/lib/auth";
import { whatsappUrl, normalizedPhone } from "../src/lib/whatsapp";
import { colombiaDate, dailyMessage, orderTelegramMessage, splitTelegramMessage } from "../src/lib/telegram-format";
import { binding, dispatchNotification, sendDaily } from "../src/services/telegram/notifications";
import { consumeTelegramLink, createTelegramLink } from "../src/services/telegram/link";
import { POST as webhook } from "../src/app/api/telegram/webhook/route";
import { POST as cron } from "../src/app/api/cron/telegram-daily/route";
const originalEnv = { ...process.env };
const restores: (() => void)[] = [];
function stub(target: object, key: string, fn: unknown) { const t = target as Record<string, unknown>; const old = t[key]; t[key] = fn; restores.push(() => { t[key] = old; }); }
afterEach(() => { restores.splice(0).reverse().forEach(f => f()); mock.restoreAll(); for (const key of ["TELEGRAM_BOT_TOKEN", "TELEGRAM_NOTIFICATIONS_ENABLED", "TELEGRAM_WEBHOOK_SECRET", "TELEGRAM_CHAT_ID", "CRON_SECRET", "APP_URL"]) { if (originalEnv[key] === undefined) delete process.env[key]; else process.env[key] = originalEnv[key]; } });
function setup() { process.env.TELEGRAM_BOT_TOKEN = "mock-token"; process.env.TELEGRAM_NOTIFICATIONS_ENABLED = "true"; process.env.TELEGRAM_WEBHOOK_SECRET = "mock-secret"; process.env.APP_URL = "https://tecnotop.com.co"; }
const target = { chatId: "123456789", adminId: "admin", linkedAt: "2026-01-01" };
test("WhatsApp normaliza solo el enlace, sin duplicar el prefijo", () => {
  for (const input of ["3045939644", "+57 304 593 9644", "573045939644"]) assert.equal(whatsappUrl(input), "https://wa.me/573045939644");
  assert.equal(normalizedPhone("+57 304 593 9644"), "3045939644");
  for (const invalid of ["0", "123", "57573045939644", "<script>"]) assert.equal(whatsappUrl(invalid), null);
});
test("medianoche colombiana y mensaje en español independientemente del servidor", () => {
  assert.equal(colombiaDate(new Date("2026-11-20T04:59:59Z")), "2026-11-19");
  assert.equal(colombiaDate(new Date("2026-11-20T05:00:00Z")), "2026-11-20");
  assert.match(dailyMessage(new Date("2026-11-20T05:00:00Z")), /viernes, 20 de noviembre de 2026/);
});
test("mensaje completo desde el pedido guardado conserva teléfono, color, promo y notas opcionales", () => {
  const text = orderTelegramMessage({ number: "TT-TEST", createdAt: new Date("2026-11-20T05:00:00Z"), customer: { name: "Ana Pérez", firstName: "Ana", lastName: "Pérez", phone: "+57 304 593 9644", email: "" }, address: { state: "Antioquia", city: "Medellín", address: "Calle 12 # 15-30", complement: "Casa 2", delivery: {} }, pricingSnapshot: { isTest: true, baseSubtotal: 320000, savings: 140000 }, subtotal: 180000, discount: 0, shipping: 0, total: 180000, promotionCode: "PRUEBA", items: [{ name: "Producto azul", quantity: 2, unitPrice: 90000, snapshot: { variant: "Azul", colors: ["Azul", "Negro"], offer: "Combo pareja" } }] });
  for (const expected of ["PEDIDO DE PRUEBA", "NO DESPACHAR", "+57 304 593 9644", "SIN NOTAS", "NO ESPECIFICADA", "Combo pareja", "Azul, Negro", "GRATIS", "PRUEBA", "https://wa.me/573045939644", "CONTRAENTREGA", "Calle 12 # 15-30"]) assert.ok(text.includes(expected));
});
test("divide mensajes por campos enteros, conserva referencia y numeración", () => {
  const lines = Array.from({ length: 30 }, (_, i) => `Producto ${i}: ${"a".repeat(200)}`);
  const parts = splitTelegramMessage(lines.join("\n"), "TT-LONG");
  assert.ok(parts.length > 1); for (const [i, part] of parts.entries()) { assert.ok(part.length <= 4096); assert.match(part, new RegExp(`TT-LONG · Parte ${i + 1}/${parts.length}`)); }
  for (const line of lines) assert.equal(parts.filter(p => p.includes(line)).length, 1);
});
test("chat provisional 0 nunca es destinatario, tampoco por variable de entorno", async () => {
  setup(); process.env.TELEGRAM_CHAT_ID = "0";
  stub(db.siteSetting, "findUnique", async () => ({ value: { chatId: "0" } }));
  mock.method(globalThis, "fetch", async () => assert.fail("No enviar a 0"));
  assert.equal(await binding(), null); assert.equal((await dispatchNotification("x")).sent, false);
});
test("webhook y cron rechazan secretos ausentes o incorrectos antes de tocar MySQL", async () => {
  setup(); process.env.CRON_SECRET = "correct";
  assert.equal((await webhook(new Request("https://tecnotop.com.co/api/telegram/webhook", { method: "POST", headers: { "x-telegram-bot-api-secret-token": "wrong" } }))).status, 401);
  assert.equal((await cron(new Request("https://tecnotop.com.co/api/cron/telegram-daily", { method: "POST" }))).status, 401);
});
test("vinculación consume código válido una vez y exige sesión activa y chat privado", async () => {
  setup(); process.env.TELEGRAM_NOTIFICATIONS_ENABLED = "false";
  const code = "a".repeat(32); let used = false; let stored: unknown = null;
  stub(db, "$transaction", async (fn: (tx: typeof db) => unknown) => fn(db));
  stub(db.telegramLinkCode, "findUnique", async ({ where }: { where: { codeHash: string } }) => { assert.equal(where.codeHash, hash(code)); return { id: "code", adminId: "admin", sessionId: "session", usedAt: used ? new Date() : null, expiresAt: new Date(Date.now() + 60000) }; });
  stub(db.adminSession, "findUnique", async () => ({ adminId: "admin", admin: { active: true }, expiresAt: new Date(Date.now() + 60000) }));
  stub(db.siteSetting, "findUnique", async () => stored);
  stub(db.telegramLinkCode, "updateMany", async () => { if (used) return { count: 0 }; used = true; return { count: 1 }; });
  stub(db.siteSetting, "upsert", async ({ create }: { create: unknown }) => { stored = create; return create; });
  stub(db.auditLog, "create", async () => ({})); stub(db.notification, "upsert", async () => ({ id: "confirmation" }));
  assert.equal(await consumeTelegramLink(code, "123456789", false), false);
  assert.equal(await consumeTelegramLink(code, "0", true), false);
  assert.equal(await consumeTelegramLink(code, "123456789", true), true);
  assert.equal(await consumeTelegramLink(code, "123456789", true), false);
});
test("código vencido o sesión revocada no vincula", async () => {
  setup(); stub(db, "$transaction", async (fn: (tx: typeof db) => unknown) => fn(db));
  stub(db.telegramLinkCode, "findUnique", async () => ({ expiresAt: new Date(0), usedAt: null }));
  assert.equal(await consumeTelegramLink("a".repeat(32), "1234", true), false);
  stub(db.telegramLinkCode, "findUnique", async () => ({ expiresAt: new Date(Date.now() + 60000), usedAt: null, sessionId: "revoked" }));
  stub(db.adminSession, "findUnique", async () => null);
  assert.equal(await consumeTelegramLink("a".repeat(32), "1234", true), false);
});
test("no reemplaza un webhook de otra integración", async () => {
  setup(); stub(db.siteSetting, "findUnique", async () => null); let setWebhook = 0;
  mock.method(globalThis, "fetch", async (url: string | URL | Request) => { const method = String(url).split("/").at(-1); if (method === "setWebhook") setWebhook++; return new Response(JSON.stringify({ ok: true, result: method === "getMe" ? { username: "TestBot" } : { url: "https://other.example/webhook" } })); });
  await assert.rejects(createTelegramLink({ id: "s", adminId: "a" }), /otro webhook/); assert.equal(setWebhook, 0);
});
test("enlace almacena solo hash y vence a los cinco minutos", async () => {
  setup(); stub(db.siteSetting, "findUnique", async () => null); let saved: { codeHash: string; expiresAt: Date; sessionId: string } | undefined;
  stub(db, "$transaction", async (fn: (tx: typeof db) => unknown) => fn(db)); stub(db.telegramLinkCode, "updateMany", async () => ({ count: 0 }));
  stub(db.telegramLinkCode, "create", async ({ data }: { data: typeof saved }) => { saved = data; return data; });
  mock.method(globalThis, "fetch", async (url: string | URL | Request) => new Response(JSON.stringify({ ok: true, result: String(url).endsWith("getMe") ? { username: "TestBot" } : { url: "" } })));
  const link = await createTelegramLink({ id: "session", adminId: "admin" }); const code = new URL(link.url).searchParams.get("start")!;
  assert.equal(saved?.codeHash, hash(code)); assert.equal(saved?.sessionId, "session"); assert.ok(saved!.expiresAt.getTime() - Date.now() <= 300000); assert.ok(saved!.expiresAt.getTime() - Date.now() > 290000);
});
type Part = { id: string; position: number; text: string; status: string; attempts: number };
function notificationMocks() {
  setup(); const parts: Part[] = [0, 1].map(i => ({ id: `p${i}`, position: i, text: `TT-TEST · Parte ${i + 1}/2`, status: "PENDING", attempts: 0 }));
  const notification = { id: "n", status: "PENDING", parts };
  stub(db.siteSetting, "findUnique", async () => ({ value: target }));
  stub(db.notification, "findUniqueOrThrow", async () => notification);
  stub(db.notification, "update", async ({ data }: { data: { status?: string } }) => { if (data.status) notification.status = data.status; return notification; });
  stub(db.notificationPart, "updateMany", async ({ where }: { where: { id: string } }) => { const p = parts.find(p => p.id === where.id)!; if (p.status !== "PENDING") return { count: 0 }; p.status = "SENDING"; return { count: 1 }; });
  stub(db.notificationPart, "update", async ({ where, data }: { where: { id: string }; data: { status: string } }) => { Object.assign(parts.find(p => p.id === where.id)!, data); return {}; });
  return { notification, parts };
}
test("reintento de error explícito envía solo la parte pendiente; doble dispatch no duplica", async () => {
  const { notification, parts } = notificationMocks(); const sent: string[] = []; let fail = true;
  mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => { const body = JSON.parse(String(init.body)); assert.equal(body.chat_id, target.chatId); assert.equal(body.protect_content, false); assert.equal(body.parse_mode, undefined); sent.push(body.text); if (body.text.includes("2/2") && fail) return new Response(JSON.stringify({ ok: false, error_code: 429 }), { status: 429 }); return new Response(JSON.stringify({ ok: true, result: { message_id: sent.length } })); });
  assert.equal((await dispatchNotification("n")).sent, false); assert.equal(parts[0].status, "SENT"); assert.equal(parts[1].status, "PENDING");
  fail = false; assert.equal((await dispatchNotification("n")).sent, true); assert.equal(notification.status, "SENT");
  await dispatchNotification("n"); assert.equal(sent.filter(s => s.includes("1/2")).length, 1); assert.equal(sent.length, 3);
});
test("timeout queda UNKNOWN y nunca se reenvía automáticamente", async () => {
  const { parts } = notificationMocks(); let calls = 0;
  mock.method(globalThis, "fetch", async () => { calls++; throw Error("Network timeout with sensitive token must never be logged"); });
  await dispatchNotification("n"); await dispatchNotification("n"); assert.equal(calls, 1); assert.equal(parts[0].status, "UNKNOWN");
});
test("dos envíos concurrentes reclaman cada parte una sola vez", async () => {
  notificationMocks(); let calls = 0;
  mock.method(globalThis, "fetch", async () => { calls++; return new Response(JSON.stringify({ ok: true, result: { message_id: calls } })); });
  await Promise.all([dispatchNotification("n"), dispatchNotification("n")]); assert.equal(calls, 2);
});
test("mensaje diario usa clave única por fecha colombiana", async () => {
  setup(); process.env.TELEGRAM_NOTIFICATIONS_ENABLED = "false"; const ids = new Set<string>();
  stub(db.siteSetting, "findUnique", async () => null);
  stub(db.notification, "upsert", async ({ create }: { create: { orderId: string; event: string } }) => { assert.equal(create.event, "DAILY"); ids.add(create.orderId); return { id: create.orderId }; });
  await sendDaily(new Date("2026-11-20T05:00:00Z")); await sendDaily(new Date("2026-11-20T23:59:00Z"));
  assert.deepEqual([...ids], ["daily:2026-11-20"]);
});
