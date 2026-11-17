import { NextResponse } from "next/server";
import { checkout } from "@/lib/checkout";
import { checkoutSchema } from "@/lib/validation";
import { failure, readBody, sameOrigin } from "@/lib/http";
import { rateLimit } from "@/lib/auth";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    await rateLimit("checkout-global", 100, 60);
    const input = checkoutSchema.parse(await readBody(req));
    await rateLimit(`checkout:${input.phone}`, 5, 900);
    const order = await checkout(input);
    return NextResponse.json(
      {
        number: order.number,
        status: order.status,
        total: Number(order.total),
      },
      { status: 201 },
    );
  } catch (e) {
    return failure(e);
  }
}
