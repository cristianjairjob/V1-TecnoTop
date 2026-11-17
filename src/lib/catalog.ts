import { db } from "./db";
import { defaultSections, initialCategories } from "./catalog-defaults";
export const money = (n: number | string) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(n));
export async function categories() {
  if (!process.env.DATABASE_URL)
    return initialCategories.map((c, i) => ({
      ...c,
      id: c.slug,
      position: i,
      visible: true,
    }));
  return db.category.findMany({
    where: { visible: true },
    orderBy: { position: "asc" },
  });
}
export async function settings(key: string) {
  if (!process.env.DATABASE_URL) return null;
  return (await db.siteSetting.findUnique({ where: { key } }))?.value ?? null;
}
export type HomeSection = {
  id: string;
  title: string;
  subtitle: string;
  visible: boolean;
};
export async function homeSections() {
  return ((await settings("home")) as HomeSection[] | null) ?? defaultSections;
}
export type StoreSettings = {
  contactEmail: string;
  whatsapp: string;
  legalName: string;
  taxId: string;
  address: string;
  policiesApproved: boolean;
  privacy: string;
  shipping: string;
  returns: string;
  terms: string;
};
export async function storeSettings() {
  return (
    ((await settings("store")) as StoreSettings | null) ?? {
      contactEmail: "",
      whatsapp: "",
      legalName: "",
      taxId: "",
      address: "",
      policiesApproved: false,
      privacy: "",
      shipping: "",
      returns: "",
      terms: "",
    }
  );
}
export async function publishedProducts({
  category,
  search,
  kind,
  take = 24,
  skip = 0,
}: {
  category?: string;
  search?: string;
  kind?: string;
  take?: number;
  skip?: number;
} = {}) {
  if (!process.env.DATABASE_URL) return [];
  return db.product.findMany({
    where: {
      status: "PUBLISHED",
      salePrice: { gt: 0 },
      category: { visible: true, ...(category ? { slug: category } : {}) },
      ...(search ? { name: { contains: search.slice(0, 100) } } : {}),
      ...(kind === "featured" ? { featured: true } : {}),
      ...(kind === "popular" ? { popular: true } : {}),
      ...(kind === "offers" ? { previousPrice: { not: null } } : {}),
    },
    include: { variants: { where: { active: true } }, category: true },
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    take,
    skip,
  });
}
export type CatalogProduct = Awaited<
  ReturnType<typeof publishedProducts>
>[number];
