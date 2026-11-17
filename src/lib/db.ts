import { PrismaClient } from "@prisma/client";
const globalDb = globalThis as unknown as { prisma?: PrismaClient };
const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
if (url?.hostname === "localhost") url.hostname = "127.0.0.1";
export const db =
  globalDb.prisma ??
  new PrismaClient({
    log: [],
    ...(url ? { datasourceUrl: url.toString() } : {}),
  });
if (process.env.NODE_ENV !== "production") globalDb.prisma = db;
