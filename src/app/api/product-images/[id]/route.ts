import { db } from "@/lib/db";
import { failure } from "@/lib/http";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const image = await db.productImage.findUnique({ where: { id } });
    if (!image) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(image.data), { headers: {
      "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) { return failure(error); }
}
