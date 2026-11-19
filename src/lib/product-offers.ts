import { z } from "zod";

export const comboPriceSchema = z.number().finite().positive().max(999999999).multipleOf(0.01).nullable().optional();
type Offers = { combo2Price?: unknown; combo3Price?: unknown };
export function offerTotal(unitPrice: number, quantity: number, offers: Offers) {
  const configured = quantity === 2 ? offers.combo2Price : quantity === 3 ? offers.combo3Price : null;
  const amount = configured == null ? 0 : Number(configured);
  return Math.round((Number.isFinite(amount) && amount > 0 ? amount : unitPrice * quantity) * 100) / 100;
}

// Split only when a bundle total cannot be divided evenly into cents.
// This preserves the exact configured total in persisted items and Dropi's payload.
export function allocateUnitPrices(total: number, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(total) || total < 0)
    throw new Error("Importe o cantidad inválidos.");
  const cents = Math.round(total * 100);
  const low = Math.floor(cents / quantity);
  const extra = cents % quantity;
  return [
    ...(quantity > extra ? [{ quantity: quantity - extra, unitPrice: low / 100 }] : []),
    ...(extra ? [{ quantity: extra, unitPrice: (low + 1) / 100 }] : []),
  ];
}

export function referenceLineTotal(unitPrice: number, previousPrice: unknown, quantity: number, lineTotal: number) {
  const previous = Number(previousPrice);
  return Math.round(Math.max(lineTotal, Math.max(unitPrice, Number.isFinite(previous) ? previous : 0) * quantity) * 100) / 100;
}
