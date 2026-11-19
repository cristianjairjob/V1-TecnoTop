export const CHECKOUT_CYCLE_MS = (60 * 60 + 57 * 60 + 37) * 1000;
export function cycleSeconds(start: number, now: number) {
  const elapsed = Math.max(0, now - start);
  return Math.ceil((CHECKOUT_CYCLE_MS - (elapsed % CHECKOUT_CYCLE_MS)) / 1000);
}
export function formatCountdown(seconds: number) {
  return [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60].map(value => String(value).padStart(2, "0")).join(":");
}
