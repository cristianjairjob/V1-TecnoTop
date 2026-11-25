import { pageContentSchema } from "@/lib/product-page-content";
import { highlightsSchema, displayStockSchema } from "@/lib/product-presentation";
import { defaultVisibility, visibilitySchema } from "@/lib/storefront-visibility";
import { stockSchema } from "@/lib/product-stock";
import { randomUUID } from "node:crypto";
import { colorOptionsSchema } from "@/lib/product-colors";
import { NextResponse } from "next/server";
import { Prisma, OrderStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin, rateLimit } from "@/lib/auth";
import { failure, sameOrigin, readBody, AppError } from "@/lib/http";
import { publishable } from "@/lib/validation";
import { importPage, importDropiProductById, syncInventory } from "@/services/dropi/inventory";
import { dropiProductIdSchema } from "@/lib/dropi-product-id";
import { sendOrder } from "@/services/dropi/orders";
import { diagnoseDropi } from "@/services/dropi/diagnostic";
import { comboPriceSchema } from "@/lib/product-offers";
const id = z.string().min(1).max(100);
const text = z.string().trim().max(5000);
const price = z.number().finite().nonnegative().max(999999999).nullable();
type Context = { params: Promise<{ resource: string }> };
export async function GET(req: Request, ctx: Context) {
  try {
    await requireAdmin();
    const { resource } = await ctx.params;
    if (["dropi-diagnostic", "dropi-import", "dropi-import-id", "dropi-sync", "order-send"].includes(resource)) throw new AppError(409, "Integración externa pausada en V5.");
    const page = Math.max(
      0,
      Math.min(100000, Number(new URL(req.url).searchParams.get("page")) || 0),
    );
    const paging = { take: 50, skip: page * 50 };
    let data: unknown;
    switch (resource) {
      case "dropi-diagnostic":
        await rateLimit("dropi-diagnostic", 5, 60);
        data = await diagnoseDropi();
        break;
      case "dashboard":
        data = {
          products: await db.product.count(),
          drafts: await db.product.count({ where: { status: "DRAFT" } }),
          orders: await db.order.count(),
          errors: await db.order.count({ where: { status: "ERROR_DROPI" } }),
          dropiConfigured: Boolean(process.env.DROPI_API_TOKEN),
          ordersEnabled: false,
          checkoutEnabled: process.env.CHECKOUT_ENABLED === "true",
        };
        break;
      case "products":
      case "inventory":
        data = await db.product.findMany({
          ...paging,
          include: { variants: true, collections: true },
          orderBy: { createdAt: "desc" },
        });
        break;
      case "categories":
        data = await db.category.findMany({ orderBy: { position: "asc" } });
        break;
      case "collections":
        data = await db.collection.findMany({
          include: { products: { orderBy: { position: "asc" } } },
          orderBy: { position: "asc" },
        });
        break;
      case "orders":
      case "tracking":
        data = await db.order.findMany({
          ...paging,
          include: {
            customer: true,
            items: true,
            dropi: {
              select: { originalId: true, outcome: true, errorCode: true },
            },
            shipments: true,
            events: true,
          },
          orderBy: { createdAt: "desc" },
        });
        break;
      case "customers":
        data = await db.customer.findMany({
          ...paging,
          orderBy: { createdAt: "desc" },
        });
        break;
      case "promotions":
        data = await db.promotion.findMany({
          ...paging,
          orderBy: { startsAt: "desc" },
        });
        break;
      case "dropi":
        data = await db.syncLog.findMany({
          ...paging,
          orderBy: { createdAt: "desc" },
        });
        break;
      case "settings": {
        const saved = await db.siteSetting.findMany({ where: { key: { in: ["store", "home", "visibility"] } } });
        data = saved.some(s => s.key === "visibility") ? saved : [...saved, {key:"visibility",value:defaultVisibility}];
        }
        break;
      default:
        throw new AppError(404, "Sección no encontrada.");
    }
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request, ctx: Context) {
  try {
    sameOrigin(req);
    const admin = await requireAdmin();
    await rateLimit(`admin:${admin.id}`, 100, 60);
    const { resource } = await ctx.params;
    const body = await readBody(req, 262144);
    let data: unknown;
    let entityId = resource;
    switch (resource) {
      case "product-create": {
        const category = await db.category.findFirst({ where: { visible: true }, orderBy: { position: "asc" } });
        data = await db.product.create({ data: { slug: `producto-${randomUUID()}`, name: "Nuevo producto", description: "", images: [], stock: 0, status: "DRAFT", categoryId: category?.id }, include: { variants: true } });
        entityId = (data as { id: string }).id;
        break;
      }
      case "variant-create": {
        const input = z.object({ productId: id, name: z.string().trim().min(1).max(100) }).parse(body);
        const product = await db.product.findUniqueOrThrow({ where: { id: input.productId } });
        data = await db.productVariant.create({ data: { productId: product.id, dropiId: `local-${randomUUID()}`, name: input.name, attributes: {}, stock: 0, salePrice: product.salePrice } });
        entityId = product.id;
        break;
      }
      case "demo-product": {
        const category = await db.category.findFirst({ where: { visible: true }, orderBy: { position: "asc" } });
        if (!category) throw new AppError(400, "Activa una categoría para mostrar la demostración.");
        const demo = await db.product.upsert({
          where: { slug: "auriculares-demo-tecnotop" },
          update: { stock: 20 },
          create: {
            slug: "auriculares-demo-tecnotop",
            name: "Auriculares TecnoTop · DEMOSTRACIÓN",
            brand: "PRODUCTO FICTICIO",
            description: "Producto ficticio creado únicamente para probar el diseño de la tienda. No está disponible para la venta.\n\nPrecio de ejemplo: $99.900 COP. Puedes editarlo en Administración → Productos para comprobar que cambia únicamente en esta ficha.\n\nLas imágenes son ilustraciones de demostración, no fotografías de un producto real.",
            images: ["https://tecnotop.com.co/demo/headphones-blue.svg", "https://tecnotop.com.co/demo/headphones-white.svg"],
            salePrice: 99900,
            stock: 20,
            status: "PUBLISHED",
            categoryId: category.id,
          },
        });
        data = demo;
        entityId = demo.id;
        break;
      }
      case "products": {
        const d = z
          .object({
            id,
            name: z.string().min(2).max(250),
            description: text,
            stock: stockSchema.optional(),
            displayStock: displayStockSchema.optional(),
            highlights: highlightsSchema.optional(),
            pageContent: pageContentSchema.optional(),
            salePrice: price,
            previousPrice: price,
            combo2Price: comboPriceSchema,
            combo3Price: comboPriceSchema,
            buyersCount: z.number().int().min(0).max(2147483647).nullable().optional(),
            pairBestSeller: z.boolean().optional(),
            colorOptions: colorOptionsSchema.optional(),
            buyerAvatars: z.array(z.url().refine((s) => s.startsWith("https://"))).max(3).optional(),
            categoryId: id.nullable(),
            brand: z.string().max(100).nullable(),
            status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
            featured: z.boolean(),
            popular: z.boolean(),
            position: z.number().int().min(0),
            images: z
              .array(z.url().refine((s) => s.startsWith("https://")))
              .max(15),
            variants: z.array(z.object({ id, salePrice: price, stock: stockSchema.optional() })).max(200),
          })
          .parse(body);
        const p = await db.product.findUniqueOrThrow({
          where: { id: d.id },
          include: { variants: true },
        });
        if (
          d.categoryId &&
          !(await db.category.findUnique({ where: { id: d.categoryId } }))
        )
          throw new AppError(400, "Categoría inválida.");
        if (d.variants.some((v) => !p.variants.find((x) => x.id === v.id)))
          throw new AppError(400, "Variante inválida.");
        if (d.colorOptions?.some(c => c.variantId && !p.variants.some(v => v.id === c.variantId && v.active))) throw new AppError(400, "Asocia el color a una variante activa de este producto.");
        const merged = p.variants.map((v) => ({
          ...v,
          salePrice:
            d.variants.find((x) => x.id === v.id)?.salePrice ?? v.salePrice,
        }));
        if (d.status === "PUBLISHED" && !publishable({ ...p, ...d }, merged))
          throw new AppError(
            400,
            "Completa descripción, imágenes, categoría y precios de todas las variantes antes de publicar.",
          );
        const { variants, ...update } = d;
        data = await db.$transaction(async (tx) => {
          for (const v of variants)
            await tx.productVariant.update({
              where: { id: v.id },
              data: { salePrice: v.salePrice, stock: v.stock },
            });
          return tx.product.update({ where: { id: d.id }, data: update });
        });
        entityId = d.id;
        break;
      }
      case "categories": {
        const d = z
          .object({
            id: id.optional(),
            slug: z
              .string()
              .regex(/^[a-z0-9-]+$/)
              .max(100),
            name: z.string().min(2).max(100),
            description: text,
            position: z.number().int().nonnegative(),
            visible: z.boolean(),
          })
          .parse(body);
        data = d.id
          ? await db.category.update({ where: { id: d.id }, data: d })
          : await db.category.create({ data: d });
        break;
      }
      case "collections": {
        const d = z
          .object({
            id: id.optional(),
            slug: z
              .string()
              .regex(/^[a-z0-9-]+$/)
              .max(160),
            name: z.string().min(2).max(100),
            description: text,
            categoryId: id,
            position: z.number().int().nonnegative(),
            visible: z.boolean(),
            productIds: z.array(id).max(200),
          })
          .parse(body);
        const unique = [...new Set(d.productIds)];
        if (
          (await db.product.count({
            where: { id: { in: unique }, categoryId: d.categoryId },
          })) !== unique.length
        )
          throw new AppError(
            400,
            "Los productos deben pertenecer a la categoría seleccionada.",
          );
        const { productIds: _, ...fields } = d;
        void _;
        data = await db.$transaction(async (tx) => {
          const c = d.id
            ? await tx.collection.update({ where: { id: d.id }, data: fields })
            : await tx.collection.create({ data: fields });
          await tx.collectionProduct.deleteMany({
            where: { collectionId: c.id },
          });
          await tx.collectionProduct.createMany({
            data: unique.map((productId, position) => ({
              collectionId: c.id,
              productId,
              position,
            })),
          });
          return c;
        });
        break;
      }
      case "collection-delete": {
        const d = z.object({ id }).parse(body);
        data = await db.collection.delete({ where: { id: d.id } });
        entityId = d.id;
        break;
      }
      case "promotions": {
        const d = z
          .object({
            id: id.optional(),
            code: z
              .string()
              .min(3)
              .max(40)
              .transform((s) => s.toUpperCase()),
            title: z.string().min(3).max(200),
            percent: z.number().int().min(1).max(80),
            minimum: z.number().nonnegative(),
            active: z.boolean(),
            startsAt: z.coerce.date(),
            endsAt: z.coerce.date(),
          })
          .refine((d) => d.endsAt > d.startsAt)
          .parse(body);
        data = d.id
          ? await db.promotion.update({ where: { id: d.id }, data: d })
          : await db.promotion.create({ data: d });
        break;
      }
      case "settings": {
        const d = z
          .object({ key: z.enum(["home", "store", "visibility"]), value: z.unknown() })
          .parse(body);
        const value =
          d.key === "visibility" ? visibilitySchema.parse(d.value) : d.key === "home"
            ? z
                .array(
                  z.object({
                    id: z.enum([
                      "hero",
                      "categories",
                      "featured",
                      "popular",
                      "bestsellers",
                      "offers",
                      "benefits",
                    ]),
                    title: z.string().max(160),
                    subtitle: z.string().max(300),
                    visible: z.boolean(),
                  }),
                )
                .max(7)
                .refine((a) => new Set(a.map((x) => x.id)).size === a.length)
                .parse(d.value)
            : z
                .object({
                  contactEmail: z.union([z.email(), z.literal("")]),
                  whatsapp: z.string().regex(/^\d{0,15}$/),
                  legalName: text,
                  taxId: text,
                  address: text,
                  policiesApproved: z.boolean(),
                  privacy: text,
                  shipping: text,
                  returns: text,
                  terms: text,
                })
                .refine(
                  (d) =>
                    !d.policiesApproved ||
                    Boolean(
                      d.legalName &&
                      d.contactEmail &&
                      d.privacy &&
                      d.shipping &&
                      d.returns &&
                      d.terms,
                    ),
                  "Completa y revisa los datos del titular y las políticas.",
                )
                .parse(d.value);
        data = await db.siteSetting.upsert({
          where: { key: d.key },
          create: { key: d.key, value: value as Prisma.InputJsonValue },
          update: { value: value as Prisma.InputJsonValue },
        });
        break;
      }
      case "dropi-import": {
        const d = z
          .object({
            offset: z.number().int().min(0).default(0),
            keywords: z.string().max(100).default(""),
          })
          .parse(body);
        data = await importPage(d.offset, d.keywords);
        break;
      }
      case "dropi-import-id": {
        const d = z.object({ dropiId: dropiProductIdSchema }).parse(body);
        await rateLimit(`dropi-import-id:${admin.id}`, 10, 60);
        const product = await importDropiProductById(d.dropiId);
        data = product;
        entityId = product.id;
        break;
      }
      case "dropi-sync": {
        const d = z
          .object({ offset: z.number().int().min(0).default(0) })
          .parse(body);
        data = await syncInventory(d.offset);
        break;
      }
      case "order-send": {
        const d = z.object({ id }).parse(body);
        data = await sendOrder(d.id);
        entityId = d.id;
        break;
      }
      case "tracking": {
        const d = z
          .object({
            orderId: id,
            status: z.nativeEnum(OrderStatus),
            detail: z.string().min(8).max(500),
            guide: z.string().max(100).optional(),
            carrier: z.string().max(100).optional(),
            evidence: z.string().min(8).max(500),
          })
          .parse(body);
        if (
          d.status === "ENVIANDO_A_DROPI" ||
          d.status === "ACEPTADO_POR_DROPI"
        )
          throw new AppError(
            400,
            "Este estado solo puede proceder de la integración.",
          );
        data = await db.$transaction(async (tx) => {
          const event = await tx.trackingEvent.create({
            data: {
              orderId: d.orderId,
              status: d.status,
              detail: d.detail,
              source: "ADMIN_VERIFIED",
            },
          });
          await tx.order.update({
            where: { id: d.orderId },
            data: { status: d.status },
          });
          if (d.guide)
            await tx.shipment.create({
              data: {
                orderId: d.orderId,
                guide: d.guide,
                carrier: d.carrier,
                source: "ADMIN_VERIFIED",
              },
            });
          await tx.auditLog.create({
            data: {
              adminId: admin.id,
              action: `TRACKING_EVIDENCE:${d.evidence}`,
              entityId: d.orderId,
            },
          });
          return event;
        });
        break;
      }
      default:
        throw new AppError(404, "Operación no encontrada.");
    }
    await db.auditLog.create({
      data: { adminId: admin.id, action: resource, entityId },
    });
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return failure(e);
  }
}
