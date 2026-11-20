import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin, currentAdminSession, rateLimit } from "@/lib/auth";
import { AppError, failure, readBody, sameOrigin } from "@/lib/http";
import { checkoutReadiness } from "@/lib/checkout-readiness";
import { binding, dispatchNotification, notifyOrder, queueMessage } from "@/services/telegram/notifications";
import { createTelegramLink } from "@/services/telegram/link";
import { telegram, TelegramError } from "@/services/telegram/client";
import { dailyMessage } from "@/lib/telegram-format";
export async function GET() {
  try {
    await requireAdmin();
    const target = await binding();
    let bot: { username?: string; error?: string } = {};
    try { bot = await telegram<{ username: string }>("getMe"); } catch (e) { bot = { error: e instanceof TelegramError ? e.code : "BOT_UNAVAILABLE" }; }
    const notifications = await db.notification.findMany({ where: { channel: "TELEGRAM" }, orderBy: { createdAt: "desc" }, take: 30,
      select: { id: true, orderId: true, event: true, status: true, attempts: true, lastError: true, sentAt: true, createdAt: true, parts: { select: { id: true, position: true, status: true, startedAt: true, lastError: true } } } });
    return NextResponse.json({ bot: { username: bot.username, error: bot.error }, linked: Boolean(target), chatMasked: target ? `••••${target.chatId.slice(-4)}` : null,
      linkedAt: target?.linkedAt, testSentAt: target?.testSentAt, receiptConfirmed: target?.receiptConfirmed, readiness: await checkoutReadiness(), notifications,
      environment: { checkout: process.env.CHECKOUT_ENABLED === "true", notifications: process.env.TELEGRAM_NOTIFICATIONS_ENABLED === "true", dropiPaused: true, cronConfigured: Boolean(process.env.CRON_SECRET), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, utcOffsetMinutes: new Date().getTimezoneOffset() } }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return failure(e); }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req); const session = await currentAdminSession(); if (!session) throw new AppError(401, "Inicia sesión.");
    await rateLimit(`telegram-admin:${session.adminId}`, 20, 60);
    const input = z.object({ action: z.enum(["link", "unlink", "test", "daily-test", "confirm-receipt", "retry", "resolve-sent", "resolve-retry", "activate", "deactivate", "privacy-reviewed"]), id: z.string().max(100).optional() }).parse(await readBody(req));
    let result: unknown = { ok: true };
    if (input.action === "privacy-reviewed") { await db.siteSetting.upsert({ where: {key:"telegram-privacy-reviewed"}, create:{key:"telegram-privacy-reviewed",value:true}, update:{value:true} }); }
    else if (input.action === "link") result = await createTelegramLink(session);
    else if (input.action === "unlink") {
      await db.$transaction(async tx => {
        await tx.siteSetting.deleteMany({ where: { key: "telegram-binding" } });
        await tx.telegramLinkCode.updateMany({ where: { usedAt: null }, data: { usedAt: new Date() } });
        await tx.siteSetting.upsert({ where: { key: "checkout-v5" }, create: { key: "checkout-v5", value: false }, update: { value: false } });
      });
    } else if (input.action === "test" || input.action === "daily-test") {
      const target = await binding(); if (!target) throw new AppError(409, "Vincula tu Telegram primero.");
      const n = await queueMessage(`test:${randomUUID()}`, input.action === "test" ? "TEST" : "DAILY_TEST", input.action === "test" ? "✅ PRUEBA TECNOTOP\nEl bot está listo para notificar las compras. Confirma en el panel que recibiste este mensaje." : `PRUEBA — No modifica el envío diario\n\n${dailyMessage()}`, "TECNOTOP · PRUEBA");
      const delivery = await dispatchNotification(n.id); result = delivery;
      if (delivery.sent && input.action === "test") await db.siteSetting.update({ where: { key: "telegram-binding" }, data: { value: { ...target, testSentAt: new Date().toISOString(), receiptConfirmed: false } } });
    } else if (input.action === "confirm-receipt") {
      const target = await binding(); if (!target?.testSentAt) throw new AppError(409, "Primero envía la prueba.");
      await db.siteSetting.update({ where: { key: "telegram-binding" }, data: { value: { ...target, receiptConfirmed: true } } });
    } else if (input.action === "activate" || input.action === "deactivate") {
      const ready = await checkoutReadiness();
      if (input.action === "activate" && !ready.ready) throw new AppError(409, `Pendiente: ${ready.missing.join("; ")}`);
      await db.siteSetting.upsert({ where: { key: "checkout-v5" }, create: { key: "checkout-v5", value: input.action === "activate" }, update: { value: input.action === "activate" } });
    } else if (input.action === "retry") {
      if (!input.id) throw new AppError(400, "Selecciona una notificación.");
      const n = await db.notification.findUniqueOrThrow({ where: { id: input.id } });
      if (n.channel !== "TELEGRAM") throw new AppError(400, "Notificación inválida.");
      result = n.event === "ORDER_RECEIVED" ? await notifyOrder(n.orderId) : await dispatchNotification(n.id);
    } else {
      if (!input.id) throw new AppError(400, "Selecciona una parte.");
      // A stale in-flight send also needs explicit reconciliation, never an automatic retry.
      const changed = await db.notificationPart.updateMany({ where: { id: input.id, OR: [{ status: "UNKNOWN" }, { status: "SENDING", startedAt: { lt: new Date(Date.now() - 120000) } }] },
        data: { status: input.action === "resolve-sent" ? "SENT" : "PENDING", lastError: null, ...(input.action === "resolve-sent" ? { sentAt: new Date() } : {}) } });
      if (!changed.count) throw new AppError(409, "La parte no requiere revisión o sigue en curso.");
    }
    await db.auditLog.create({ data: { adminId: session.adminId, action: `TELEGRAM_${input.action}`, entityId: input.id ?? "telegram" } });
    return NextResponse.json(result);
  } catch (e) { return e instanceof TelegramError ? NextResponse.json({ error: e.code }, { status: 502 }) : failure(e); }
}
