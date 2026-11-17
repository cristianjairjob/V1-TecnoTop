import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Truck,
  Wallet,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import {
  categories,
  homeSections,
  publishedProducts,
  CatalogProduct,
} from "@/lib/catalog";
import { db } from "@/lib/db";
import { CategoryIcon } from "@/components/icons";
import { ProductGrid } from "@/components/products";
export default async function Home() {
  const [cats, sections] = await Promise.all([categories(), homeSections()]);
  const groups: Record<string, CatalogProduct[]> = {};
  for (const id of ["featured", "popular", "offers"])
    groups[id] = await publishedProducts({ kind: id, take: 4 });
  groups.offers = groups.offers.filter(
    (p) => Number(p.previousPrice) > Number(p.salePrice),
  );
  groups.bestsellers = [];
  if (process.env.DATABASE_URL) {
    const top = await db.orderItem.groupBy({
      by: ["productId"],
      where: { order: { status: "ENTREGADO" } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 4,
    });
    if (top.length) {
      const all = await publishedProducts({
        ids: top.map((t) => t.productId),
        take: 4,
      });
      groups.bestsellers = top.flatMap((t) =>
        all.filter((p) => p.id === t.productId),
      );
    }
  }
  return (
    <>
      {process.env.CHECKOUT_ENABLED !== "true" && (
        <div className="launch-notice">
          Estamos preparando el catálogo. Las compras se habilitarán pronto.
        </div>
      )}
      {sections
        .filter((s) => s.visible)
        .map((s) => {
          if (s.id === "hero")
            return (
              <section className="wrap hero" key={s.id}>
                <div className="hero-copy">
                  <span className="eyebrow">
                    <span /> BIENVENIDO A TECNOTOP
                  </span>
                  <h1>{s.title}</h1>
                  <p>{s.subtitle}</p>
                  <div className="hero-actions">
                    <Link className="button" href="/catalogo">
                      Explorar catálogo <ArrowUpRight size={19} />
                    </Link>
                    <Link className="text-link" href="/gaming">
                      Descubre gaming <ArrowRight size={17} />
                    </Link>
                  </div>
                  <div className="hero-foot">
                    <span>
                      <Truck size={17} /> Envío gratis
                    </span>
                    <i />
                    <span>
                      <Wallet size={17} /> Paga al recibir
                    </span>
                  </div>
                </div>
                <div className="hero-visual">
                  <img
                    src="/brand/tecnotop-original.png"
                    alt="Emblema oficial TecnoTop, tecnología que conecta"
                    fetchPriority="high"
                  />
                  <div className="visual-caption">
                    <span>TU MUNDO. MÁS CONECTADO.</span>
                    <ArrowUpRight size={25} />
                  </div>
                </div>
                <span className="hero-index">01 / TECNOLOGÍA PARA TI</span>
              </section>
            );
          if (s.id === "categories")
            return (
              <section className="wrap section" key={s.id}>
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">EXPLORA TECNOTOP</span>
                    <h2>{s.title}</h2>
                  </div>
                  <Link className="text-link" href="/catalogo">
                    Ver todo <ArrowRight size={17} />
                  </Link>
                </div>
                <div className="category-grid">
                  {cats.map((c, i) => (
                    <Link
                      href={`/${c.slug}`}
                      className="category-card"
                      key={c.slug}
                    >
                      <span className="category-number">0{i + 1}</span>
                      <CategoryIcon slug={c.slug} size={34} />
                      <h3>{c.name}</h3>
                      <ArrowUpRight size={18} />
                    </Link>
                  ))}
                </div>
              </section>
            );
          if (s.id === "benefits")
            return (
              <section className="benefits" key={s.id}>
                <div className="wrap">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">COMPRA CON TRANQUILIDAD</span>
                      <h2>{s.title}</h2>
                    </div>
                  </div>
                  <div className="benefit-grid">
                    {[
                      {
                        Icon: Truck,
                        title: "El envío va por nuestra cuenta",
                        text: "Envío gratuito para el cliente.",
                      },
                      {
                        Icon: Wallet,
                        title: "Paga cuando lo recibas",
                        text: "Pago contraentrega, sin pasarelas.",
                      },
                      {
                        Icon: ShieldCheck,
                        title: "Tu pedido, paso a paso",
                        text: "Consulta los avances registrados de tu compra.",
                      },
                      {
                        Icon: MessageCircle,
                        title: "Estamos para ayudarte",
                        text: "Contáctanos por WhatsApp o correo.",
                      },
                    ].map(({ Icon, title, text }) => (
                      <div key={title}>
                        <Icon size={27} strokeWidth={1.5} />
                        <h3>{title}</h3>
                        <p>{text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );
          const products = groups[s.id] ?? [];
          if (!products.length && s.id !== "featured") return null;
          return (
            <section className="wrap section" key={s.id}>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">{s.subtitle}</span>
                  <h2>{s.title}</h2>
                </div>
                <Link className="text-link" href={`/catalogo?tipo=${s.id}`}>
                  Ver catálogo <ArrowRight size={17} />
                </Link>
              </div>
              <ProductGrid products={products} />
            </section>
          );
        })}
      <section className="wrap help-banner">
        <div>
          <span className="eyebrow">¿BUSCAS ALGO EN ESPECIAL?</span>
          <h2>Conectemos contigo.</h2>
          <p>Cuéntanos qué necesitas y conversemos.</p>
        </div>
        <Link href="/contacto" className="button light">
          Hablemos <ArrowUpRight size={18} />
        </Link>
      </section>
    </>
  );
}
