import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireAdmin, rateLimit, sessionCookie } from "@/lib/auth";
import { changeAdminPassword, passwordChangeSchema } from "@/lib/admin-password";
import { failure, sameOrigin, readBody } from "@/lib/http";

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const admin = await requireAdmin();
    await rateLimit(`password-change:${admin.id}`, 5, 900);
    await changeAdminPassword(admin, passwordChangeSchema.parse(await readBody(req)));
    (await cookies()).delete(sessionCookie);
    return NextResponse.json({ ok: true });
  } catch (error) { return failure(error); }
}
