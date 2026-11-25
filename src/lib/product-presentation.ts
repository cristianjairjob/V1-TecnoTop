import { z } from "zod";
import { stockSchema } from "./product-stock";
export const defaultHighlights = ["Envío gratis a todo Colombia", "Compra con pago contraentrega", "Elige tu variante y cantidad disponible"];
export const highlightsSchema = z.array(z.string().max(200)).length(3);
export const displayStockSchema = stockSchema.nullable();
export function productHighlights(value: unknown): string[] {
 const parsed = highlightsSchema.safeParse(value);
 return parsed.success ? parsed.data : [...defaultHighlights];
}
