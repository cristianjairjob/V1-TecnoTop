import { notFound } from "next/navigation";
import Link from "next/link";
import { Truck, ShieldCheck, Check, PackageCheck, MessageCircle, Banknote, MapPin } from "lucide-react";
import { db } from "@/lib/db";
import { AddToCart } from "@/components/add-to-cart";
import { ProductGallery } from "@/components/product-gallery";
import { storeSettings } from "@/lib/catalog";
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
  const settings = await storeSettings();
  const whatsapp = (settings.whatsapp || "573045939644").replace(/\D/g, "");
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
              previousPrice: Number(p.previousPrice),
              demo: p.slug === "auriculares-demo-tecnotop",
              stock: p.stock,
              variants: p.variants.map((v) => ({
                id: v.id,
                name: v.name,
                price: Number(v.salePrice),
                stock: v.stock,
              })),
            }}
          />
          <div className="purchase-support">
            <div className="purchase-trust-grid">
              <div><span className="trust-icon"><Truck /></span><strong>Envíos a Colombia</strong><small>Gratis para ti</small></div>
              <div><span className="trust-icon"><Banknote /></span><strong>Pago contraentrega</strong><small>Pagas al recibir</small></div>
              <a href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hola, quiero información sobre ${p.name}`)}`} target="_blank" rel="noopener noreferrer"><span className="trust-icon whatsapp"><MessageCircle /></span><strong>Soporte por WhatsApp</strong><small>Hablemos de tu compra ↗</small></a>
            </div>
            <div className="purchase-arrival"><h2><Truck size={20} /> ¿Cuándo me llega?</h2><p>El plazo depende de tu ciudad, la disponibilidad y la transportadora.</p><div><MapPin size={18} /><span>Consulta el plazo para tu dirección</span><a href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hola, quiero consultar el plazo de envío de ${p.name} a mi ciudad.`)}`} target="_blank" rel="noopener noreferrer">Consultar ↗</a></div><small>La fecha solicitada está sujeta a disponibilidad y confirmación de la transportadora.</small></div>
            <Link className="purchase-policy-link" href="/politicas"><ShieldCheck size={19} /> Consulta garantías, cambios y devoluciones →</Link>
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
