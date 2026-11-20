import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, rateLimit } from "@/lib/auth";
import { sameOrigin, failure, AppError } from "@/lib/http";
import { readImageBody, optimizeProductImage } from "@/lib/product-image";

export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const admin = await requireAdmin();
    await rateLimit(`image-upload:${admin.id}`, 30, 3600);
    const productId = new URL(req.url).searchParams.get("productId") ?? "";
    const product = await db.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) throw new AppError(404, "Producto no encontrado.");
    const data = await optimizeProductImage(await readImageBody(req));
    const image = await db.productImage.create({ data: { productId, data: new Uint8Array(data) }, select: { id: true } });
    await db.auditLog.create({ data: { adminId: admin.id, action: "product-image-upload", entityId: productId } });
    const origin = new URL(process.env.APP_URL || req.url).origin;
    return NextResponse.json({ url: `${origin}/api/product-images/${image.id}` }, { status: 201 });
  } catch (error) { return failure(error); }
}
