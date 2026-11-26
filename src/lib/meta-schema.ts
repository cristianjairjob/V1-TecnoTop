import { z } from "zod";
import { normalizedPhone } from "./whatsapp";

export const metaContextSchema = z.object({
  consent: z.literal(true),
  event_id: z.uuid(),
  event_source_url: z.url().max(2048),
  fbp: z.string().regex(/^fb\.\d+\.\d+\.[\w-]+$/).max(250).optional(),
  fbc: z.string().regex(/^fb\.\d+\.\d+\.[\w-]+$/).max(500).optional(),
});
export const metaPersonSchema = z.object({
  email: z.string().trim().max(180).pipe(z.union([z.email(), z.literal("")])).optional(),
  phone: z.string().max(40).refine(value => normalizedPhone(value) !== null, "Teléfono inválido."),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
});
export const metaRequestSchema = z.discriminatedUnion("event_name", [
  metaContextSchema.extend({ event_name: z.literal("InitiateCheckout") }),
  metaContextSchema.extend({ event_name: z.literal("AddPaymentInfo"), person: metaPersonSchema }),
  metaContextSchema.extend({ event_name: z.literal("Purchase"), receipt: z.string().max(600) }),
]);
export type MetaContext = z.infer<typeof metaContextSchema>;
export type MetaEventName = "InitiateCheckout" | "AddPaymentInfo" | "Purchase";
