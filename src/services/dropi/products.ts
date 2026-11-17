import { z } from "zod";
import { dropiRequest } from "./client";
import { productSchema } from "./types";
import { DropiError } from "./errors";
export async function listDropiProducts(
  offset = 0,
  pageSize = 25,
  keywords = "",
) {
  const data = await dropiRequest("products/index", "POST", {
    startData: offset,
    pageSize,
    order_type: "desc",
    order_by: "id",
    keywords,
    active: true,
    no_count: true,
    integration: true,
    get_stock: false,
  });
  const parsed = z.array(productSchema).safeParse(data);
  if (!parsed.success) throw new DropiError("DROPI_INVALID_PRODUCTS");
  return parsed.data;
}
export async function getDropiProduct(id: string) {
  if (!/^\d+$/.test(id)) throw new DropiError("INVALID_PRODUCT_ID", 400);
  const parsed = productSchema.safeParse(
    await dropiRequest(`products/v2/${id}`, "GET"),
  );
  if (!parsed.success) throw new DropiError("DROPI_INVALID_PRODUCT");
  return parsed.data;
}
