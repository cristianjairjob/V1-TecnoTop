import Link from "next/link";
import { ArrowUpRight, PackageOpen, ArrowRight } from "lucide-react";
import { CatalogProduct, money } from "@/lib/catalog";
export function EmptyCatalog({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`empty-state ${compact ? "compact" : ""}`}>
      <PackageOpen size={36} strokeWidth={1.3} />
      <h3>Lo próximo está por llegar</h3>
      <p>
        Estamos preparando nuestra selección de tecnología.
        <br />
        Los productos aparecerán aquí cuando estén listos para comprar.
      </p>
      <Link href="/contacto">
        Habla con nosotros <ArrowRight size={16} />
      </Link>
    </div>
  );
}
export function ProductCard({ product: p }: { product: CatalogProduct }) {
  const images = Array.isArray(p.images) ? p.images : [];
  const price = Number(p.salePrice);
  const old = Number(p.previousPrice);
  return (
    <Link className="product-card" href={`/producto/${p.slug}`}>
      <div className="product-image">
        {old > price && (
          <span className="discount">
            -{Math.round((1 - price / old) * 100)}%
          </span>
        )}
        {images[0] && (
          <img src={String(images[0])} alt={p.name} loading="lazy" />
        )}
        <span className="product-arrow">
          <ArrowUpRight size={19} />
        </span>
      </div>
      <small>{p.category?.name}</small>
      <h3>{p.name}</h3>
      <div className="price">
        {money(price)} {old > price && <del>{money(old)}</del>}
      </div>
      <p className="shipping-note">Envío gratis · Contraentrega</p>
    </Link>
  );
}
export function ProductGrid({ products }: { products: CatalogProduct[] }) {
  return products.length ? (
    <div className="product-grid">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  ) : (
    <EmptyCatalog />
  );
}
