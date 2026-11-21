import { StockAlert } from "@/components/stock-alert";
import { productColors } from "@/lib/product-colors";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Truck, ShieldCheck, Check, PackageCheck, MessageCircle, Banknote, BadgeCheck } from "lucide-react";
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
  const buyerAvatars = Array.isArray(p.buyerAvatars) ? p.buyerAvatars.map(String).filter((url) => url.startsWith("https://")).slice(0, 3) : [];
  return (
    <div className="product-page"><div className="wrap page-section">
      <div className="breadcrumb">
        <Link href="/">Inicio</Link> /{" "}
        <Link href={`/${p.category?.slug}`}>{p.category?.name}</Link> / {p.name}
      </div>
      <div className="product-detail">
        <div><ProductGallery images={images} name={p.name} stock={p.stock} />
          {productColors(p.colorOptions).length > 0 && (
            <section className="product-colors" aria-labelledby="available-colors-title">
              <h2 id="available-colors-title">Colores disponibles !</h2>
              <div className="product-color-list">
                {productColors(p.colorOptions).map(c => <span key={c.name}><i aria-hidden="true" style={{ backgroundColor: c.hex }} />{c.name}</span>)}
              </div>
            </section>
          )}
          <StockAlert stock={p.stock} />
          <div className="product-benefits"><span><Truck />Envío gratuito</span><span><ShieldCheck />Pago al recibir</span><span className="public-tracking"><PackageCheck />Sigue tu pedido</span></div>
        </div>
        <div className="product-information">
          <span className="eyebrow">{p.brand || p.category?.name}</span>
          <h1>{p.name}</h1>
          {Number(p.buyersCount) > 0 && <div className="product-social-proof"><div className="buyer-avatars" aria-hidden="true">{buyerAvatars.map((url, i) => <img key={`${url}-${i}`} src={url} alt="" width={42} height={42} loading="lazy" />)}</div><BadgeCheck size={23} /><span><strong>{Number(p.buyersCount).toLocaleString("es-CO")}</strong> personas ya compraron este producto</span></div>}
          <ul className="product-highlights"><li><Check /> Envío gratis a todo Colombia</li><li><Check /> Compra con pago contraentrega</li><li><Check /> Elige tu variante y cantidad disponible</li></ul>
          <AddToCart
            key={p.id}
            product={{
              id: p.id,
              hasColors: productColors(p.colorOptions).length>0,
              name: p.name,
              image: images[0] ?? "",
              price: Number(p.salePrice),
              previousPrice: Number(p.previousPrice),
              combo2Price: p.combo2Price == null ? null : Number(p.combo2Price),
              combo3Price: p.combo3Price == null ? null : Number(p.combo3Price),
              pairBestSeller: p.pairBestSeller,
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
            <div className="purchase-arrival"><h2><Truck size={20} /> ¿Cuándo me llega?</h2><dl className="delivery-estimates"><div><dt>Ciudades principales</dt><dd>2 a 3 días</dd></div><div><dt>Ciudades intermedias</dt><dd>3 a 5 días</dd></div><div><dt>Corregimientos y lugares lejanos</dt><dd>5 a 7 días</dd></div></dl><small>Días hábiles, según la operación de la transportadora.</small><small>Plazos estimados. La fecha solicitada está sujeta a disponibilidad y confirmación de la transportadora.</small></div>
            <Link className="purchase-policy-link" href="/politicas"><ShieldCheck size={19} /> Consulta garantías, cambios y devoluciones →</Link>
          </div>
          <h2 className="product-description-title">Conoce los detalles</h2>
          <p className="product-description">
            {p.description.replace(/<[^>]*>/g, "").replace("No está disponible para la venta ni corresponde a un producto de Dropi.", "Permite confirmar pedidos de prueba para verificar el formulario y las notificaciones. No se despacha.")}
          </p>
        </div>
      </div>
    </div></div>
  );
}
