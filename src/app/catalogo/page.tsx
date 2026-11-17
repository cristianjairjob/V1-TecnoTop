import Link from "next/link";
import { categories, publishedProducts } from "@/lib/catalog";
import { ProductGrid } from "@/components/products";
export const metadata = { title: "Catálogo" };
export default async function Catalog({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    categoria?: string;
    coleccion?: string;
    tipo?: string;
    pagina?: string;
  }>;
}) {
  const query = await searchParams;
  const page = Math.max(0, Math.min(10000, Number(query.pagina) || 0));
  const [cats, products] = await Promise.all([
    categories(),
    publishedProducts({
      search: query.q,
      category: query.categoria,
      collection: query.coleccion,
      kind: query.tipo,
      take: 24,
      skip: page * 24,
    }),
  ]);
  const filtered =
    query.tipo === "offers"
      ? products.filter((p) => Number(p.previousPrice) > Number(p.salePrice))
      : products;
  const href = (n: number) =>
    `/catalogo?${new URLSearchParams({ ...query, pagina: String(n) })}`;
  return (
    <div className="wrap page-section">
      <div className="breadcrumb">
        <Link href="/">Inicio</Link> / Catálogo
      </div>
      <div className="page-heading">
        <span className="eyebrow">ENCUENTRA TU PRÓXIMA CONEXIÓN</span>
        <h1>
          {query.q
            ? `Resultados para “${query.q.slice(0, 100)}”`
            : "Todo tu mundo tecnológico"}
        </h1>
        <p>Explora, elige y conecta con lo que te gusta.</p>
      </div>
      <form className="catalog-filters">
        {query.coleccion && (
          <input type="hidden" name="coleccion" value={query.coleccion} />
        )}
        <input
          name="q"
          defaultValue={query.q}
          placeholder="Buscar en el catálogo"
          aria-label="Buscar"
        />
        <select
          name="categoria"
          defaultValue={query.categoria ?? ""}
          aria-label="Categoría"
        >
          <option value="">Todas las categorías</option>
          {cats.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          name="tipo"
          defaultValue={query.tipo ?? ""}
          aria-label="Selección"
        >
          <option value="">Todos los productos</option>
          <option value="featured">Destacados</option>
          <option value="popular">Populares</option>
          <option value="offers">Ofertas</option>
        </select>
        <button className="button">Filtrar</button>
      </form>
      {query.coleccion && (
        <p className="small">
          <Link href={`/catalogo?categoria=${query.categoria ?? ""}`}>
            Quitar filtro de colección
          </Link>
        </p>
      )}
      <ProductGrid products={filtered} />
      <nav className="pagination" aria-label="Páginas">
        {page > 0 && <Link href={href(page - 1)}>← Anterior</Link>}
        {products.length === 24 && (
          <Link href={href(page + 1)}>Siguiente →</Link>
        )}
      </nav>
    </div>
  );
}
