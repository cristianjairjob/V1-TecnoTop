import { NextResponse } from "next/server";
import { requireCron } from "@/lib/cron-auth";
import { failure } from "@/lib/http";
import { sendDaily } from "@/services/telegram/notifications";
export async function POST(req: Request) {
  try { requireCron(req); return NextResponse.json(await sendDaily()); }
  catch (error) { return failure(error); }
}
