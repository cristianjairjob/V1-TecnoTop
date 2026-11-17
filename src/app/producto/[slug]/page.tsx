import { notFound } from "next/navigation";
import Link from "next/link";
import { Truck, ShieldCheck, Check, PackageCheck } from "lucide-react";
import { db } from "@/lib/db";
import { AddToCart } from "@/components/add-to-cart";
import { ProductGallery } from "@/components/product-gallery";
export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!process.env.DATABASE_URL) notFound();
  const p = await db.product.findFirst({
    where: { slug, status: "PUBLISHED", category: { visible: true } },
    include: { category: true, variants: { where: { active: true } } },
  });
  if (!p) notFound();
  const images = Array.isArray(p.images) ? p.images.map(String) : [];
  return (
    <div className="product-page"><div className="wrap page-section">
      <div className="breadcrumb">
        <Link href="/">Inicio</Link> /{" "}
        <Link href={`/${p.category?.slug}`}>{p.category?.name}</Link> / {p.name}
      </div>
      <div className="product-detail">
        <div><ProductGallery images={images} name={p.name} />
          <div className="product-benefits"><span><Truck />Envío gratuito</span><span><ShieldCheck />Pago al recibir</span><span><PackageCheck />Sigue tu pedido</span></div>
        </div>
        <div className="product-information">
          <span className="eyebrow">{p.brand || p.category?.name}</span>
          <h1>{p.name}</h1>
          <ul className="product-highlights"><li><Check /> Envío gratis a todo Colombia</li><li><Check /> Compra con pago contraentrega</li><li><Check /> Elige tu variante y cantidad disponible</li></ul>
          <AddToCart
            key={p.id}
            product={{
              id: p.id,
              name: p.name,
              image: images[0] ?? "",
              price: Number(p.salePrice),
              stock: p.stock,
              variants: p.variants.map((v) => ({
                id: v.id,
                name: v.name,
                price: Number(v.salePrice),
                stock: v.stock,
              })),
            }}
          />
          <div className="product-assurances">
            <span>
              <Truck size={28} /> Envíos a todo el país
            </span>
            <span>
              <ShieldCheck size={28} /> Contraentrega
            </span>
          </div>
          <h2>Conoce los detalles</h2>
          <p className="product-description">
            {p.description.replace(/<[^>]*>/g, "")}
          </p>
        </div>
      </div>
    </div></div>
  );
}
