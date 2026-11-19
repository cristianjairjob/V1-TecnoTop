import { test } from "node:test";
import assert from "node:assert/strict";
import { directCheckoutUrl, directCheckoutSchema } from "../src/lib/direct-checkout";
import { departments, citiesForDepartment, isColombiaLocation } from "../src/lib/colombia-locations";

test("direct purchase carries the exact selection on repeated clicks without accumulating quantities", () => {
  const first = directCheckoutUrl("demo-product", 2, "blue");
  assert.equal(first, directCheckoutUrl("demo-product", 2, "blue"));
  assert.equal(first, "/checkout?product=demo-product&quantity=2&variant=blue");
  assert.equal(directCheckoutUrl("demo-product", 3), "/checkout?product=demo-product&quantity=3");
  assert.deepEqual(directCheckoutSchema.parse(Object.fromEntries(new URL(first, "https://tecnotop.com.co").searchParams)), { product: "demo-product", quantity: 2, variant: "blue" });
});
test("direct checkout rejects invalid quantities and array query arguments", () => {
  for (const quantity of ["0", "-1", "21", "1.5", "NaN", ""]) assert.equal(directCheckoutSchema.safeParse({ product: "demo", quantity }).success, false);
  assert.equal(directCheckoutSchema.safeParse({ product: ["a", "b"], quantity: 2 }).success, false);
  assert.equal(directCheckoutSchema.parse({ product: "demo" }).quantity, 1);
});
test("DIVIPOLA provides 32 departments plus Bogotá and dependent municipality lists", () => {
  assert.equal(departments.length, 33);
  assert.equal(new Set(departments.map((d) => d.code)).size, 33);
  assert.ok(departments.reduce((sum, d) => sum + d.cities.length, 0) > 1100);
  assert.deepEqual(citiesForDepartment(""), []);
  assert.ok(isColombiaLocation("Antioquia", "Medellín"));
  assert.ok(isColombiaLocation("Valle del Cauca", "Santiago de Cali"));
  assert.ok(isColombiaLocation("BOGOTÁ, D.C.", "BOGOTÁ, D.C."));
  assert.equal(isColombiaLocation("Antioquia", "Cali"), false);
  assert.equal(isColombiaLocation("Cundinamarca", "BOGOTÁ, D.C."), false);
});
