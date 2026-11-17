import { z } from "zod";

export function bogotaToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
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
export const deliverySchema = z.object({
  establishment: singleLine(160),
  reference: singleLine(300),
  requestedDate: isoDateSchema,
});
export const requestedDeliveryDateSchema = isoDateSchema.refine(
  (value) => value >= bogotaToday(),
  "La fecha solicitada no puede estar en el pasado (hora de Colombia).",
);

export function buildDeliveryNotes(delivery: z.infer<typeof deliverySchema>, number: string): string {
  const data = deliverySchema.parse(delivery);
  return `LOCAL: ${data.establishment}.\n\nREFERENCIA: ${data.reference}.\n\nFECHA SOLICITADA DE ENTREGA: ${formatDeliveryDate(data.requestedDate)}.\n\nPEDIDO TECNOTOP: ${number}.`;
}
