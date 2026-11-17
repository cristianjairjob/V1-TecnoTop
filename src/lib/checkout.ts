import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { checkoutSchema, cartSchema } from "./validation";
import { AppError } from "./http";
import { hash } from "./auth";
import { storeSettings } from "./catalog";
import { getDropiProduct } from "@/services/dropi/products";
import { productStock } from "@/services/dropi/inventory";
import { safePayload } from "@/services/dropi/types";
import { sendOrder } from "@/services/dropi/orders";
export async function quote(items: z.infer<typeof cartSchema>, code = "") {
  const products = await db.product.findMany({
    where: {
      id: { in: items.map((i) => i.productId) },
      status: "PUBLISHED",
      category: { visible: true },
    },
    include: { variants: true, dropi: true },
  });
  const lines = items.map((i) => {
    const p = products.find((p) => p.id === i.productId);
    if (!p) throw new AppError(409, "Un producto ya no está disponible.");
    const v = i.variantId
      ? p.variants.find((v) => v.id === i.variantId && v.active)
      : undefined;
    if (
      (i.variantId && !v) ||
      (!i.variantId && p.variants.some((v) => v.active))
    )
      throw new AppError(400, "Selecciona una variante válida.");
    const price = Number(v?.salePrice ?? p.salePrice);
    if (price <= 0) throw new AppError(409, "Producto sin precio confirmado.");
    if ((v?.stock ?? p.stock) < i.quantity)
      throw new AppError(409, `No hay suficiente inventario de ${p.name}.`);
    return { ...i, product: p, variant: v, unitPrice: price };
  });
  const subtotal = lines.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const promotion = code
    ? await db.promotion.findUnique({
        where: { code: code.trim().toUpperCase() },
      })
    : null;
  if (
    code &&
    (!promotion ||
      !promotion.active ||
      promotion.startsAt > new Date() ||
      promotion.endsAt < new Date() ||
      subtotal < Number(promotion.minimum))
  )
    throw new AppError(400, "El cupón no es válido para este pedido.");
  const discountedLines = lines.map((l) => ({
    ...l,
    effectiveUnitPrice:
      Math.round(
        (l.unitPrice * 100 * (100 - (promotion?.percent ?? 0))) / 100,
      ) / 100,
  }));
  const total =
    discountedLines.reduce(
      (n, l) => n + Math.round(l.effectiveUnitPrice * 100) * l.quantity,
      0,
    ) / 100;
  const discount = Math.round((subtotal - total) * 100) / 100;
  return {
    lines: discountedLines,
    subtotal,
    discount,
    shipping: 0,
    total,
    promotion,
  };
}
export async function checkout(input: z.infer<typeof checkoutSchema>) {
  if (process.env.CHECKOUT_ENABLED !== "true")
    throw new AppError(
      503,
      "Estamos preparando la tienda. Las compras todavía no están habilitadas.",
    );
  if (!(await storeSettings()).policiesApproved)
    throw new AppError(
      503,
      "La tienda aún no está habilitada para recibir pedidos.",
    );
  const { idempotencyKey, ...canonical } = input;
  const requestHash = hash(JSON.stringify(canonical));
  const existing = await db.order.findUnique({ where: { idempotencyKey } });
  if (existing) {
    if (existing.requestHash !== requestHash)
      throw new AppError(409, "Esta solicitud ya fue utilizada.");
    return existing;
  }
  const q = await quote(input.items, input.promotionCode);
  if (new Set(q.lines.map((l) => l.product.supplierId)).size !== 1)
    throw new AppError(
      409,
      "Por ahora, selecciona productos del mismo proveedor en cada pedido.",
    );
  for (const l of q.lines) {
    if (!l.product.dropiId || !l.product.supplierId)
      throw new AppError(409, "Producto pendiente de verificación.");
    const live = await getDropiProduct(l.product.dropiId);
    const variant = l.variant
      ? live.variations?.find((v) => v.id === l.variant!.dropiId)
      : undefined;
    const stock = l.variant
      ? (variant?.warehouse_product_variation?.reduce(
          (n, w) => n + w.stock,
          0,
        ) ??
        variant?.stock ??
        0)
      : productStock(live);
    if (stock < l.quantity)
      throw new AppError(
        409,
        `El inventario de ${l.product.name} cambió. Actualiza tu carrito.`,
      );
  }
  // Discounts are allocated per line; the sum of Dropi prices must equal total_order.
  let order;
  try {
    order = await db.$transaction(
      async (tx) => {
        for (const l of q.lines) {
          const p = await tx.product.findUniqueOrThrow({
            where: { id: l.productId },
            include: { category: true, variants: true },
          });
          if (
            p.status !== "PUBLISHED" ||
            !p.category?.visible ||
            Number(p.salePrice) !== Number(l.product.salePrice)
          )
            throw new AppError(
              409,
              "El catálogo cambió. Actualiza tu carrito.",
            );
          if (l.variant) {
            const v = p.variants.find((v) => v.id === l.variantId);
            if (!v?.active || Number(v.salePrice) !== l.unitPrice)
              throw new AppError(
                409,
                "La variante cambió. Actualiza tu carrito.",
              );
          }
          const result = l.variantId
            ? await tx.productVariant.updateMany({
                where: { id: l.variantId, stock: { gte: l.quantity } },
                data: { stock: { decrement: l.quantity } },
              })
            : await tx.product.updateMany({
                where: { id: l.productId, stock: { gte: l.quantity } },
                data: { stock: { decrement: l.quantity } },
              });
          if (!result.count)
            throw new AppError(
              409,
              "El inventario cambió. Actualiza tu carrito.",
            );
        }
        const customer = await tx.customer.create({
          data: { name: input.name, email: input.email, phone: input.phone },
        });
        return tx.order.create({
          data: {
            number: `TT-${randomBytes(6).toString("hex").toUpperCase()}`,
            idempotencyKey,
            requestHash,
            customerId: customer.id,
            address: {
              state: input.state,
              city: input.city,
              address: input.address,
              complement: input.complement,
            },
            subtotal: q.subtotal,
            discount: q.discount,
            total: q.total,
            shipping: 0,
            promotionCode: q.promotion?.code,
            privacyVersion: "v1",
            items: {
              create: q.lines.map((l) => ({
                productId: l.product.id,
                variantId: l.variant?.id,
                dropiId: l.product.dropiId,
                dropiVariantId: l.variant?.dropiId,
                name: `${l.product.name}${l.variant ? " · " + l.variant.name : ""}`,
                quantity: l.quantity,
                unitPrice: l.effectiveUnitPrice,
                supplierPrice:
                  l.variant?.supplierPrice ?? l.product.supplierPrice,
                supplierId: l.product.supplierId,
                snapshot: safePayload(
                  l.product.dropi?.payload ?? {},
                ) as Prisma.InputJsonValue,
              })),
            },
            events: {
              create: {
                status: "PENDIENTE",
                detail: "Pedido recibido en TecnoTop.",
                source: "TECNOTOP",
              },
            },
          },
        });
      },
      { isolationLevel: "Serializable", timeout: 15000 },
    );
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      const found = await db.order.findUnique({ where: { idempotencyKey } });
      if (found?.requestHash === requestHash) return found;
    }
    throw e;
  }
  await db.notification.createMany({
    data: ["EMAIL", "ADMIN", "WHATSAPP"].map((channel) => ({
      orderId: order.id,
      channel,
      event: "ORDER_RECEIVED",
    })),
  });
  await sendOrder(order.id);
  return order;
}
