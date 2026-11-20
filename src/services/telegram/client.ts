export class TelegramError extends Error {
  constructor(public code: string, public uncertain = false) { super(code); }
}
export async function telegram<T>(method: "getMe" | "getWebhookInfo" | "setWebhook" | "sendMessage", body: object = {}): Promise<T> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new TelegramError("BOT_NOT_CONFIGURED");
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000), redirect: "error", cache: "no-store",
    });
    const result = await response.json();
    if (!result.ok) throw new TelegramError(`TELEGRAM_${Number(result.error_code) || response.status}`, response.status >= 500);
    return result.result as T;
  } catch (error) {
    if (error instanceof TelegramError) throw error;
    throw new TelegramError("TELEGRAM_RESULT_UNKNOWN", method === "sendMessage");
  }
}
