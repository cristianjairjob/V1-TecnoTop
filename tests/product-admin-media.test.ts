import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { stockSchema } from "../src/lib/product-stock";
import { optimizeProductImage, readImageBody, MAX_IMAGE_BYTES } from "../src/lib/product-image";
import { POST } from "../src/app/api/admin/product-images/route";
import { GET } from "../src/app/api/product-images/[id]/route";
import { db } from "../src/lib/db";

test("stock acepta cero y cantidades enteras; rechaza valores negativos, decimales y vacíos", () => {
  for (const stock of [0, 10, 1500]) assert.equal(stockSchema.parse(stock), stock);
  for (const stock of [-1, 1.5, null, "", "10", Infinity, 1000001]) assert.equal(stockSchema.safeParse(stock).success, false);
});
test("imágenes grandes se optimizan a WebP de máximo 1600 px sin distorsión", async () => {
  const input = await sharp({ create: { width: 2400, height: 1800, channels: 3, background: "blue" } }).png().toBuffer();
  const output = await optimizeProductImage(input);
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 1600); assert.equal(metadata.height, 1200);
});
test("rechaza archivos falsos, vacíos y SVG", async () => {
  for (const input of [Buffer.alloc(0), Buffer.from("not an image"), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>')]) {
    await assert.rejects(optimizeProductImage(input));
  }
});
test("límite de subida se aplica aunque no se envíe content-length", async () => {
  const request = new Request("https://example.com", { method: "POST", body: new Uint8Array(MAX_IMAGE_BYTES + 1) });
  await assert.rejects(readImageBody(request), /5 MB/);
});
test("subida rechaza solicitudes de otro origen antes de leer archivos", async () => {
  const response = await POST(new Request("https://tecnotop.com.co/api/admin/product-images", { method: "POST", headers: { origin: "https://invalid.example" } }));
  assert.equal(response.status, 403);
});
test("la imagen persistida se sirve íntegra con tipo seguro y un ID inexistente devuelve 404", async () => {
  const delegate = db.productImage as unknown as Record<string, unknown>;
  const original = delegate.findUnique;
  const bytes = await sharp({ create: { width: 20, height: 20, channels: 3, background: "blue" } }).webp().toBuffer();
  try {
    delegate.findUnique = async () => ({ id: "image-test", data: bytes });
    const response = await GET(new Request("https://example.com"), { params: Promise.resolve({ id: "image-test" }) });
    assert.equal(response.headers.get("content-type"), "image/webp");
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
    delegate.findUnique = async () => null;
    assert.equal((await GET(new Request("https://example.com"), { params: Promise.resolve({ id: "missing" }) })).status, 404);
  } finally { delegate.findUnique = original; }
});
