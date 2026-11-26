import { NextResponse } from "next/server";
import { metaRequestSchema } from "@/lib/meta-schema";
import { buildMetaEvent, metaConfigured, metaDiagnostic, orderMetaPerson, purchaseAllowed, readPurchaseReceipt, sendMetaEvent } from "@/lib/meta-capi";
import { AppError, failure, readBody, sameOrigin } from "@/lib/http";
import { rateLimit } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const input = metaRequestSchema.parse(await readBody(req));
    if (!metaConfigured()) {
      metaDiagnostic("CONFIG_MISSING");
      return NextResponse.json({ status: "disabled", code: "META_CONFIG_MISSING" }, { status: 503 });
    }
    await rateLimit("meta-global", 300, 60);
    await rateLimit(`meta:${input.event_id}`, 6, 60);
    let event;
    if (input.event_name === "Purchase") {
      const id = readPurchaseReceipt(input.receipt, input.event_id);
      const order = await db.order.findUnique({ where: { id } });
      if (!order || order.idempotencyKey !== input.event_id || !purchaseAllowed(order)) throw new AppError(403, "Pedido no válido para medición.");
      event = buildMetaEvent("Purchase", req, input, orderMetaPerson(order.address), Number(order.total));
    } else {
      event = buildMetaEvent(input.event_name, req, input, input.event_name === "AddPaymentInfo" ? input.person : undefined);
    }
    const status = await sendMetaEvent(event);
    return NextResponse.json({ status }, { status: status === "failed" ? 502 : status === "pending" ? 202 : 200 });
  } catch (error) { metaDiagnostic("REQUEST_FAILED"); return failure(error); }
}
