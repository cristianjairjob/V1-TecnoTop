import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { newSession, rateLimit } from "@/lib/auth";
import { failure, sameOrigin, readBody, AppError } from "@/lib/http";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    await rateLimit("login-global", 30, 900);
    const d = z
      .object({ email: z.email(), password: z.string().min(1).max(200) })
      .parse(await readBody(req));
    await rateLimit(`login:${d.email.toLowerCase()}`, 5, 900);
    const user = await db.adminUser.findUnique({
      where: { email: d.email.toLowerCase() },
    });
    const valid = await compare(
      d.password,
      user?.passwordHash ??
        "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW",
    );
    if (!user?.active || !valid)
      throw new AppError(401, "Correo o contraseña incorrectos.");
    await newSession(user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
