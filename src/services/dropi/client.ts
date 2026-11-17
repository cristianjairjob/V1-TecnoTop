import { z } from "zod";
import { authentication } from "./authentication";
import { DropiError } from "./errors";
const envelope = z.object({
  isSuccess: z.boolean(),
  objects: z.unknown().optional(),
});
export async function dropiRequest(
  path: string,
  method: "GET" | "POST",
  body?: unknown,
  readOnly = true,
): Promise<unknown> {
  const base = new URL(
    process.env.DROPI_API_URL || "https://api.dropi.co/integrations/",
  );
  if (
    base.origin !== "https://api.dropi.co" ||
    base.pathname !== "/integrations/"
  )
    throw new DropiError("INVALID_DROPI_URL", 503);
  const headers = authentication();
  for (let attempt = 0; attempt < (readOnly ? 3 : 1); attempt++) {
    try {
      const res = await fetch(new URL(path, base), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(18000),
        redirect: "error",
        cache: "no-store",
      });
      if (
        readOnly &&
        (res.status === 429 || res.status >= 500) &&
        attempt < 2
      ) {
        await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
        continue;
      }
      if (!res.ok)
        throw new DropiError(
          `DROPI_HTTP_${res.status}`,
          res.status,
          !readOnly && res.status >= 500,
        );
      const parsed = envelope.safeParse(await res.json());
      if (!parsed.success)
        throw new DropiError("DROPI_INVALID_RESPONSE", 502, !readOnly);
      if (!parsed.data.isSuccess) throw new DropiError("DROPI_REJECTED", 422);
      return parsed.data.objects;
    } catch (e) {
      if (e instanceof DropiError) throw e;
      if (readOnly && attempt < 2) {
        await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
        continue;
      }
      throw new DropiError("DROPI_CONNECTION_ERROR", 502, !readOnly);
    }
  }
  throw new DropiError("DROPI_UNAVAILABLE");
}
