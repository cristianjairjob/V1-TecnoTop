import { test } from "node:test";
import assert from "node:assert/strict";
import { offerTotal, allocateUnitPrices, comboPriceSchema } from "../src/lib/product-offers";
import { quote } from "../src/lib/checkout";
import { db } from "../src/lib/db";

test("independent bundle totals, exact quantities and legacy fallback", () => {
  const offers = { combo2Price: 149900, combo3Price: 199900 };
  assert.equal(offerTotal(99900, 1, offers), 99900);
  assert.equal(offerTotal(99900, 2, offers), 149900);
  assert.equal(offerTotal(99900, 3, offers), 199900);
  assert.equal(offerTotal(99900, 4, offers), 399600);
  assert.equal(offerTotal(99900, 3, {}), 299700);
  assert.equal(offerTotal(99900, 2, { combo2Price: null }), 199800);
});

test("bundle input rejects free, negative, nonfinite and fractional-cent prices", () => {
  for (const value of [0, -1, Infinity, NaN, 1.001, 1000000000]) assert.equal(comboPriceSchema.safeParse(value).success, false);
  for (const value of [null, undefined, 149900, 99900.99]) assert.equal(comboPriceSchema.safeParse(value).success, true);
});

test("unit allocation preserves every cent for bundles and discounts", () => {
  for (const total of [100000, 199900, 99900.99, 0, 0.01, 89910.89]) {
    for (let quantity = 1; quantity <= 20; quantity++) {
      const parts = allocateUnitPrices(total, quantity);
      assert.equal(parts.reduce((sum, p) => sum + p.quantity, 0), quantity);
      assert.equal(parts.reduce((sum, p) => sum + Math.round(p.unitPrice * 100) * p.quantity, 0), Math.round(total * 100));
    }
  }
});

test("server quote applies only the edited product bundle, including variants and coupons", async () => {
  const originalProducts = db.product.findMany;
  const originalPromotion = db.promotion.findUnique;
  const products = [
    { id: "a", name: "A", salePrice: 99900, combo2Price: 149900, combo3Price: 199900, stock: 20, variants: [] },
    { id: "b", name: "B", salePrice: 50000, combo2Price: null, combo3Price: null, stock: 20, variants: [] },
    { id: "c", name: "C", salePrice: 70000, combo2Price: 120000, stock: 20, variants: [{ id: "vc", active: true, salePrice: 80000, stock: 5 }] },
  ];
  db.product.findMany = (async () => products) as unknown as typeof db.product.findMany;
  db.promotion.findUnique = (async () => ({ code: "TEN", active: true, startsAt: new Date(0), endsAt: new Date("2099-01-01"), minimum: 0, percent: 10 })) as unknown as typeof db.promotion.findUnique;
  try {
    const items = [{ productId: "a", quantity: 3 }, { productId: "b", quantity: 2 }, { productId: "c", variantId: "vc", quantity: 2 }];
    const before = await quote(items);
    assert.deepEqual(before.lines.map((l) => l.lineTotal), [199900, 100000, 120000]);
    products[0].combo3Price = 179900;
    const after = await quote(items, "TEN");
    assert.deepEqual(after.lines.map((l) => l.lineTotal), [179900, 100000, 120000]);
    assert.equal(after.total, 359910);
    assert.equal(after.discount, 39990);
    assert.equal(after.shipping, 0);
    assert.equal((await quote([{ productId: "c", variantId: "vc", quantity: 1 }])).total, 80000);
  } finally {
    db.product.findMany = originalProducts;
    db.promotion.findUnique = originalPromotion;
  }
});
