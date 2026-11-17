import { notFound } from "next/navigation";
import Link from "next/link";
import { Truck, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { AddToCart } from "@/components/add-to-cart";
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
    <div className="wrap page-section">
      <div className="breadcrumb">
        <Link href="/">Inicio</Link> /{" "}
        <Link href={`/${p.category?.slug}`}>{p.category?.name}</Link> / {p.name}
      </div>
      <div className="product-detail">
        <div className="gallery">
          {images.map((image, i) => (
            <img
              key={image}
              src={image}
              alt={`${p.name}, imagen ${i + 1}`}
              loading={i ? "lazy" : "eager"}
            />
          ))}
        </div>
        <div>
          <span className="eyebrow">{p.brand || p.category?.name}</span>
          <h1>{p.name}</h1>
          <AddToCart
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
              <Truck size={20} /> Envío gratuito
            </span>
            <span>
              <ShieldCheck size={20} /> Pago contraentrega
            </span>
          </div>
          <h2>Conoce los detalles</h2>
          <p className="product-description">
            {p.description.replace(/<[^>]*>/g, "")}
          </p>
        </div>
      </div>
    </div>
  );
}
