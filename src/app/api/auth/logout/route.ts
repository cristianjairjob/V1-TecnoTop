import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { hash, sessionCookie } from "@/lib/auth";
import { sameOrigin, failure } from "@/lib/http";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const c = await cookies();
    const token = c.get(sessionCookie)?.value;
    if (token)
      await db.adminSession.deleteMany({ where: { tokenHash: hash(token) } });
    c.delete(sessionCookie);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
