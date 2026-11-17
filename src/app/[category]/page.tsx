import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { db } from "@/lib/db";
import { initialCategories } from "@/lib/catalog-defaults";
import { CategoryIcon } from "@/components/icons";
import { ProductGrid } from "@/components/products";
import { publishedProducts } from "@/lib/catalog";
export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: slug } = await params;
  const category = process.env.DATABASE_URL
    ? await db.category.findFirst({
        where: { slug, visible: true },
        include: {
          collections: {
            where: { visible: true },
            orderBy: { position: "asc" },
            include: { products: { orderBy: { position: "asc" } } },
          },
        },
      })
    : initialCategories.find((c) => c.slug === slug);
  if (!category) notFound();
  const products = await publishedProducts({ category: slug, take: 200 });
  const collections = category.collections.map((c) =>
    typeof c === "string" ? { id: c, name: c, products: [] } : c,
  );
  return (
    <div className="wrap page-section">
      <div className="breadcrumb">
        <Link href="/">Inicio</Link> / {category.name}
      </div>
      <div className="category-hero">
        <div>
          <span className="eyebrow">EXPLORA TECNOTOP</span>
          <h1>{category.name}</h1>
          <p>{category.description}</p>
          <Link href={`/catalogo?categoria=${slug}`} className="button">
            Ver todos <ArrowUpRight size={18} />
          </Link>
        </div>
        <CategoryIcon slug={slug} size={112} />
      </div>
      <nav className="collection-pills" aria-label="Colecciones">
        {collections.map((c) => (
          <a key={c.id} href={`#coleccion-${c.id}`}>
            {c.name} ↓
          </a>
        ))}
      </nav>
      {collections.map((c) => (
        <section
          className="collection-section"
          key={c.id}
          id={`coleccion-${c.id}`}
        >
          <div className="section-heading">
            <h2>{c.name}</h2>
            <Link href={`/catalogo?categoria=${slug}`} className="text-link">
              Ver todos <ArrowRight size={17} />
            </Link>
          </div>
          <ProductGrid
            products={c.products.flatMap((cp) =>
              products.filter((p) => p.id === cp.productId),
            )}
          />
        </section>
      ))}
    </div>
  );
}
