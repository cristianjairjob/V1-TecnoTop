import { addBusinessDays, isBusinessDay } from "./business-days";
import { z } from "zod";

export function bogotaToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function minimumDeliveryDate(now = new Date()): string {
  return addBusinessDays(bogotaToday(now), 5);
}

export const isoDateSchema = z.iso.date();
export function formatDeliveryDate(value: string): string {
  if (!isoDateSchema.safeParse(value).success) return "Sin registrar";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

const singleLine = (max: number) => z.string().trim().min(1, "Este campo es obligatorio.")
  .max(max).regex(/^[^\r\n\u2028\u2029]+$/, "Escribe la información en una sola línea.");
// Stored dates remain valid after delivery; only checkout rejects past dates.
const legacyDeliverySchema = z.object({
  establishment: singleLine(160),
  reference: singleLine(300),
  requestedDate: isoDateSchema,
});
export const optionalStoredDateSchema = z.union([isoDateSchema, z.literal("")]).default("");
export const currentDeliverySchema = z.object({
  version: z.literal(2),
  additionalNotes: z.string().trim().max(1000).default(""),
  requestedDate: optionalStoredDateSchema,
});
export const deliverySchema = z.union([currentDeliverySchema, legacyDeliverySchema]);
export const requestedDeliveryDateSchema = optionalStoredDateSchema.refine(
  (value) => !value || (value >= minimumDeliveryDate() && isBusinessDay(value)),
  "Selecciona una fecha con al menos 5 días hábiles de anticipación, sin sábados, domingos ni festivos por el tiempo de entrega de la transportadora (hora de Colombia).",
);

export function buildDeliveryNotes(delivery: z.infer<typeof deliverySchema>, number: string): string {
  const data = deliverySchema.parse(delivery);
  if ("version" in data) {
    return `NOTAS ADICIONALES: ${data.additionalNotes || "Sin indicaciones adicionales"}.\n\nFECHA SOLICITADA DE ENTREGA: ${data.requestedDate ? formatDeliveryDate(data.requestedDate) : "Sin fecha solicitada"}.\n\nPEDIDO TECNOTOP: ${number}.`;
  }
  return `LOCAL: ${data.establishment}.\n\nREFERENCIA: ${data.reference}.\n\nFECHA SOLICITADA DE ENTREGA: ${formatDeliveryDate(data.requestedDate)}.\n\nPEDIDO TECNOTOP: ${number}.`;
}
