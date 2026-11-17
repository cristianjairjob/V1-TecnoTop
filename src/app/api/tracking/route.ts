import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { phoneSchema } from "@/lib/validation";
import { failure, readBody, sameOrigin, AppError } from "@/lib/http";
import { rateLimit } from "@/lib/auth";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    await rateLimit("tracking-global", 100, 60);
    const d = z
      .object({
        number: z.string().regex(/^TT-[A-F0-9]{12}$/),
        phone: phoneSchema,
      })
      .parse(await readBody(req));
    await rateLimit(`tracking:${d.number}`, 8, 900);
    const o = await db.order.findFirst({
      where: { number: d.number, customer: { phone: d.phone } },
      include: { events: { orderBy: { createdAt: "asc" } }, shipments: true },
    });
    if (!o) throw new AppError(404, "No encontramos un pedido con esos datos.");
    return NextResponse.json(
      {
        number: o.number,
        events: o.events.map((e) => ({
          status: e.status,
          detail: e.detail,
          date: e.createdAt,
        })),
        shipments: o.shipments.map((s) => ({
          guide: s.guide,
          carrier: s.carrier,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
