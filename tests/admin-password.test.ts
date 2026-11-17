import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { compare, hash } from "bcryptjs";
import { changeAdminPassword, passwordChangeSchema } from "../src/lib/admin-password";
import { db } from "../src/lib/db";
const originalTransaction = db.$transaction;
afterEach(() => { db.$transaction = originalTransaction; });
function stubTransaction(fn: unknown) { db.$transaction = fn as typeof db.$transaction; }
test("rechaza contraseña actual incorrecta sin modificar la base", async () => {
  stubTransaction( async () => assert.fail("No debe escribir"));
  await assert.rejects(changeAdminPassword({ id: "test", passwordHash: await hash("previous-test-password", 4) }, { currentPassword: "incorrect", newPassword: "new-test-password" }), /actual no es correcta/);
});
test("guarda hash y revoca sesiones en la misma transacción", async () => {
  const previous = await hash("previous-test-password", 4);
  let saved = "";
  let revoked = false;
  stubTransaction( async (fn: (tx: unknown) => Promise<void>) => fn({
    adminUser: { updateMany: async ({ where, data }: { where: { id: string; passwordHash: string }; data: { passwordHash: string } }) => {
      assert.equal(where.id, "test"); assert.equal(where.passwordHash, previous);
      saved = data.passwordHash; return { count: 1 };
    } },
    adminSession: { deleteMany: async ({ where }: { where: { adminId: string } }) => { assert.equal(where.adminId, "test"); revoked = true; } },
    auditLog: { create: async ({ data }: { data: object }) => { assert.equal(JSON.stringify(data).includes("passwordHash"), false); } },
  }));
  await changeAdminPassword({ id: "test", passwordHash: previous }, { currentPassword: "previous-test-password", newPassword: "new-test-password" });
  assert.equal(await compare("new-test-password", saved), true);
  assert.equal(revoked, true);
});
test("limita longitud antes del truncamiento de bcrypt", () => {
  assert.equal(passwordChangeSchema.safeParse({ currentPassword: "old", newPassword: "á".repeat(37) }).success, false);
});
