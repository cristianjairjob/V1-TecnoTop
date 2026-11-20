"use client";
import { useState } from "react";
import Link from "next/link";
import { CheckoutTimer } from "./checkout-timer";
import { ShoppingBag, Check, Banknote, Truck, Flame, ShieldCheck } from "lucide-react";
import { offerTotal } from "@/lib/product-offers";
import { directCheckoutUrl } from "@/lib/direct-checkout";
import { money } from "@/lib/catalog-format";
import { useRouter } from "next/navigation";
export function AddToCart({
  product,
}: {
  product: {
    id: string;
    name: string;
    image: string;
    price: number;
    previousPrice?: number;
    demo?: boolean;
    hasColors?: boolean;
    combo2Price?: number | null;
    combo3Price?: number | null;
    pairBestSeller?: boolean;
    stock: number;
    variants: { id: string; name: string; price: number; stock: number }[];
  };
}) {
  const router = useRouter();
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const v = product.variants.find((v) => v.id === variantId);
  const stock = v?.stock ?? product.stock;
  const price = v?.price ?? product.price;
  const previousPrice = !v && (product.previousPrice ?? 0) > price ? product.previousPrice! : 0;
  const selectedTotal = offerTotal(price, quantity, product);
  function add() {
    if (!Number.isInteger(quantity) || quantity < 1 || price <= 0 || stock < quantity || (!product.hasColors && product.variants.length && !v)) return;
    router.push(directCheckoutUrl(product.id, quantity, variantId));
  }
  return (
    <div className="buy-panel purchase-card">
      <CheckoutTimer floatingEnabled={false} />
      <div className="product-unit-price" aria-live="polite"><strong>{money(selectedTotal)}</strong><span><Banknote size={17} /> Paga al recibir</span></div>
      <p className="purchase-selection">{quantity} {quantity === 1 ? "unidad" : "unidades"} · {money(selectedTotal / quantity)} c/u{v ? ` · ${v.name}` : ""}</p>
      <fieldset className="product-offers"><legend>ELIGE TU OPCIÓN</legend>
        {[1, 2, 3].map((count) => {
          const total = offerTotal(price, count, product);
          const comparison = (previousPrice || price) * count;
          const savings = Math.max(0, Math.round((comparison - total) * 100) / 100);
          return <label key={count} className={`${quantity === count ? "selected" : ""} ${count === 2 ? "pair-offer" : ""}`}>
          <input type="radio" name={`quantity-${product.id}`} checked={quantity === count} disabled={stock < count} onChange={() => {setQuantity(count); setMessage("");}} />
          <span className="offer-description"><strong>{count === 1 ? "Individual · 1 unidad" : count === 2 ? "Combo pareja · 2 unidades" : "Combo familiar · 3 unidades"}</strong><small><span className="offer-free-shipping"><Truck size={13} /> ENVÍO GRATIS · PAGO CONTRAENTREGA</span>{savings > 0 && <em>Ahorras {money(savings)}</em>}</small></span>
          <span className="offer-price"><b>{money(total)}</b>{count > 1 && <small>{money(total / count)} c/u</small>}{savings > 0 && <del>{money(comparison)}</del>}</span>
          {count === 2 ? <span className="offer-badge pair-popular-badge"><Flame size={17} /> {product.pairBestSeller ? "EL MÁS COMPRADO" : "COMBO DESTACADO"}</span> : quantity === count && <span className="offer-badge"><Check size={12} /> SELECCIONADO</span>}
        </label>;})}
      </fieldset>
      {!product.hasColors && product.variants.length > 0 && (
        <fieldset className="product-variants"><legend>VARIANTE <span>— {v?.name || "Elige tu opción"}</span></legend>
          {product.variants.map((variant) => <button type="button" key={variant.id} aria-pressed={variantId === variant.id} disabled={variant.stock < 1} onClick={() => { setVariantId(variant.id); setQuantity(1); setMessage(""); }}>{variant.name}{variant.stock < 1 ? " · Agotado" : ""}</button>)}
        </fieldset>
      )}
      <div className="purchase-delivery-note free-shipping-banner"><Truck size={28} /><span><strong>¡ENVÍO GRATIS!</strong><strong>¡PAGO CONTRAENTREGA!</strong><small>A toda Colombia · Pagas al recibir</small></span></div>
      <label className="purchase-custom-quantity">Cantidad<input type="number" aria-label="Cantidad" value={quantity} min={1} max={Math.min(stock, 20)} onChange={(e) => {setQuantity(Math.max(1, Math.min(20, Math.trunc(Number(e.target.value)) || 1))); setMessage("");}} /></label>
      {(product.combo2Price || product.combo3Price) && <p className="combo-quantity-note">Los combos aplican a 2 o 3 unidades. Si hay colores disponibles, podrás elegir uno para cada unidad en el formulario.</p>}
      <div className="buy-actions">
        <button
          className="button"
          onClick={add}
          disabled={price <= 0 || stock < quantity || Boolean(!product.hasColors && product.variants.length && !v)}
        >
          <ShoppingBag size={18} />{" "}
          <span>{stock < 1 ? "Agotado" : "COMPRAR AHORA"}<small>{product.demo ? "Prueba el formulario" : "Pago contraentrega · Envío gratis"}</small></span>
        </button>
      </div>
      <section className="product-warranty" aria-label="Garantía TecnoTop">
        <div className="warranty-seal"><ShieldCheck size={30} /></div>
        <div><strong>Garantía de 30 días</strong>
          <p>Cubre defectos de fábrica, productos dañados o incorrectos mediante reparación o cambio. <em>Recomendación:</em> graba un video al abrir y probar tu pedido para agilizar cualquier revisión.</p>
          <Link href="/politicas">Consulta las condiciones de garantía →</Link>
        </div>
      </section>
      <p className="shipping-note">
        <Check size={15} /> Revisa tu selección en el siguiente paso
      </p>
      <p role="status">{message}</p>
    </div>
  );
}
