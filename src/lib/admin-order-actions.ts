import { z } from "zod";
import { OrderStatus } from "@prisma/client";
import { db } from "./db";
import { AppError } from "./http";

const id = z.string().min(1).max(100);
export const dispatchOrderSchema = z.object({ id, expectedStatus: z.enum(OrderStatus), status: z.enum(["PENDIENTE", "DESPACHADO"]) });
export const deleteOrderSchema = z.object({ id, confirm: z.literal(true) });

export async function setOrderDispatch(adminId: string, input: z.infer<typeof dispatchOrderSchema>) {
  return db.$transaction(async tx => {
    const changed = await tx.order.updateMany({ where: { id: input.id, status: input.expectedStatus }, data: { status: input.status } });
    if (!changed.count) throw new AppError(409, "El pedido cambió o ya no existe. Actualiza la lista.");
    if (input.status !== input.expectedStatus) {
      await tx.trackingEvent.create({ data: { orderId: input.id, status: input.status, source: "TECNOTOP", detail: `Estado del pedido: ${input.status}.` } });
      await tx.auditLog.create({ data: { adminId, entityId: input.id, action: `ORDER_ADMIN:${JSON.stringify({ from: input.expectedStatus, to: input.status, observation: "Cambio desde la lista de pedidos" })}` } });
    }
    return { id: input.id, status: input.status };
  }, { isolationLevel: "Serializable" });
}

export async function deleteAdminOrder(adminId: string, orderId: string) {
  await db.$transaction(async tx => {
    const order = await tx.order.findUnique({ where: { id: orderId }, select: { id: true } });
    if (!order) throw new AppError(404, "El pedido ya no existe.");
    // Delete children first: historical foreign keys do not all cascade.
    await tx.notificationPart.deleteMany({ where: { notification: { orderId } } });
    await tx.notification.deleteMany({ where: { orderId } });
    await tx.dropiOrder.deleteMany({ where: { orderId } });
    await tx.shipment.deleteMany({ where: { orderId } });
    await tx.trackingEvent.deleteMany({ where: { orderId } });
    await tx.orderItem.deleteMany({ where: { orderId } });
    await tx.order.delete({ where: { id: orderId } });
    await tx.auditLog.create({ data: { adminId, entityId: orderId, action: "ORDER_ADMIN_DELETE:Pedido eliminado desde administración" } });
    // Keep customer, inventory and conversion deduplication ledger unchanged.
  }, { isolationLevel: "Serializable" });
}
