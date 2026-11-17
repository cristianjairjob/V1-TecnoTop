import { test } from "node:test";
import assert from "node:assert/strict";
import { quote } from "../src/lib/checkout";
import { db } from "../src/lib/db";

test("a price change affects only its product; quotes use current database prices and variant prices", async () => {
  const original = db.product.findMany;
  const products = [
    { id: "product-a", name: "Producto A", salePrice: 50000, stock: 10, variants: [] },
    { id: "product-b", name: "Producto B", salePrice: 80000, stock: 10, variants: [] },
    { id: "product-c", name: "Producto C", salePrice: 90000, stock: 10, variants: [{ id: "variant-c", active: true, salePrice: 95000, stock: 10 }] },
  ];
  db.product.findMany = (async () => products) as unknown as typeof db.product.findMany;
  try {
    const items = [{ productId: "product-a", quantity: 2 }, { productId: "product-b", quantity: 1 }, { productId: "product-c", variantId: "variant-c", quantity: 3 }];
    const before = await quote(items);
    assert.deepEqual(before.lines.map(line => line.unitPrice), [50000, 80000, 95000]);
    products[0].salePrice = 60000;
    const after = await quote(items);
    assert.deepEqual(after.lines.map(line => line.unitPrice), [60000, 80000, 95000]);
    assert.equal(after.total, 485000);
    assert.equal(after.shipping, 0);
    assert.equal(after.total - before.total, 20000);
  } finally { db.product.findMany = original; }
});
