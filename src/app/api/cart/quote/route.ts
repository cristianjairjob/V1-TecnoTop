import { NextResponse } from "next/server";
import { z } from "zod";
import { quote } from "@/lib/checkout";
import { cartSchema } from "@/lib/validation";
import { failure, readBody, sameOrigin } from "@/lib/http";
import { rateLimit } from "@/lib/auth";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    await rateLimit("quotes", 200, 60);
    const data = z
      .object({
        items: cartSchema,
        promotionCode: z.string().max(50).optional(),
      })
      .parse(await readBody(req));
    const q = await quote(data.items, data.promotionCode);
    return NextResponse.json({
      subtotal: q.subtotal,
      discount: q.discount,
      shipping: 0,
      total: q.total,
      lines: q.lines.map((l) => ({
        productId: l.productId,
        variantId: l.variantId,
        name: l.product.name,
        unitPrice: l.unitPrice,
        quantity: l.quantity,
      })),
    });
  } catch (e) {
    return failure(e);
  }
}
