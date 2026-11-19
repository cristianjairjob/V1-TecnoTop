import { Prisma } from "@prisma/client";
import { z } from "zod";
import { AppError } from "@/lib/http";
import { buildDeliveryNotes, deliverySchema } from "@/lib/delivery";
import { phoneSchema, optionalEmailSchema } from "@/lib/validation";

const addressSchema = z.object({
  state: z.string().trim().min(2), city: z.string().trim().min(2),
  address: z.string().trim().min(8), complement: z.string().trim().min(1),
  buyer: z.object({
    firstName: z.string().trim().min(1), lastName: z.string().trim().min(1),
    phone: phoneSchema, email: optionalEmailSchema,
  }),
  delivery: deliverySchema,
});
type OrderForDropi = Prisma.OrderGetPayload<{ include: { items: true; customer: true } }>;

export function buildDropiOrderPayload(order: OrderForDropi) {
  const parsed = addressSchema.safeParse(order.address);
  if (!parsed.success || !order.deliveryNotes?.trim())
    throw new AppError(409, "El pedido no tiene todos los datos de comprador y entrega. Requiere revisión; no se enviará a Dropi.");
  const address = parsed.data;
  if (order.deliveryNotes !== buildDeliveryNotes(address.delivery, order.number))
    throw new AppError(409, "Las notas guardadas no coinciden con los datos del pedido. Requiere revisión.");
  return {
    total_order: Number(order.total),
    // Send the persisted text verbatim, including the internal order number.
    notes: order.deliveryNotes,
    name: address.buyer.firstName,
    surname: address.buyer.lastName,
    dir: `${address.address} ${address.complement}`.trim(),
    country: "CO", state: address.state, city: address.city,
    phone: address.buyer.phone, client_email: address.buyer.email,
    payment_method_id: 1, status: "PENDIENTE CONFIRMACION", type: "FINAL_ORDER",
    rate_type: "CON RECAUDO",
    products: order.items.map((i) => ({
      ...(i.snapshot as object), id: i.dropiId, name: i.name,
      quantity: i.quantity, price: Number(i.unitPrice),
      ...(i.dropiVariantId ? { variation_id: i.dropiVariantId } : {}),
      token: process.env.DROPI_API_TOKEN,
    })),
    calculate_costs_and_shiping: true,
    supplier_id: order.items[0].supplierId,
    shop_order_id: order.number,
    create_product_if_not_exist: false,
  };
}
