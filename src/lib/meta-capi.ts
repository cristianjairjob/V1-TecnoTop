// Server module: never import into a client component.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { db } from "./db";
import { normalizedPhone } from "./whatsapp";
import { AppError } from "./http";
import type { MetaContext, MetaEventName } from "./meta-schema";
import { metaConfig } from "./meta-config";

// Deliberately exclude messages, stacks, request URLs, tokens and customer data.
export function metaDiagnostic(code: string, details: Record<string, number | boolean> = {}) {
  console.warn("[meta-capi]", code, details);
}

type Person = { email?: string; phone?: string; firstName?: string; lastName?: string; city?: string; state?: string };
export type MetaEvent = {
  event_name: MetaEventName; event_id: string; event_time: number;
  action_source: "website"; event_source_url: string;
  user_data: Record<string, string | string[]>;
  custom_data?: { currency: "COP"; value: number };
};
export function metaConfigured() {
  const config = metaConfig();
  return /^\d+$/.test(config.pixelId) && Boolean(config.accessToken);
}
export const normalizeMetaText = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
export const metaHash = (s: string) => createHash("sha256").update(s).digest("hex");
export function metaUserData(name: MetaEventName, req: Request, context: MetaContext, person: Person = {}) {
  const data: Record<string, string | string[]> = {};
  const ua = req.headers.get("user-agent");
  if (ua) data.client_user_agent = ua.slice(0, 1024);
  // Only use a header overwritten by the trusted reverse proxy. Never accept an IP from the JSON body.
  const header = metaConfig().ipHeader;
  const ip = header ? req.headers.get(header)?.split(",")[0].trim() : undefined;
  if (ip && isIP(ip)) data.client_ip_address = ip;
  if (context.fbp) data.fbp = context.fbp;
  if (context.fbc) data.fbc = context.fbc;
  if (name === "InitiateCheckout") return data;
  for (const [field, value] of [["em", person.email], ["fn", person.firstName], ["ln", person.lastName]] as const) {
    if (value?.trim()) data[field] = [metaHash(normalizeMetaText(value))];
  }
  const national = person.phone ? normalizedPhone(person.phone) : null;
  if (national) data.ph = [metaHash(`57${national}`)];
  if (name === "Purchase") {
    for (const [field, value] of [["ct", person.city], ["st", person.state]] as const) {
      if (value?.trim()) data[field] = [metaHash(normalizeMetaText(value))];
    }
  }
  return data;
}
export function buildMetaEvent(name: MetaEventName, req: Request, context: MetaContext, person?: Person, value?: number): MetaEvent {
  const url = new URL(context.event_source_url);
  if (url.origin !== new URL(process.env.APP_URL || req.url).origin) throw new AppError(400, "URL del evento inválida.");
  // Query strings and fragments can contain form data; they are not sent to Meta.
  url.search = ""; url.hash = ""; url.username = ""; url.password = "";
  if (name === "Purchase" && (!Number.isFinite(value) || value! < 0)) throw new AppError(400, "Total inválido.");
  return {
    event_name: name, event_id: context.event_id, event_time: Math.floor(Date.now() / 1000),
    action_source: "website", event_source_url: url.toString(),
    user_data: metaUserData(name, req, context, person),
    ...(name === "Purchase" ? { custom_data: { currency: "COP" as const, value: value! } } : {}),
  };
}

export async function sendMetaEvent(event: MetaEvent): Promise<"sent" | "pending" | "disabled" | "failed"> {
  if (!metaConfigured()) { metaDiagnostic("CONFIG_MISSING"); return "disabled"; }
  const id = `${event.event_name}:${event.event_id}`;
  // The ledger stores no buyer details, IPs, cookies, tokens or payloads.
  const entry = await db.metaEvent.upsert({ where: { id }, update: {}, create: { id } }).catch(error => {
    metaDiagnostic("LEDGER_UNAVAILABLE"); throw error;
  });
  if (entry.sentAt) return "sent";
  const now = new Date();
  const claim = await db.metaEvent.updateMany({
    where: { id, sentAt: null, OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] },
    data: { lockedUntil: new Date(now.getTime() + 30_000) },
  });
  if (!claim.count) return "pending";
  event = { ...event, event_time: Math.floor(entry.createdAt.getTime() / 1000) };
  const { pixelId: pixel, accessToken: token, testEventCode } = metaConfig();
  const url = `https://graph.facebook.com/v21.0/${pixel}/events?access_token=${encodeURIComponent(token)}`;
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
          signal: AbortSignal.timeout(2500),
          body: JSON.stringify({ data: [event], ...(testEventCode ? { test_event_code: testEventCode } : {}) }),
        });
        const body = await response.json();
        if (response.ok && body.events_received === 1) {
          await db.metaEvent.update({ where: { id }, data: { sentAt: new Date(), lockedUntil: null } });
          if (testEventCode) metaDiagnostic("TEST_EVENT_ACCEPTED", { eventsReceived: 1, hasIp: Boolean(event.user_data.client_ip_address) });
          return "sent";
        }
        metaDiagnostic("GRAPH_REJECTED", { httpStatus: response.status,
          ...(Number.isInteger(body?.error?.code) ? { graphCode: body.error.code } : {}),
          ...(Number.isInteger(body?.error?.error_subcode) ? { graphSubcode: body.error.error_subcode } : {}) });
        if (response.status < 500 && response.status !== 429) break;
      } catch { metaDiagnostic("SEND_OR_ACK_FAILED", { attempt: attempt + 1 }); }
    }
    return "failed";
  } finally {
    await db.metaEvent.updateMany({ where: { id, sentAt: null }, data: { lockedUntil: null } });
  }
}

function signature(value: string) {
  return createHmac("sha256", metaConfig().accessToken).update(value).digest("hex");
}
export function purchaseReceipt(order: { id: string; idempotencyKey: string; createdAt: Date }) {
  const body = Buffer.from(JSON.stringify({ orderId: order.id, eventId: order.idempotencyKey, expires: Math.floor(order.createdAt.getTime() / 1000) + 86400 })).toString("base64url");
  return `${body}.${signature(body)}`;
}
export function readPurchaseReceipt(receipt: string, eventId: string) {
  const [body, mac, extra] = receipt.split(".");
  if (!metaConfigured() || !body || !/^[a-f0-9]{64}$/.test(mac || "") || extra) throw new AppError(403, "Comprobante inválido.");
  if (!timingSafeEqual(Buffer.from(mac, "hex"), Buffer.from(signature(body), "hex"))) throw new AppError(403, "Comprobante inválido.");
  const data = JSON.parse(Buffer.from(body, "base64url").toString()) as { orderId: string; eventId: string; expires: number };
  if (data.eventId !== eventId || data.expires < Date.now() / 1000) throw new AppError(403, "Comprobante vencido o inválido.");
  return data.orderId;
}
export function purchaseAllowed(order: { number: string; createdAt: Date }) {
  return Date.now() - order.createdAt.getTime() < 86400_000 && (!order.number.includes("PRUEBA") || Boolean(metaConfig().testEventCode));
}
export function orderMetaPerson(address: unknown): Person {
  const data = address as { buyer?: Person; city?: string; state?: string } | null;
  return { ...data?.buyer, city: data?.city, state: data?.state };
}
