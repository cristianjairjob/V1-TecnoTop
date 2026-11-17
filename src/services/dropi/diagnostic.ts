import { isIP } from "node:net";
import { authentication } from "./authentication";
import { DropiError } from "./errors";

// Authenticated admin diagnostic: one catalog query, no imports or orders.
export async function diagnoseDropi() {
  const base = new URL(process.env.DROPI_API_URL || "https://api.dropi.co/integrations/");
  if (base.origin !== "https://api.dropi.co" || base.pathname !== "/integrations/")
    throw new DropiError("INVALID_DROPI_URL", 503);
  const response = await fetch(new URL("products/index", base), {
    method: "POST", headers: authentication(),
    body: JSON.stringify({ pageSize: 1, startData: 0, no_count: true }),
    redirect: "error", cache: "no-store", signal: AbortSignal.timeout(18000),
  });
  const body = await response.json().catch(() => null);
  const ip = typeof body?.ip === "string" && isIP(body.ip) ? body.ip : null;
  return {
    connected: response.ok && body?.isSuccess === true && Array.isArray(body?.objects),
    httpStatus: response.status,
    accessDenied: body?.message === "Access denied",
    observedIp: ip,
    checkedAt: new Date().toISOString(),
    checkoutEnabled: process.env.CHECKOUT_ENABLED === "true",
    ordersEnabled: process.env.DROPI_ORDERS_ENABLED === "true",
  };
}
