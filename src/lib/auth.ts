import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import { AppError } from "./http";
export const hash = (v: string) => createHash("sha256").update(v).digest("hex");
export const sessionCookie = "tecnotop_admin";
export async function currentAdminSession() {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) return null;
  const s = await db.adminSession.findUnique({
    where: { tokenHash: hash(token) },
    include: { admin: true },
  });
  return s && s.expiresAt > new Date() && s.admin.active ? s : null;
}
export async function currentAdmin() { return (await currentAdminSession())?.admin ?? null; }
export async function requireAdmin() {
  const admin = await currentAdmin();
  if (!admin) throw new AppError(401, "Inicia sesión para continuar.");
  return admin;
}
export async function newSession(adminId: string) {
  const token = randomBytes(32).toString("hex");
  await db.adminSession.create({
    data: {
      adminId,
      tokenHash: hash(token),
      expiresAt: new Date(Date.now() + 8 * 3600_000),
    },
  });
  (await cookies()).set(sessionCookie, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 8 * 3600,
  });
}
export async function rateLimit(key: string, limit = 10, seconds = 900) {
  const bucket = Math.floor(Date.now() / (seconds * 1000));
  const row = await db.rateLimit.upsert({
    where: { key: hash(`${key}:${bucket}`) },
    create: {
      key: hash(`${key}:${bucket}`),
      count: 1,
      expiresAt: new Date((bucket + 1) * seconds * 1000),
    },
    update: { count: { increment: 1 } },
  });
  if (row.count > limit)
    throw new AppError(429, "Demasiados intentos. Espera unos minutos.");
}
