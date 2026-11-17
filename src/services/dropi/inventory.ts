import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { slugify } from "@/lib/catalog-defaults";
import { getDropiProduct, listDropiProducts } from "./products";
import { safePayload, DropiProductData } from "./types";
import { DropiError } from "./errors";
const json = (v: unknown) => safePayload(v) as Prisma.InputJsonValue;
export function productStock(p: DropiProductData) {
  return p.warehouse_product?.reduce((n, w) => n + w.stock, 0) ?? p.stock ?? 0;
}
export function productImages(p: DropiProductData) {
  return (p.gallery ?? []).flatMap((g) => {
    try {
      if (!g.urlS3 && !g.url) return [];
      const u = new URL(
        g.urlS3 || g.url || "",
        g.urlS3
          ? "https://d39ru7awumhhs2.cloudfront.net/"
          : "https://api.dropi.co/",
      );
      return u.protocol === "https:" ? [u.href] : [];
    } catch {
      return [];
    }
  });
}
export async function importDropiProduct(id: string) {
  const p = await getDropiProduct(id);
  const price = p.sale_price ?? p.supplier_price ?? 0;
  return db.$transaction(async (tx) => {
    const product = await tx.product.upsert({
      where: { dropiId: p.id },
      create: {
        dropiId: p.id,
        slug: `${slugify(p.name).slice(0, 160)}-${p.id}`,
        name: p.name,
        description: p.description ?? "",
        images: productImages(p),
        supplierPrice: price,
        supplierId: p.user_id,
        stock: productStock(p),
        syncedAt: new Date(),
      },
      update: {
        supplierPrice: price,
        supplierId: p.user_id,
        stock: productStock(p),
        syncedAt: new Date(),
      },
    });
    await tx.dropiProduct.upsert({
      where: { productId: product.id },
      create: { productId: product.id, originalId: p.id, payload: json(p) },
      update: { payload: json(p), syncedAt: new Date() },
    });
    const variants = p.variations ?? [];
    await tx.productVariant.updateMany({
      where: { productId: product.id },
      data: { active: false, stock: 0 },
    });
    for (const v of variants) {
      const data = {
        stock:
          v.warehouse_product_variation?.reduce((n, w) => n + w.stock, 0) ??
          v.stock ??
          0,
        supplierPrice: v.sale_price ?? v.supplier_price ?? price,
        active: true,
      };
      await tx.productVariant.upsert({
        where: { productId_dropiId: { productId: product.id, dropiId: v.id } },
        create: {
          productId: product.id,
          dropiId: v.id,
          name:
            v.attribute_values
              ?.map((a) => `${a.attribute_name}: ${a.value}`)
              .join(" · ") || `Variante ${v.id}`,
          sku: v.sku,
          attributes: json(v.attribute_values ?? []),
          ...data,
        },
        update: data,
      });
    }
    return product;
  });
}
export async function importPage(offset = 0, keywords = "") {
  let count = 0;
  try {
    const products = await listDropiProducts(offset, 10, keywords);
    for (const p of products) {
      await importDropiProduct(p.id);
      count++;
    }
    await db.syncLog.create({
      data: { operation: "IMPORT", status: "SUCCESS", count },
    });
    return {
      count,
      nextOffset: offset + products.length,
      hasMore: products.length === 10,
    };
  } catch (e) {
    await db.syncLog.create({
      data: {
        operation: "IMPORT",
        status: "ERROR",
        count,
        errorCode: e instanceof DropiError ? e.code : "IMPORT_ERROR",
      },
    });
    throw e;
  }
}
export async function syncInventory(offset = 0) {
  const products = await db.product.findMany({
    where: { dropiId: { not: null }, status: { not: "ARCHIVED" } },
    take: 20,
    skip: offset,
    orderBy: { id: "asc" },
  });
  let count = 0;
  for (const p of products) {
    try {
      await importDropiProduct(p.dropiId!);
      count++;
    } catch (e) {
      await db.product.update({ where: { id: p.id }, data: { stock: 0 } });
      await db.productVariant.updateMany({
        where: { productId: p.id },
        data: { stock: 0 },
      });
      await db.syncLog.create({
        data: {
          operation: "STOCK",
          status: "ERROR",
          errorCode: e instanceof DropiError ? e.code : "SYNC_ERROR",
        },
      });
    }
  }
  await db.syncLog.create({
    data: { operation: "STOCK", status: "SUCCESS", count },
  });
  return {
    count,
    nextOffset: offset + products.length,
    hasMore: products.length === 20,
  };
}
