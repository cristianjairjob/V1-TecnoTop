import { z } from "zod";

export const directCheckoutSchema = z.object({
  product: z.string().min(1).max(100),
  variant: z.string().min(1).max(100).optional(),
  quantity: z.coerce.number().int().min(1).max(20).default(1),
});
export function directCheckoutUrl(productId: string, quantity: number, variantId?: string) {
  const selection = directCheckoutSchema.parse({ product: productId, quantity, variant: variantId || undefined });
  const params = new URLSearchParams({ product: selection.product, quantity: String(selection.quantity) });
  if (selection.variant) params.set("variant", selection.variant);
  return `/checkout?${params.toString()}`;
}
