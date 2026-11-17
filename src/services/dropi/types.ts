import { z } from "zod";
const id = z
  .union([z.string().min(1), z.number().int().nonnegative()])
  .transform(String);
const money = z.coerce.number().finite().nonnegative();
const stock = z.coerce.number().int().nonnegative();
export const variantSchema = z
  .object({
    id,
    sku: z.string().nullish(),
    stock: stock.optional(),
    sale_price: money.optional(),
    supplier_price: money.optional(),
    suggested_price: money.optional(),
    attribute_values: z
      .array(
        z.object({
          attribute_name: z.string(),
          value: z.union([z.string(), z.number()]),
        }),
      )
      .optional(),
    warehouse_product_variation: z.array(z.object({ stock })).optional(),
  })
  .passthrough();
export const productSchema = z
  .object({
    id,
    name: z.string().min(1),
    description: z.string().nullish(),
    type: z.string().optional(),
    user_id: id.optional(),
    sale_price: money.optional(),
    supplier_price: money.optional(),
    suggested_price: money.optional(),
    stock: stock.optional(),
    gallery: z
      .array(
        z.object({ url: z.string().optional(), urlS3: z.string().optional() }),
      )
      .optional(),
    variations: z.array(variantSchema).optional(),
    warehouse_product: z.array(z.object({ stock })).optional(),
  })
  .passthrough();
export type DropiProductData = z.infer<typeof productSchema>;
export function safePayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(safePayload);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            !/token|password|secret|authorization|email|phone/i.test(key),
        )
        .map(([key, v]) => [key, safePayload(v)]),
    );
  return value;
}
