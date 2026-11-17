import { DropiError } from "./errors";
// Do not guess a tracking URL. Customer tracking reads recorded database events.
export async function syncDropiTracking(): Promise<never> {
  throw new DropiError("TRACKING_ENDPOINT_NOT_VERIFIED", 501);
}
