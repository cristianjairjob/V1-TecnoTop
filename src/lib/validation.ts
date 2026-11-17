import { z } from "zod";
import { deliverySchema, requestedDeliveryDateSchema } from "./delivery";
export const phoneSchema = z
  .string()
  .transform((v) => v.replace(/[\s()+-]/g, "").replace(/^57(?=3\d{9}$)/, ""))
  .pipe(
    z
      .string()
      .regex(/^3\d{9}$/, "Escribe un celular colombiano de 10 dígitos."),
  );
export const cartSchema = z
  .array(
    z.object({
      productId: z.string().min(1).max(100),
      variantId: z.string().max(100).optional(),
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
  email: z.email().max(180),
  state: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
  address: z.string().trim().min(8).max(200),
  complement: z.string().trim().min(1).max(200),
  establishment: deliverySchema.shape.establishment,
  reference: deliverySchema.shape.reference,
  requestedDate: requestedDeliveryDateSchema,
  items: cartSchema,
  promotionCode: z.string().max(50).default(""),
  idempotencyKey: z.uuid(),
  consent: z.literal(true),
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
