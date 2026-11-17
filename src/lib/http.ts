import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DropiError } from "@/services/dropi/errors";
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function readBody(req: Request) {
  if (Number(req.headers.get("content-length") || 0) > 65536)
    throw new AppError(413, "Solicitud demasiado grande.");
  const reader = req.body?.getReader();
  if (!reader) throw new AppError(400, "Solicitud vacía.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 65536) {
      await reader.cancel();
      throw new AppError(413, "Solicitud demasiado grande.");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AppError(400, "JSON inválido.");
  }
}
export function sameOrigin(req: Request) {
  if (
    req.headers.get("origin") !== new URL(process.env.APP_URL || req.url).origin
  )
    throw new AppError(403, "Origen no permitido.");
}
export function failure(e: unknown) {
  if (e instanceof ZodError)
    return NextResponse.json(
      { error: e.issues[0]?.message || "Datos inválidos." },
      { status: 400 },
    );
  if (e instanceof AppError)
    return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof DropiError)
    return NextResponse.json(
      {
        error: "No fue posible completar la operación con Dropi.",
        code: e.code,
      },
      { status: 502 },
    );
  return NextResponse.json(
    { error: "No fue posible completar la operación. Inténtalo más tarde." },
    { status: 503 },
  );
}
