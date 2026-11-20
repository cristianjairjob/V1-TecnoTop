import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { hash } from "@/lib/auth";
import { AppError } from "@/lib/http";
import { telegram } from "./client";
import { binding, queueMessage, dispatchNotification } from "./notifications";

export async function createTelegramLink(session: { id: string; adminId: string }) {
  if (await binding()) throw new AppError(409, "Telegram ya está vinculado. Desvincúlalo primero si deseas cambiar de cuenta.");
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || !/^[A-Za-z0-9_-]{1,256}$/.test(secret)) throw new AppError(503, "Configura TELEGRAM_WEBHOOK_SECRET con letras, números, guiones o guion bajo.");
  const origin = new URL(process.env.APP_URL || "https://tecnotop.com.co");
  if (origin.protocol !== "https:") throw new AppError(503, "El webhook requiere HTTPS.");
  const url = `${origin.origin}/api/telegram/webhook`;
  const [bot, webhook] = await Promise.all([telegram<{ username: string }>("getMe"), telegram<{ url: string }>("getWebhookInfo")]);
  if (webhook.url && webhook.url !== url) throw new AppError(409, "Este bot tiene otro webhook. No se modificó: utiliza un bot exclusivo o revisa esa integración.");
  await telegram("setWebhook", { url, secret_token: secret, allowed_updates: ["message"] });
  const code = randomBytes(24).toString("base64url");
  await db.$transaction(async tx => {
    await tx.telegramLinkCode.updateMany({ where: { adminId: session.adminId, usedAt: null }, data: { usedAt: new Date() } });
    await tx.telegramLinkCode.create({ data: { codeHash: hash(code), adminId: session.adminId, sessionId: session.id, expiresAt: new Date(Date.now() + 300000) } });
  });
  return { url: `https://t.me/${bot.username}?start=${code}`, expiresIn: 300 };
}
export async function consumeTelegramLink(code: string, chatId: string, privateChat: boolean) {
  if (!privateChat || !/^[1-9]\d{0,15}$/.test(chatId) || !/^[\w-]{32}$/.test(code)) return false;
  const now = new Date();
  const linked = await db.$transaction(async tx => {
    const row = await tx.telegramLinkCode.findUnique({ where: { codeHash: hash(code) } });
    if (!row || row.usedAt || row.expiresAt <= now) return false;
    const session = await tx.adminSession.findUnique({ where: { id: row.sessionId }, include: { admin: true } });
    if (!session || session.adminId !== row.adminId || !session.admin.active || session.expiresAt <= now) return false;
    const existing = await tx.siteSetting.findUnique({ where: { key: "telegram-binding" } });
    if (existing?.value && typeof existing.value === "object" && "chatId" in existing.value) return false;
    const claimed = await tx.telegramLinkCode.updateMany({ where: { id: row.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
    if (!claimed.count) return false;
    const value = { chatId, adminId: row.adminId, linkedAt: now.toISOString() };
    await tx.siteSetting.upsert({ where: { key: "telegram-binding" }, create: { key: "telegram-binding", value }, update: { value } });
    await tx.auditLog.create({ data: { adminId: row.adminId, action: "TELEGRAM_LINKED", entityId: "telegram-binding" } });
    return true;
  }, { isolationLevel: "Serializable" });
  if (linked) {
    const n = await queueMessage(`link:${hash(code)}`, "LINKED", "✅ Telegram vinculado a TecnoTop. Recibirás las notificaciones privadas de la tienda. Vuelve al panel para probar la notificación.", "TECNOTOP");
    await dispatchNotification(n.id);
  }
  return linked;
}
