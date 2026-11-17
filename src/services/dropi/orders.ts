import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError } from "@/lib/http";
import { dropiRequest } from "./client";
import { DropiError } from "./errors";
import { safePayload } from "./types";
import { z } from "zod";
import { buildDropiOrderPayload } from "./order-payload";
export async function sendOrder(orderId: string) {
  if (process.env.DROPI_ORDERS_ENABLED !== "true")
    return { sent: false, reason: "DISABLED" };
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true, customer: true, dropi: true },
  });
  if (order.dropi?.originalId) return { sent: true };
  if (order.dropi?.outcome === "UNKNOWN" || order.dropi?.outcome === "SENDING")
    throw new AppError(
      409,
      "El resultado debe conciliarse en Dropi antes de cualquier reintento.",
    );
  // Validate before claiming: incomplete legacy orders must not become SENDING.
  const payload = buildDropiOrderPayload(order);
  const claimed = await db.order.updateMany({
    where: { id: orderId, status: { in: ["PENDIENTE", "ERROR_DROPI"] } },
    data: { status: "ENVIANDO_A_DROPI" },
  });
  if (!claimed.count)
    throw new AppError(409, "El pedido ya está en procesamiento.");
  await db.dropiOrder.upsert({
    where: { orderId },
    create: { orderId, outcome: "SENDING", attemptedAt: new Date() },
    update: { outcome: "SENDING", attemptedAt: new Date() },
  });
  try {
    // Never retry this POST automatically; a timeout may hide a successfully created order.
    const response = await dropiRequest(
      "orders/myorders",
      "POST",
      payload,
      false,
    );
    const parsed = z
      .object({ id: z.union([z.string(), z.number()]) })
      .passthrough()
      .safeParse(response);
    if (!parsed.success)
      throw new DropiError("DROPI_ORDER_RESPONSE_UNKNOWN", 502, true);
    await db.$transaction([
      db.dropiOrder.update({
        where: { orderId },
        data: {
          originalId: String(parsed.data.id),
          outcome: "ACCEPTED",
          response: safePayload(response) as Prisma.InputJsonValue,
          errorCode: null,
        },
      }),
      db.order.update({
        where: { id: orderId },
        data: { status: "ACEPTADO_POR_DROPI" },
      }),
      db.trackingEvent.create({
        data: {
          orderId,
          status: "ACEPTADO_POR_DROPI",
          detail: "Orden aceptada por Dropi.",
          source: "DROPI_RESPONSE",
        },
      }),
    ]);
    return { sent: true };
  } catch (e) {
    const uncertain = !(e instanceof DropiError) || e.uncertain;
    await db.$transaction([
      db.dropiOrder.update({
        where: { orderId },
        data: {
          outcome: uncertain ? "UNKNOWN" : "REJECTED",
          errorCode: e instanceof DropiError ? e.code : "ORDER_RESULT_UNKNOWN",
        },
      }),
      db.order.update({
        where: { id: orderId },
        data: { status: "ERROR_DROPI" },
      }),
    ]);
    return { sent: false, reason: uncertain ? "UNKNOWN" : "REJECTED" };
  }
}
