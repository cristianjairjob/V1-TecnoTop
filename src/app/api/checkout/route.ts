import { normalizedPhone } from "@/lib/whatsapp";
import { NextResponse } from "next/server";
import { checkout } from "@/lib/checkout";
import { checkoutSchema } from "@/lib/validation";
import { failure, readBody, sameOrigin } from "@/lib/http";
import { rateLimit } from "@/lib/auth";
import { metaContextSchema } from "@/lib/meta-schema";
import { buildMetaEvent, metaConfigured, orderMetaPerson, purchaseAllowed, purchaseReceipt, sendMetaEvent } from "@/lib/meta-capi";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    await rateLimit("checkout-global", 100, 60);
    const raw = await readBody(req);
    const input = checkoutSchema.parse(raw);
    await rateLimit(`checkout:${normalizedPhone(input.phone)}`, 5, 900);
    const order = await checkout(input);
    let meta;
    // Analytics is optional and outside the transaction/idempotency hash. Its failure cannot roll back an order.
    try {
      const context = metaContextSchema.safeParse(raw?.meta);
      if (metaConfigured() && context.success && context.data.event_id === order.idempotencyKey && purchaseAllowed(order)) {
        meta = { eventId: order.idempotencyKey, receipt: purchaseReceipt(order), value: Number(order.total) };
        await sendMetaEvent(buildMetaEvent("Purchase", req, context.data, orderMetaPerson(order.address), Number(order.total)));
      }
    } catch { /* The browser can retry using the signed receipt; never expose Meta credentials/errors. */ }
    return NextResponse.json(
      {
        number: order.number,
        status: order.status,
        total: Number(order.total),
        ...(meta ? { meta } : {}),
      },
      { status: 201 },
    );
  } catch (e) {
    return failure(e);
  }
}
