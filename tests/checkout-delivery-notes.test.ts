import { test, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { checkoutSchema } from "../src/lib/validation";
import { bogotaToday, minimumDeliveryDate, buildDeliveryNotes, formatDeliveryDate, isoDateSchema } from "../src/lib/delivery";
import { createOrderDetails } from "../src/lib/order-details";
import { buildDropiOrderPayload } from "../src/services/dropi/order-payload";
import { checkout, quote } from "../src/lib/checkout";
import { db } from "../src/lib/db";

const valid = () => ({
  firstName: "Ana María", lastName: "De la Cruz Pérez", phone: "3041234567",
  email: "ana@example.com", state: "BOGOTÁ, D.C.", city: "BOGOTÁ, D.C.",
  address: "Calle 10 número 20-30", complement: "Barrio Centro, apartamento 201",
  additionalNotes: "Frente al parque",
  requestedDate: minimumDeliveryDate(), items: [{ productId: "product-test", quantity: 1 }],
  idempotencyKey: "445cc966-89e8-4fc5-9664-d8abac4fdaaa", consent: true as const,
});
const originalEnv = { ...process.env };
const restoreStubs: (() => void)[] = [];
// Prisma delegates are dynamic proxies, not methods on property descriptors.
function stub(target: object, key: string, implementation: unknown) {
  const object = target as Record<string, unknown>;
  const original = object[key];
  object[key] = implementation;
  restoreStubs.push(() => { object[key] = original; });
}
afterEach(() => {
  restoreStubs.splice(0).reverse().forEach((restore) => restore());
  mock.restoreAll();
  for (const key of ["CHECKOUT_ENABLED", "DROPI_ORDERS_ENABLED", "DROPI_API_TOKEN", "DROPI_API_URL", "DATABASE_URL", "TELEGRAM_NOTIFICATIONS_ENABLED"]) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

for (const [field, value] of [
  ["firstName", " "], ["lastName", ""], ["phone", "12345"], ["address", "Calle"],
  ["complement", ""], ["email", "invalid"], ["state", ""], ["city", ""],
  ["additionalNotes", "x".repeat(1001)],
  ["requestedDate", "2000-01-01"], ["requestedDate", "2027-02-30"],
 ["consent", false], ["idempotencyKey", "123"],
] as const) {
  test(`checkout rechaza ${field} inválido: ${JSON.stringify(value)}`, () => {
    const result = checkoutSchema.safeParse({ ...valid(), [field]: value });
    assert.equal(result.success, false);
    if (!result.success) assert.ok(result.error.issues.some((issue) => issue.path[0] === field));
  });
}

test("acepta el quinto día y conserva nombres compuestos por separado", () => {
  const input = checkoutSchema.parse(valid());
  const details = createOrderDetails(input, "TT-TEST");
  assert.equal(details.customer.firstName, "Ana María");
  assert.equal(details.customer.lastName, "De la Cruz Pérez");
  assert.deepEqual(details.address.buyer, {
    firstName: input.firstName, lastName: input.lastName, email: input.email, phone: input.phone,
  });
  assert.equal(details.address.delivery.requestedDate, minimumDeliveryDate());
});

test("el cambio de día usa America/Bogota y las fechas no se convierten a UTC", () => {
  assert.equal(bogotaToday(new Date("2026-11-18T04:59:59Z")), "2026-11-17");
  assert.equal(bogotaToday(new Date("2026-11-18T05:00:00Z")), "2026-11-18");
  assert.equal(formatDeliveryDate("2028-02-29"), "29/02/2028");
  assert.equal(isoDateSchema.safeParse("2027-02-29").success, false);
  assert.equal(isoDateSchema.safeParse("18/11/2026").success, false);
});

test("construye notes con el formato exacto y número interno", () => {
  assert.equal(buildDeliveryNotes({ establishment: "Casa particular", reference: "Junto a la farmacia", requestedDate: "2026-11-20" }, "TT-ABC"),
    "LOCAL: Casa particular.\n\nREFERENCIA: Junto a la farmacia.\n\nFECHA SOLICITADA DE ENTREGA: 20/11/2026.\n\nPEDIDO TECNOTOP: TT-ABC.");
});

type StoredOrder = Prisma.OrderGetPayload<{ include: { items: true; customer: true; dropi: true } }>;
function fixture(): StoredOrder {
  const details = createOrderDetails(checkoutSchema.parse(valid()), "TT-TEST");
  return {
    id: "order-test", number: "TT-TEST", ...details, total: new Prisma.Decimal(50000), dropi: null,
    items: [{ snapshot: {}, dropiId: "1", name: "Producto", quantity: 1, unitPrice: new Prisma.Decimal(50000), supplierId: "2" }],
  } as unknown as StoredOrder;
}

test("notas incompletas o discordantes bloquean antes de reclamar el pedido", async () => {
  process.env.DROPI_ORDERS_ENABLED = "true";
  const order = fixture();
  stub(db.order, "findUniqueOrThrow", async () => order);
  stub(db.order, "updateMany", async () => assert.fail("No debe reclamar"));
  mock.method(globalThis, "fetch", async () => assert.fail("No debe enviar"));
  order.deliveryNotes = null;
  assert.throws(() => buildDropiOrderPayload(order), /todos los datos/);
  order.deliveryNotes = "TecnoTop TT-TEST";
  assert.throws(() => buildDropiOrderPayload(order), /no coinciden/);
  order.address = { address: "Dirección histórica" };
  assert.throws(() => buildDropiOrderPayload(order), /todos los datos/);
});

test("el payload de un pedido guardado conserva su fecha aunque ya haya pasado", () => {
  const order = fixture();
  const input = { ...checkoutSchema.parse(valid()), requestedDate: "2020-01-01" };
  Object.assign(order, createOrderDetails(input, order.number));
  const payload = buildDropiOrderPayload(order);
  assert.equal(payload.notes, order.deliveryNotes);
  assert.equal(payload.name, "Ana María");
  assert.equal(payload.surname, "De la Cruz Pérez");
  assert.equal(payload.shop_order_id, order.number);
  assert.equal("notes_enabled" in payload, false);
  assert.equal("add_notes" in payload, false);
});

test("el correo es opcional, no se inventa y se conserva vacío en el payload", () => {
  for (const email of ["", "   ", undefined]) {
    const input = checkoutSchema.parse({ ...valid(), email });
    assert.equal(input.email, "");
    const order = fixture();
    Object.assign(order, createOrderDetails(input, order.number));
    assert.equal(buildDropiOrderPayload(order).client_email, "");
  }
});

test("el servidor rechaza una ciudad que no pertenece al departamento", () => {
  assert.equal(checkoutSchema.safeParse({ ...valid(), state: "ANTIOQUIA", city: "CALI" }).success, false);
  assert.equal(checkoutSchema.safeParse({ ...valid(), state: "ANTIOQUIA", city: "MEDELLÍN" }).success, true);
  assert.equal(checkoutSchema.safeParse({ ...valid(), address: "Reclamo en oficina" }).success, true);
});


function readySettings({where}:{where:{key:string}}) {
 if(where.key === "store") return {value:{policiesApproved:true,legalName:"Titular",address:"Dirección comercial",contactEmail:"test@example.com",whatsapp:"573001234567",privacy:"Privacidad",terms:"Condiciones",shipping:"Gratis",returns:"Garantía"}};
 if(where.key === "telegram-binding") return {value:{chatId:"123456",adminId:"admin",linkedAt:"2026-01-01",testSentAt:"2026-01-01",receiptConfirmed:true}};
 return {value:true};
}
for (const mode of ["plain","mapped","shared"] as const) {
 const colorful = mode !== "plain";
 test(`checkout local guarda pedido, colores y outbox sin usar Dropi; colores=${mode}`, async()=>{
  process.env.CHECKOUT_ENABLED="true";process.env.TELEGRAM_NOTIFICATIONS_ENABLED="true";process.env.DATABASE_URL="mysql://mock:mock@localhost/mock";
  let stored: StoredOrder | undefined;let customer:unknown;let creates=0;let queued=0;let decremented=0;let variantDecremented=0;
  const product={id:"product-test",status:"PUBLISHED",name:"Producto local",salePrice:50000,combo3Price:100000,supplierPrice:0,supplierId:null,dropiId:null,stock:10,colorOptions:colorful?[{name:"Negro",hex:"#111111",variantId:mode === "mapped" ? "black" : ""},{name:"Blanco",hex:"#ffffff",variantId:mode === "mapped" ? "white" : ""}]:[],variants:mode === "mapped"?["black","white"].map(id=>({id,name:id,active:true,salePrice:50000,stock:10,supplierPrice:0})):[],category:{visible:true}};
  stub(db.siteSetting,"findUnique",async (args:Parameters<typeof readySettings>[0])=>readySettings(args));
  stub(db.product,"findMany",async()=>[product]);stub(db.product,"findUniqueOrThrow",async()=>product);
  stub(db.product,"updateMany",async({data}:{data:{stock:{decrement:number}}})=>{decremented+=data.stock.decrement;return {count:1};});stub(db.productVariant,"updateMany",async({data}:{data:{stock:{decrement:number}}})=>{variantDecremented+=data.stock.decrement;return {count:1};});
  stub(db.customer,"create",async({data}:{data:object})=>(customer={id:"customer",...data}));
  stub(db.order,"findUnique",async()=>stored??null);
  stub(db.order,"create",async({data}:{data:Record<string,unknown>&{items:{create:object[]}}})=>{creates++;stored={...data,id:"order-test",customer,items:data.items.create,createdAt:new Date()} as unknown as StoredOrder;return stored;});
  stub(db.notification,"createMany",async()=>{queued++;return{count:1};});
  // A notification failure after commit must never turn a saved purchase into a failed checkout.
  stub(db.order,"findUniqueOrThrow",async()=>{throw Error("Simulated notification database outage");});
  stub(db,"$transaction",async(operation:unknown)=>typeof operation==="function"?operation(db):Promise.all(operation as Promise<unknown>[]));
  mock.method(globalThis,"fetch",async()=>assert.fail("El checkout no debe consultar Dropi"));
  const input=checkoutSchema.parse({...valid(),phone:"+57 304 123 4567",items:[{productId:"product-test",quantity:3,...(colorful?{unitColors:["Negro","Blanco","Negro"]}:{})}]});
  if(colorful) await assert.rejects(checkout({...input,items:[{productId:"product-test",quantity:3,unitColors:["Negro"]}]}),/color válido/);
  const result=await checkout(input);assert.ok(stored);assert.equal(Number(result.total),100000);
  assert.equal(stored.customer.phone,input.phone);assert.equal(stored.customer.phoneNormalized,"3041234567");
  assert.equal(stored.items.reduce((n,i)=>n+Math.round(Number(i.unitPrice)*100)*i.quantity,0),10000000);
  assert.equal(queued,1);assert.equal(stored.paymentMethod,"CONTRAENTREGA");
  assert.equal(decremented,3);assert.equal(variantDecremented,mode === "mapped" ? 3 : 0);
  if(mode === "shared") assert.ok(stored.items.every(i=>!i.variantId));
  if(colorful) assert.deepEqual(stored.items.map(i=>(i.snapshot as {colors:string[]}).colors[0]),["Negro","Blanco","Negro"]);
  await checkout(input);assert.equal(creates,1);assert.equal(queued,1);
  await assert.rejects(checkout({...input,additionalNotes:"Otra nota"}),/ya fue utilizada/);
 });
}
test("demo product allows cart quotes but cannot create orders or contact Dropi", async () => {
  process.env.DATABASE_URL = "mysql://mock:mock@localhost:3306/mock";
  process.env.CHECKOUT_ENABLED = "true";
  process.env.TELEGRAM_NOTIFICATIONS_ENABLED = "true";
  stub(db.siteSetting, "findUnique", async (args:Parameters<typeof readySettings>[0]) => readySettings(args));
  stub(db.order, "findUnique", async () => null);
  stub(db.product, "findMany", async () => [{ id: "product-test", slug: "auriculares-demo-tecnotop", name: "Demo", salePrice: 99900, stock: 20, variants: [] }]);
  stub(db, "$transaction", async () => assert.fail("No debe crear una orden"));
  mock.method(globalThis, "fetch", async () => assert.fail("No debe contactar a Dropi"));
  await assert.rejects(checkout(checkoutSchema.parse(valid())), /producto de demostración/);
});

test("fecha opcional y límite de cinco días en Colombia", () => {
  for (const requestedDate of ["", undefined]) assert.equal(checkoutSchema.safeParse({ ...valid(), requestedDate, additionalNotes: undefined }).success, true);
  const min = minimumDeliveryDate();
  const before = new Date(min + "T12:00:00Z"); before.setUTCDate(before.getUTCDate() - 1);
  assert.equal(checkoutSchema.safeParse({ ...valid(), requestedDate: before.toISOString().slice(0, 10) }).success, false);
  assert.equal(checkoutSchema.safeParse({ ...valid(), requestedDate: min }).success, true);
  assert.equal(minimumDeliveryDate(new Date("2026-12-31T04:59:59Z")), "2027-01-07");
  assert.equal(minimumDeliveryDate(new Date("2026-12-31T05:00:00Z")), "2027-01-08");
});
test("notas opcionales se almacenan y envían sin inventar una fecha", () => {
  const order = fixture();
  Object.assign(order, createOrderDetails(checkoutSchema.parse({ ...valid(), additionalNotes: "", requestedDate: "" }), order.number));
  assert.equal(buildDropiOrderPayload(order).notes, "NOTAS ADICIONALES: Sin indicaciones adicionales.\n\nFECHA SOLICITADA DE ENTREGA: Sin fecha solicitada.\n\nPEDIDO TECNOTOP: TT-TEST.");
});
test("pedidos históricos conservan su texto original", () => {
  const order = fixture();
  const delivery = { establishment: "Casa particular", reference: "Frente al parque", requestedDate: "2020-01-01" };
  order.address = { ...(order.address as object), delivery };
  order.deliveryNotes = buildDeliveryNotes(delivery, order.number);
  assert.equal(buildDropiOrderPayload(order).notes, order.deliveryNotes);
});
test("ahorro suma precio anterior, combo y cupón sin duplicar descuentos", async () => {
  stub(db.product, "findMany", async () => [{ id: "p", name: "Producto", salePrice: 100000, previousPrice: 130000, combo2Price: 180000, stock: 20, variants: [] }]);
  stub(db.promotion, "findUnique", async () => ({ active: true, startsAt: new Date("2020-01-01"), endsAt: new Date("2099-01-01"), minimum: 0, percent: 10 }));
  const result = await quote([{ productId: "p", quantity: 2 }], "TEST");
  assert.equal(result.baseSubtotal, 260000);
  assert.equal(result.subtotal, 180000);
  assert.equal(result.discount, 18000);
  assert.equal(result.savings, 98000);
  assert.equal(result.total, 162000);
  assert.equal(result.baseSubtotal - result.savings, result.total);
});

test("colores con precios distintos suman sus precios salvo combo configurado", async () => {
 const product={id:"p",name:"Producto",salePrice:100,stock:10,combo2Price:null as number|null,variants:[{id:"b",active:true,salePrice:100,stock:5},{id:"w",active:true,salePrice:120,stock:5}],colorOptions:[{name:"Negro",hex:"#111111",variantId:"b"},{name:"Blanco",hex:"#ffffff",variantId:"w"}]};
 stub(db.product,"findMany",async()=>[product]);
 const items=[{productId:"p",quantity:2,unitColors:["Negro","Blanco"]}];
 assert.equal((await quote(items)).total,220);
 product.combo2Price=180;
 assert.equal((await quote(items)).total,180);
});
