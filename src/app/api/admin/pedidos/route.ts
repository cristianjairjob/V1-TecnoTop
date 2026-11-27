import { NextResponse } from "next/server";
import { OrderStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin, rateLimit } from "@/lib/auth";
import { AppError, failure, sameOrigin, readBody } from "@/lib/http";
import { orderUpdateSchema } from "@/lib/order-management";
import { normalizedPhone } from "@/lib/whatsapp";
import { deleteAdminOrder, deleteOrderSchema, dispatchOrderSchema, setOrderDispatch } from "@/lib/admin-order-actions";
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const query = new URL(req.url).searchParams;
    const search = (query.get("q") || "").trim().slice(0, 100), status = query.get("status"), id = query.get("id");
    const page = Math.max(0, Math.min(100000, Math.floor(Number(query.get("page")) || 0)));
    if (status && !Object.values(OrderStatus).includes(status as OrderStatus)) throw new AppError(400, "Estado inválido.");
    const where: Prisma.OrderWhereInput = { ...(id ? { id } : {}), ...(status ? { status: status as OrderStatus } : {}), ...(search ? { OR: [{ number: { contains: search } }, { customer: { name: { contains: search } } }, { customer: { phone: { contains: search } } }, ...(normalizedPhone(search) ? [{ customer: { phoneNormalized: normalizedPhone(search) } }] : [])] } : {}) };
    const orders = await db.order.findMany({ where, skip: id ? 0 : page * 30, take: id ? 1 : 30, orderBy: { createdAt: query.get("sort") === "asc" ? "asc" : "desc" },
      include: { customer: true, items: true, events: { orderBy: { createdAt: "asc" } }, ...(id ? { shipments: true } : {}) } });
    const history = id ? await db.auditLog.findMany({ where: { entityId: id, action: { startsWith: "ORDER_ADMIN:" } }, orderBy: { createdAt: "asc" } }) : [];
    return NextResponse.json({ orders, history, page }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return failure(e); }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req); const admin = await requireAdmin(); await rateLimit(`order-admin:${admin.id}`, 40, 60);
    const input = orderUpdateSchema.parse(await readBody(req));
    await db.$transaction(async tx => {
      const order = await tx.order.findUniqueOrThrow({ where: { id: input.id } });
      if (order.status !== input.status) {
        await tx.order.update({ where: { id: input.id }, data: { status: input.status } });
        await tx.trackingEvent.create({ data: { orderId: input.id, status: input.status, source: "TECNOTOP", detail: `Estado del pedido: ${input.status}.` } });
      }
      // Observations are admin-only: never publish them in the customer's tracking history.
      await tx.auditLog.create({ data: { adminId: admin.id, entityId: input.id, action: `ORDER_ADMIN:${JSON.stringify({ from: order.status, to: input.status, observation: input.observation })}` } });
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ ok: true });
  } catch (e) { return failure(e); }
}
export async function PATCH(req: Request) {
  try {
    sameOrigin(req); const admin = await requireAdmin(); await rateLimit(`order-admin:${admin.id}`, 40, 60);
    const input = dispatchOrderSchema.parse(await readBody(req));
    return NextResponse.json(await setOrderDispatch(admin.id, input));
  } catch (e) { return failure(e); }
}
export async function DELETE(req: Request) {
  try {
    sameOrigin(req); const admin = await requireAdmin(); await rateLimit(`order-admin:${admin.id}`, 40, 60);
    const input = deleteOrderSchema.parse(await readBody(req));
    await deleteAdminOrder(admin.id, input.id);
    return NextResponse.json({ ok: true, id: input.id });
  } catch (e) { return failure(e); }
}
