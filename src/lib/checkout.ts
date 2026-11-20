import { productColors } from "./product-colors";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { checkoutSchema, cartSchema } from "./validation";
import { AppError } from "./http";
import { hash } from "./auth";
import { checkoutReadiness } from "./checkout-readiness";
import { notifyOrder } from "@/services/telegram/notifications";
import { createOrderDetails } from "./order-details";
import { offerTotal, allocateUnitPrices, referenceLineTotal } from "./product-offers";
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
      (!i.variantId && p.variants.some((v) => v.active) && !productColors(p.colorOptions).length)
    )
      throw new AppError(400, "Selecciona una variante válida.");
    const price = Number(v?.salePrice ?? p.salePrice);
    if (price <= 0) throw new AppError(409, "Producto sin precio confirmado.");
    if ((v?.stock ?? p.stock) < i.quantity)
      throw new AppError(409, `No hay suficiente inventario de ${p.name}.`);
    const options = productColors(p.colorOptions);
    const unitPrices = Array.from({length:i.quantity},(_,n)=> {
      const color=options.find(c=>c.name===i.unitColors?.[n]);
      const variant=p.variants.find(v=>v.id===color?.variantId && v.active);
      return variant ? Number(variant.salePrice) : price;
    });
    if(unitPrices.some(p=>p<=0)) throw new AppError(409,"Color sin precio confirmado.");
    const originUnitSubtotal=unitPrices.reduce((sum,p)=>sum+p,0);
    const lineTotal = offerTotal(originUnitSubtotal/i.quantity, i.quantity, p);
    return { ...i, product: p, variant: v, unitPrice: price, lineTotal, originQuantity:i.quantity, originTotal:lineTotal, originUnitSubtotal };
  });
  const subtotal = Math.round(lines.reduce((s, i) => s + i.lineTotal, 0) * 100) / 100;
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
    effectiveTotal: Math.round(l.lineTotal * (100 - (promotion?.percent ?? 0))) / 100,
  }));
  const total =
    discountedLines.reduce(
      (n, l) => n + Math.round(l.effectiveTotal * 100),
      0,
    ) / 100;
  const discount = Math.round((subtotal - total) * 100) / 100;
  const baseSubtotal = Math.round(lines.reduce((sum, line) => sum + referenceLineTotal(line.originUnitSubtotal/line.quantity, line.product.previousPrice, line.quantity, line.lineTotal), 0) * 100) / 100;
  const savings = Math.round((baseSubtotal - total) * 100) / 100;
  return {
    lines: discountedLines,
    baseSubtotal,
    savings,
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
  if (!(await checkoutReadiness()).enabled)
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
  q.lines = q.lines.flatMap(line => {
    const colors=productColors(line.product.colorOptions);
    if(!colors.length) { if(line.unitColors?.some(Boolean)) throw new AppError(400,"Este producto no tiene colores configurados."); return [line]; }
    if(line.unitColors?.length!==line.quantity || line.unitColors.some(c=>!colors.some(v=>v.name===c))) throw new AppError(400,"Elige un color válido para cada unidad.");
    const selected=line.unitColors.map(name=> {const color=colors.find(c=>c.name===name)!; const variant=line.product.variants.find(v=>v.id===color.variantId && v.active); if(!variant) throw new AppError(409,"Color pendiente de vincular al inventario."); return {color,variant}; });
    for(const {variant} of selected) if(selected.filter(s=>s.variant.id===variant.id).length>variant.stock) throw new AppError(409,"No hay suficientes unidades del color elegido.");
    const amounts=allocateUnitPrices(line.effectiveTotal,line.quantity).flatMap(p=>Array(p.quantity).fill(p.unitPrice) as number[]);
    return selected.map(({color,variant},index)=>({...line,variant,variantId:variant.id,unitPrice:Number(variant.salePrice),quantity:1,unitColors:[color.name],effectiveTotal:amounts[index]}));
  });
  if (q.lines.some((line) => line.product.slug === "auriculares-demo-tecnotop"))
    throw new AppError(409, "Este es un producto de demostración. No permite confirmar pedidos.");
  let order;
  try {
    order = await db.$transaction(
      async (tx) => {
        if (q.promotion) {
          const promotion = await tx.promotion.findUnique({where:{code:q.promotion.code}});
          if (!promotion?.active || promotion.percent !== q.promotion.percent || promotion.startsAt > new Date() || promotion.endsAt < new Date() || Number(promotion.minimum) > q.subtotal) throw new AppError(409, "La promoción cambió. Actualiza tu pedido.");
        }
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
              "El catálogo cambió. Actualiza tu pedido.",
            );
          if (l.variant) {
            const v = p.variants.find((v) => v.id === l.variantId);
            if (!v?.active || Number(v.salePrice) !== l.unitPrice)
              throw new AppError(
                409,
                "La variante cambió. Actualiza tu pedido.",
              );
          }
          if (JSON.stringify(p.colorOptions) !== JSON.stringify(l.product.colorOptions)) throw new AppError(409,"Los colores cambiaron. Actualiza tu pedido.");
          if (offerTotal(l.originUnitSubtotal/l.originQuantity, l.originQuantity, p) !== l.originTotal)
            throw new AppError(409, "El precio del combo cambió. Actualiza tu pedido.");
          if (l.variantId) {
            const totalStock = await tx.product.updateMany({ where: { id: l.productId, stock: { gte: l.quantity } }, data: { stock: { decrement: l.quantity } } });
            if (!totalStock.count) throw new AppError(409, "El inventario cambió. Actualiza tu pedido.");
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
              "El inventario cambió. Actualiza tu pedido.",
            );
        }
        const number = `TT-${randomBytes(6).toString("hex").toUpperCase()}`;
        const details = createOrderDetails(input, number);
        const customer = await tx.customer.create({ data: details.customer });
        const saved = await tx.order.create({
          data: {
            number,
            idempotencyKey,
            requestHash,
            customerId: customer.id,
            address: details.address,
            deliveryNotes: details.deliveryNotes,
            subtotal: q.subtotal,
            discount: q.discount,
            total: q.total,
            shipping: 0,
            promotionCode: q.promotion?.code,
            privacyVersion: "v5-telegram",
            paymentMethod: "CONTRAENTREGA",
            pricingSnapshot: { baseSubtotal: q.baseSubtotal + input.items.reduce((n,i)=>n+i.quantity,0)*30000, savings: q.savings + input.items.reduce((n,i)=>n+i.quantity,0)*30000, productBaseSubtotal:q.baseSubtotal, productSavings:q.savings, shippingSavings:input.items.reduce((n,i)=>n+i.quantity,0)*30000 },
            items: {
              create: q.lines.flatMap((l) => allocateUnitPrices(l.effectiveTotal, l.quantity).map((part) => ({
                productId: l.product.id,
                variantId: l.variant?.id,
                dropiId: l.product.dropiId,
                dropiVariantId: l.variant?.dropiId,
                name: `${l.product.name}${l.unitColors?.[0] ? " · " + l.unitColors[0] : l.variant ? " · " + l.variant.name : ""}`,
                quantity: part.quantity,
                unitPrice: part.unitPrice,
                supplierPrice:
                  l.variant?.supplierPrice ?? l.product.supplierPrice,
                supplierId: l.product.supplierId,
                snapshot: { variant: l.variant?.name ?? "", colors: l.unitColors ?? [], offer: l.originQuantity === 2 ? "Combo pareja · 2 unidades" : l.originQuantity === 3 ? "Combo familiar · 3 unidades" : "Individual", originalQuantity: l.originQuantity, comboTotal: l.originTotal },
              }))),
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
        await tx.notification.createMany({ data: [{orderId: saved.id, channel: "TELEGRAM", event: "ORDER_RECEIVED", status: "PENDING"}], skipDuplicates: true });
        return saved;
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
  try { await notifyOrder(order.id); } catch { /* The durable outbox remains pending; never fail an already committed purchase. */ }
  return order;
}
