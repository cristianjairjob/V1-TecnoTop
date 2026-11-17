import { DropiError } from "./errors";
// The reference verifies calculate_costs_and_shiping on order creation, not a quote endpoint.
export async function quoteShipping(): Promise<never> {
  throw new DropiError("SHIPPING_ENDPOINT_NOT_VERIFIED", 501);
}
export const customerShippingCost = 0;
