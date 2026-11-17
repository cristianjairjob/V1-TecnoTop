import { db } from "../src/lib/db";
import {
  initialCategories,
  slugify,
  defaultSections,
} from "../src/lib/catalog-defaults";
async function seed() {
  for (const [position, c] of initialCategories.entries()) {
    const category = await db.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: {
        name: c.name,
        slug: c.slug,
        description: c.description,
        position,
      },
    });
    for (const [position, name] of c.collections.entries())
      await db.collection.upsert({
        where: { slug: `${c.slug}-${slugify(name)}` },
        update: {},
        create: {
          name,
          slug: `${c.slug}-${slugify(name)}`,
          description: "",
          categoryId: category.id,
          position,
        },
      });
  }
  await db.siteSetting.upsert({
    where: { key: "home" },
    update: {},
    create: { key: "home", value: defaultSections },
  });
  await db.siteSetting.upsert({
    where: { key: "store" },
    update: {},
    create: {
      key: "store",
      value: {
        contactEmail: "cristianjairjob@gmail.com",
        whatsapp: "573045939644",
        legalName: "",
        taxId: "",
        address: "",
        policiesApproved: false,
        privacy: "",
        shipping: "",
        returns: "",
        terms: "",
      },
    },
  });
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD_HASH) {
    if (!/^\$2[aby]\$\d{2}\$/.test(process.env.ADMIN_PASSWORD_HASH))
      throw new Error("Hash de administrador inválido.");
    await db.adminUser.upsert({
      where: { email: process.env.ADMIN_EMAIL.toLowerCase() },
      update: {},
      create: {
        email: process.env.ADMIN_EMAIL.toLowerCase(),
        passwordHash: process.env.ADMIN_PASSWORD_HASH,
      },
    });
  }
}
seed()
  .then(() => console.log("Categorías y configuración inicial verificadas."))
  .finally(() => db.$disconnect());
