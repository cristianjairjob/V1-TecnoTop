import { NextResponse } from "next/server";
import { z } from "zod";
import { equalSecret } from "@/lib/cron-auth";
import { readBody, failure, AppError } from "@/lib/http";
import { consumeTelegramLink } from "@/services/telegram/link";
export async function POST(req: Request) {
  try {
    if (!equalSecret(req.headers.get("x-telegram-bot-api-secret-token") ?? "", process.env.TELEGRAM_WEBHOOK_SECRET)) throw new AppError(401, "No autorizado.");
    const data = z.object({ message: z.object({ text: z.string().max(4096).optional(), chat: z.object({ id: z.number().int().safe(), type: z.string() }) }).optional() }).parse(await readBody(req));
    const match = data.message?.text?.match(/^\/start(?:@\w+)? ([\w-]{32})$/);
    if (match && data.message) await consumeTelegramLink(match[1], String(data.message.chat.id), data.message.chat.type === "private");
    return NextResponse.json({ ok: true });
  } catch (error) { return failure(error); }
}
