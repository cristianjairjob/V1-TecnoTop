import { money } from "./catalog-format";
import { formatDeliveryDate } from "./delivery";
import { whatsappUrl } from "./whatsapp";

type Json = Record<string, unknown>;
const object = (v: unknown): Json => v && typeof v === "object" && !Array.isArray(v) ? v as Json : {};
export function colombiaDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function dailyMessage(now = new Date()) {
  const date = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(now);
  return `🌙 ¡NUEVO DÍA EN TECNOTOP!\n\nHoy es ${date}.\n\n¡Que tengas un excelente día! 💙`;
}
// Plain text avoids HTML injection. Split only between complete lines/fields.
export function splitTelegramMessage(text: string, reference: string) {
  const chunks: string[] = []; let current = "";
  for (const line of text.split("\n")) {
    if (line.length > 3500) throw new Error("TELEGRAM_FIELD_TOO_LONG");
    if ((current + "\n" + line).length > 3500) { chunks.push(current); current = line; }
    else current += (current ? "\n" : "") + line;
  }
  if (current) chunks.push(current);
  return chunks.map((chunk, index) => `${reference} · Parte ${index + 1}/${chunks.length}\n\n${chunk}`);
}
export function orderTelegramMessage(order: {
  number: string; createdAt: Date; customer: { name: string; firstName: string | null; lastName: string | null; phone: string; email: string };
  address: unknown; pricingSnapshot?: unknown; subtotal: unknown; discount: unknown; shipping: unknown; total: unknown; promotionCode: string | null;
  items: { name: string; quantity: number; unitPrice: unknown; snapshot: unknown }[];
}) {
  const a = object(order.address), delivery = object(a.delivery), buyer = object(a.buyer), pricing = object(order.pricingSnapshot);
  const date = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "long", timeStyle: "short" }).format(order.createdAt);
  const phone = String(buyer.phone ?? order.customer.phone);
  const lines = ["🛒 NUEVA COMPRA — TECNOTOP", "", "PEDIDO:", order.number, date, "", "DATOS DEL CLIENTE:",
    `Nombres: ${buyer.firstName ?? order.customer.firstName ?? order.customer.name}`, `Apellidos: ${buyer.lastName ?? order.customer.lastName ?? "Sin registrar"}`,
    `Celular: ${phone}`, `Correo: ${buyer.email || order.customer.email || "NO ESPECIFICADO"}`, "", "DIRECCIÓN:",
    `Departamento: ${a.state}`, `Ciudad: ${a.city}`, `Dirección: ${a.address}`, `Información para transportadora: ${a.complement || "SIN INFORMACIÓN"}`,
    "", "NOTAS DE ENTREGA:", String(delivery.additionalNotes || "SIN NOTAS"),
    `Fecha solicitada: ${delivery.requestedDate ? formatDeliveryDate(String(delivery.requestedDate)) : "NO ESPECIFICADA"}`, "Fecha sujeta a confirmación de la transportadora.", "", "PRODUCTOS:"];
  for (const item of order.items) {
    const snapshot = object(item.snapshot);
    lines.push(item.name, `Variante: ${snapshot.variant || "Única"}`, `Promoción: ${snapshot.offer || "Individual"}`, `Cantidad: ${item.quantity}`,
      `Colores por unidad: ${Array.isArray(snapshot.colors) && snapshot.colors.length ? snapshot.colors.join(", ") : "No aplica"}`,
      `Precio unitario final: ${money(Number(item.unitPrice))}`, `Subtotal producto: ${money(Number(item.unitPrice) * item.quantity)}`, "");
  }
  lines.push("RESUMEN ECONÓMICO:", `Subtotal antes de descuentos: ${money(Number(pricing.baseSubtotal ?? order.subtotal))}`,
    `Descuentos: ${money(Number(pricing.savings ?? order.discount))}`, `Cupón: ${order.promotionCode || "NO APLICA"}`,
    `Envío: ${Number(order.shipping) === 0 ? "GRATIS" : money(Number(order.shipping))}`, `Total contraentrega: ${money(Number(order.total))}`,
    "", "MÉTODO DE PAGO: CONTRAENTREGA", "ESTADO: PENDIENTE DE GESTIÓN", "", "💬 CONTACTAR CLIENTE POR WHATSAPP", whatsappUrl(phone) || "Número sin enlace válido");
  return lines.join("\n");
}
