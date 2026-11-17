import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncInventory } from "@/services/dropi/inventory";
import { failure, AppError } from "@/lib/http";
export async function POST(req: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    const bearer =
      req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    if (
      !secret ||
      bearer.length !== secret.length ||
      !timingSafeEqual(Buffer.from(bearer), Buffer.from(secret))
    )
      throw new AppError(401, "No autorizado.");
    const lock = "inventory-sync-lock";
    const existing = await db.rateLimit.findUnique({ where: { key: lock } });
    if (existing && existing.expiresAt > new Date())
      throw new AppError(409, "Sincronización en curso.");
    if (existing)
      await db.rateLimit.deleteMany({
        where: { key: lock, expiresAt: { lte: new Date() } },
      });
    try {
      await db.rateLimit.create({
        data: { key: lock, expiresAt: new Date(Date.now() + 20 * 60_000) },
      });
    } catch {
      throw new AppError(409, "Sincronización en curso.");
    }
    try {
      const saved = await db.siteSetting.findUnique({
        where: { key: "sync-cursor" },
      });
      const offset = typeof saved?.value === "number" ? saved.value : 0;
      const result = await syncInventory(offset);
      await db.siteSetting.upsert({
        where: { key: "sync-cursor" },
        create: {
          key: "sync-cursor",
          value: result.hasMore ? result.nextOffset : 0,
        },
        update: { value: result.hasMore ? result.nextOffset : 0 },
      });
      await db.rateLimit.deleteMany({
        where: { expiresAt: { lt: new Date() }, key: { not: lock } },
      });
      await db.adminSession.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      return NextResponse.json(result);
    } finally {
      await db.rateLimit.deleteMany({ where: { key: lock } });
    }
  } catch (e) {
    return failure(e);
  }
}
