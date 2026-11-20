import { db } from "@/lib/db";
import { colombiaDate, dailyMessage, orderTelegramMessage, splitTelegramMessage } from "@/lib/telegram-format";
import { telegram, TelegramError } from "./client";
export type Binding = { chatId: string; adminId: string; linkedAt: string; testSentAt?: string; receiptConfirmed?: boolean };
export async function binding(): Promise<Binding | null> {
  const setting = await db.siteSetting.findUnique({ where: { key: "telegram-binding" } });
  const value = setting?.value as unknown as Binding | undefined;
  return value && /^[1-9]\d{0,15}$/.test(value.chatId ?? "") ? value : null;
}
export async function queueMessage(orderId: string, event: string, text: string, reference: string) {
  return db.notification.upsert({
    where: { orderId_channel_event: { orderId, channel: "TELEGRAM", event } }, update: {},
    create: { orderId, channel: "TELEGRAM", event, status: "PENDING", parts: { create: splitTelegramMessage(text, reference).map((text, position) => ({ text, position })) } },
  });
}
export async function dispatchNotification(id: string) {
  const target = await binding();
  if (!target || process.env.TELEGRAM_NOTIFICATIONS_ENABLED !== "true") return { sent: false, reason: "NOT_LINKED_OR_DISABLED" };
  const notification = await db.notification.findUniqueOrThrow({ where: { id }, include: { parts: { orderBy: { position: "asc" } } } });
  if (notification.status === "SENT") return { sent: true };
  await db.notification.update({ where: { id }, data: { attempts: { increment: 1 } } });
  for (const part of notification.parts) {
    if (part.status === "SENT") continue;
    if (part.status !== "PENDING") return { sent: false, reason: "REVIEW_REQUIRED" };
    const claimed = await db.notificationPart.updateMany({ where: { id: part.id, status: "PENDING" }, data: { status: "SENDING", startedAt: new Date(), attempts: { increment: 1 } } });
    if (!claimed.count) return { sent: false, reason: "IN_PROGRESS" };
    try {
      const result = await telegram<{ message_id: number }>("sendMessage", { chat_id: target.chatId, text: part.text, protect_content: false, link_preview_options: { is_disabled: true } });
      if (!Number.isInteger(result.message_id)) throw new TelegramError("TELEGRAM_RESULT_UNKNOWN", true);
      await db.notificationPart.update({ where: { id: part.id }, data: { status: "SENT", messageId: String(result.message_id), sentAt: new Date(), lastError: null } });
    } catch (error) {
      // Telegram has no idempotency key. A timeout cannot be retried safely without checking the chat.
      const uncertain = !(error instanceof TelegramError) || error.uncertain;
      const code = error instanceof TelegramError ? error.code : "DELIVERY_RESULT_UNKNOWN";
      await db.notificationPart.update({ where: { id: part.id }, data: { status: uncertain ? "UNKNOWN" : "PENDING", lastError: code } });
      await db.notification.update({ where: { id }, data: { status: uncertain ? "UNKNOWN" : "PENDING", lastError: code } });
      return { sent: false, reason: code };
    }
  }
  await db.notification.update({ where: { id }, data: { status: "SENT", sentAt: new Date(), lastError: null } });
  return { sent: true };
}
export async function notifyOrder(orderId: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { customer: true, items: true } });
  const existing = await db.notification.findUnique({ where: { orderId_channel_event: { orderId, channel: "TELEGRAM", event: "ORDER_RECEIVED" } }, include: { parts: true } });
  if (!existing) return;
  if (!existing.parts.length) {
    const texts = splitTelegramMessage(orderTelegramMessage(order), order.number);
    await db.notificationPart.createMany({ data: texts.map((text, position) => ({ notificationId: existing.id, text, position })), skipDuplicates: true });
  }
  return dispatchNotification(existing.id);
}
export async function sendDaily(now = new Date()) {
  const date = colombiaDate(now);
  const n = await queueMessage(`daily:${date}`, "DAILY", dailyMessage(now), `TECNOTOP ${date}`);
  return dispatchNotification(n.id);
}
