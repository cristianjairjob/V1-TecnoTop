import { timingSafeEqual } from "node:crypto";
import { AppError } from "./http";
export function equalSecret(value: string, secret: string | undefined) {
  if (!secret) return false;
  const a = Buffer.from(value), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function requireCron(req: Request) {
  if (!equalSecret(req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "", process.env.CRON_SECRET)) throw new AppError(401, "No autorizado.");
}
