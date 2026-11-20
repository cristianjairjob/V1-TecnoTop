"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search,
  ShoppingBag,
  Truck,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { useCart } from "./cart-provider";
export function Header({
  categories,
}: {
  categories: { slug: string; name: string }[];
}) {
  const { items } = useCart();
  const pathname = usePathname();
  const isCheckout = pathname === "/checkout";
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="announcement announcement-marquee" role="region" aria-label="Beneficios de comprar en TecnoTop" tabIndex={0}>
        <span className="announcement-accessible">Envío gratis · Pago contraentrega · Envíos a todo el país</span>
        <div className="announcement-track" aria-hidden="true">
          {[0, 1, 2].map((copy) => (
            <div className="announcement-group" key={copy}>
              <span>Envío gratis</span><i>✦</i>
              <span>Pago contraentrega</span><i>✦</i>
              <span>Envíos a todo el país</span><i>✦</i>
            </div>
          ))}
        </div>
      </div>
      <header className="site-header">
        <div className={`header-main wrap ${isCheckout ? "checkout-header" : ""}`}>
          <Link href="/" className="brand" aria-label="TecnoTop, inicio">
            <img
              src="/brand/tecnotop-original.png"
              alt="Logo oficial TecnoTop"
              width="52"
              height="52"
            />
            <span>
              Tecno<span>Top</span>
              <small>TECNOLOGÍA PARA TU DÍA</small>
            </span>
          </Link>
          {pathname === "/" && <form action="/catalogo" className="search">
            <Search size={18} />
            <input
              aria-label="Buscar productos"
              name="q"
              placeholder="¿Qué estás buscando hoy?"
            />
            <button type="submit">Buscar</button>
          </form>}
          <Link className="header-track" href="/seguimiento">
            <Truck size={22} />
            <span>
              Tu pedido<small>Hazle seguimiento</small>
            </span>
          </Link>
          <Link
            href="/carrito"
            className="cart-link"
            aria-label={`Carrito con ${items.reduce((n, i) => n + i.quantity, 0)} productos`}
          >
            <ShoppingBag size={23} />
            <span>{items.reduce((n, i) => n + i.quantity, 0)}</span>
          </Link>
          <button
            className="mobile-toggle"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
        <nav
          className={`category-nav ${open ? "open" : ""}`}
          aria-label="Categorías"
        >
          <div className="wrap">
            <Link
              href="/catalogo"
              className="catalog-link"
              onClick={() => setOpen(false)}
            >
              <Menu size={16} /> Todo el catálogo
            </Link>
            {categories.map((c) => (
              <Link
                href={`/${c.slug}`}
                key={c.slug}
                onClick={() => setOpen(false)}
              >
                {c.name}
              </Link>
            ))}
            <Link
              href="/catalogo?tipo=offers"
              className="offers-link"
              onClick={() => setOpen(false)}
            >
              Ofertas <span>↗</span>
            </Link>
          </div>
        </nav>
      </header>
    </>
  );
}
