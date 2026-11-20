import { normalizedPhone } from "./whatsapp";
import { z } from "zod";
import { currentDeliverySchema, requestedDeliveryDateSchema } from "./delivery";
import { isColombiaLocation } from "./colombia-locations";
export const optionalEmailSchema = z.string().trim().pipe(z.union([z.email().max(180), z.literal("")])).default("");
export const phoneSchema = z.string().max(40).refine(v => normalizedPhone(v) !== null, "Escribe un celular colombiano válido.");
export const cartSchema = z
  .array(
    z.object({
      productId: z.string().min(1).max(100),
      variantId: z.string().max(100).optional(),
      unitColors: z.array(z.string().max(50)).max(20).optional(),
      quantity: z.number().int().min(1).max(20),
    }),
  )
  .min(1)
  .max(40)
  .superRefine((items, ctx) => {
    const keys = items.map((i) => `${i.productId}:${i.variantId ?? ""}`);
    if (new Set(keys).size !== keys.length)
      ctx.addIssue({ code: "custom", message: "Productos duplicados." });
  });
export const checkoutSchema = z.object({
  firstName: z.string().trim().min(1, "Los nombres son obligatorios.").max(80),
  lastName: z.string().trim().min(1, "Los apellidos son obligatorios.").max(80),
  phone: phoneSchema,
  email: optionalEmailSchema,
  state: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
  address: z.string().trim().min(8).max(200),
  complement: z.string().trim().min(1).max(200),
  additionalNotes: currentDeliverySchema.shape.additionalNotes,
  requestedDate: requestedDeliveryDateSchema,
  items: cartSchema,
  promotionCode: z.string().max(50).default(""),
  idempotencyKey: z.uuid(),
  consent: z.literal(true),
}).refine((input) => isColombiaLocation(input.state, input.city), {
  path: ["city"], message: "Selecciona una ciudad o municipio del departamento indicado.",
});
export function discountAmount(subtotal: number, percent: number) {
  return Math.round(subtotal * Math.min(100, Math.max(0, percent))) / 100;
}
export function publishable(
  p: {
    name: string;
    description: string;
    images: unknown;
    categoryId: string | null;
    salePrice: unknown;
    stock: number;
  },
  variants: { active: boolean; salePrice: unknown }[] = [],
) {
  return Boolean(
    p.name.trim() &&
    p.description.trim() &&
    Array.isArray(p.images) &&
    p.images.length &&
    p.categoryId &&
    Number(p.salePrice) > 0 &&
    p.stock >= 0 &&
    variants.filter((v) => v.active).every((v) => Number(v.salePrice) > 0),
  );
}
