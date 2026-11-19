import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  cartSchema,
  phoneSchema,
  publishable,
  checkoutSchema,
  discountAmount,
} from "../src/lib/validation";
import { dropiRequest } from "../src/services/dropi/client";
import { DropiError } from "../src/services/dropi/errors";
import { safePayload, productSchema } from "../src/services/dropi/types";
import { productImages } from "../src/services/dropi/inventory";
import { sendOrder } from "../src/services/dropi/orders";
import { sameOrigin, readBody } from "../src/lib/http";
const originalFetch = globalThis.fetch;
const originalToken = process.env.DROPI_API_TOKEN;
const originalOrders = process.env.DROPI_ORDERS_ENABLED;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.DROPI_API_TOKEN;
  else process.env.DROPI_API_TOKEN = originalToken;
  if (originalOrders === undefined) delete process.env.DROPI_ORDERS_ENABLED;
  else process.env.DROPI_ORDERS_ENABLED = originalOrders;
  delete process.env.DROPI_API_URL;
});
test("rechaza cantidades negativas, duplicados y más de 20 unidades", () => {
  assert.equal(
    cartSchema.safeParse([{ productId: "p", quantity: -1 }]).success,
    false,
  );
  assert.equal(
    cartSchema.safeParse([{ productId: "p", quantity: 21 }]).success,
    false,
  );
  assert.equal(
    cartSchema.safeParse([
      { productId: "p", quantity: 1 },
      { productId: "p", quantity: 1 },
    ]).success,
    false,
  );
});
test("normaliza celular colombiano y rechaza teléfonos inválidos", () => {
  assert.equal(phoneSchema.parse("+57 304 593 9644"), "3045939644");
  assert.equal(phoneSchema.safeParse("123").success, false);
});
test("impide publicación sin clasificación, imágenes o precio de variante", () => {
  const p = {
    name: "Producto",
    description: "Descripción",
    images: ["https://example.com/a.png"],
    categoryId: "audio",
    salePrice: 50000,
    stock: 2,
  };
  assert.equal(publishable(p), true);
  assert.equal(publishable({ ...p, categoryId: null }), false);
  assert.equal(publishable({ ...p, images: [] }), false);
  assert.equal(publishable(p, [{ active: true, salePrice: null }]), false);
});
test("checkout exige consentimiento e idempotency UUID", () => {
  assert.equal(
    checkoutSchema.safeParse({
      firstName: "Ana",
      lastName: "Pérez",
      phone: "3045939644",
      email: "a@example.com",
      state: "BOGOTÁ, D.C.",
      city: "BOGOTÁ, D.C.",
      address: "Calle 10 número 20",
      complement: "Centro",
      establishment: "Casa particular",
      reference: "Frente al parque",
      requestedDate: "2099-12-31",
      items: [{ productId: "p", quantity: 1 }],
      consent: false,
      idempotencyKey: "123",
    }).success,
    false,
  );
});
test("calcula descuento acotado", () => {
  assert.equal(discountAmount(100000, 10), 10000);
  assert.equal(discountAmount(100000, 500), 100000);
});
test("elimina secretos de snapshots anidados", () => {
  assert.deepEqual(
    safePayload({
      id: 1,
      token: "hidden",
      supplier: { password: "hidden", name: "Proveedor" },
      items: [{ authorization: "hidden", id: 2 }],
    }),
    { id: 1, supplier: { name: "Proveedor" }, items: [{ id: 2 }] },
  );
});
test("usa el CDN verificado para urlS3", () => {
  const p = productSchema.parse({
    id: 1,
    name: "Producto",
    gallery: [{ urlS3: "img/product.png" }, { url: "uploads/another.png" }],
  });
  assert.deepEqual(productImages(p), [
    "https://d39ru7awumhhs2.cloudfront.net/img/product.png",
    "https://api.dropi.co/uploads/another.png",
  ]);
});
test("una orden deshabilitada no accede a Dropi ni a la base de datos", async () => {
  process.env.DROPI_ORDERS_ENABLED = "false";
  globalThis.fetch = async () => {
    assert.fail("No debe invocar la API");
  };
  assert.deepEqual(await sendOrder("no-existing-order"), {
    sent: false,
    reason: "DISABLED",
  });
});
test("rechaza origen diferente en mutaciones", () => {
  assert.throws(() =>
    sameOrigin(
      new Request("https://tecnotop.com.co/api/checkout", {
        method: "POST",
        headers: { Origin: "https://attacker.invalid" },
      }),
    ),
  );
});
test("limita el cuerpo JSON incluso sin content-length", async () => {
  await assert.rejects(
    readBody(
      new Request("https://tecnotop.com.co/api/checkout", {
        method: "POST",
        body: "x".repeat(66000),
      }),
    ),
    /demasiado grande/,
  );
});
test("no envía credenciales a un host alternativo", async () => {
  process.env.DROPI_API_URL = "https://attacker.invalid/integrations/";
  process.env.DROPI_API_TOKEN = "test";
  globalThis.fetch = async () => assert.fail("Nunca debe conectarse");
  await assert.rejects(
    dropiRequest("products/index", "POST", {}),
    /INVALID_DROPI_URL/,
  );
});
test("valida respuesta y no reintenta un 401", async () => {
  process.env.DROPI_API_TOKEN = "test";
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return new Response("{}", { status: 401 });
  };
  await assert.rejects(
    dropiRequest("products/index", "POST", {}),
    /DROPI_HTTP_401/,
  );
  assert.equal(requests, 1);
});
test("un timeout creando una orden es incierto y nunca se reintenta", async () => {
  process.env.DROPI_API_TOKEN = "test";
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    throw new Error("timeout");
  };
  await assert.rejects(
    dropiRequest("orders/myorders", "POST", {}, false),
    (e: unknown) => e instanceof DropiError && e.uncertain,
  );
  assert.equal(requests, 1);
});
test("respuesta de éxito sin sobre válido no se acepta", async () => {
  process.env.DROPI_API_TOKEN = "test";
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ unexpected: [] }));
  await assert.rejects(
    dropiRequest("products/index", "POST", {}),
    /DROPI_INVALID_RESPONSE/,
  );
});
