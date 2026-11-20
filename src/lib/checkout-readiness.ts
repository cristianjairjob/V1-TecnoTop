import { storeSettings } from "./catalog";
import { db } from "./db";
import { binding } from "@/services/telegram/notifications";
export async function checkoutReadiness() {
  const [store, telegram, activation] = await Promise.all([storeSettings(), binding(), db.siteSetting.findUnique({ where: { key: "checkout-v5" } })]);
  const privacy = await db.siteSetting.findUnique({ where: { key: "telegram-privacy-reviewed" } });
  const missing: string[] = [];
  if (privacy?.value !== true) missing.push("Revisión del tratamiento de datos mediante Telegram");
  if (!store.legalName?.trim()) missing.push("Nombre del titular");
  if (!store.address?.trim()) missing.push("Dirección de contacto del titular");
  if (!store.contactEmail?.trim() || !store.whatsapp?.trim()) missing.push("Contacto del titular");
  if (!store.policiesApproved || !store.privacy?.trim() || !store.terms?.trim() || !store.shipping?.trim() || !store.returns?.trim()) missing.push("Políticas revisadas y completas");
  if (!telegram) missing.push("Telegram privado vinculado");
  if (!telegram?.testSentAt || !telegram.receiptConfirmed) missing.push("Notificación de prueba recibida y confirmada");
  if (process.env.TELEGRAM_NOTIFICATIONS_ENABLED !== "true") missing.push("TELEGRAM_NOTIFICATIONS_ENABLED=true");
  if (process.env.CHECKOUT_ENABLED !== "true") missing.push("CHECKOUT_ENABLED=true");
  const approved = activation?.value === true;
  return { ready: missing.length === 0, enabled: approved && missing.length === 0, approved, missing };
}
