import { hash } from "bcryptjs";
import { db } from "../src/lib/db";
async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 16)
    throw new Error(
      "Configura ADMIN_EMAIL y ADMIN_PASSWORD (mínimo 16 caracteres).",
    );
  await db.adminUser.create({
    data: { email, passwordHash: await hash(password, 12) },
  });
  console.log("Administrador creado. Retira ADMIN_PASSWORD del entorno.");
}
main()
  .catch(() => {
    console.error(
      "No se pudo crear el administrador; revisa las variables y que el correo no exista.",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
