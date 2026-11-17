"use client";
import { useState } from "react";
import { ShoppingBag, Check, Banknote, Truck } from "lucide-react";
import { useCart } from "./cart-provider";
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
    stock: number;
    variants: { id: string; name: string; price: number; stock: number }[];
  };
}) {
  const { items, setItems } = useCart();
  const router = useRouter();
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const v = product.variants.find((v) => v.id === variantId);
  const stock = v?.stock ?? product.stock;
  const price = v?.price ?? product.price;
  const previousPrice = !v && (product.previousPrice ?? 0) > price ? product.previousPrice! : 0;
  function add() {
    if (!Number.isInteger(quantity) || quantity < 1 || price <= 0 || stock < quantity || (product.variants.length && !v)) return;
    const existing = items.find(
      (i) =>
        i.productId === product.id && i.variantId === (variantId || undefined),
    );
    if ((existing?.quantity ?? 0) + quantity > Math.min(stock, 20)) {
      setMessage("Ya alcanzaste la cantidad disponible.");
      return;
    }
    setItems(
      existing
        ? items.map((i) =>
            i === existing ? { ...i, price, stock, quantity: i.quantity + quantity } : i,
          )
        : [
            ...items,
            {
              productId: product.id,
              variantId: variantId || undefined,
              name: product.name + (v ? " · " + v.name : ""),
              image: product.image,
              price,
              quantity,
              stock,
            },
          ],
    );
    setMessage("Producto agregado al carrito.");
    router.push("/carrito");
  }
  return (
    <div className="buy-panel purchase-card">
      {product.demo && <p className="demo-purchase-notice">Modo demostración · Puedes probar el carrito. Este producto no permite confirmar pedidos.</p>}
      <div className="product-unit-price" aria-live="polite"><strong>{money(price * quantity)}</strong><span><Banknote size={17} /> Paga al recibir</span></div>
      <p className="purchase-selection">{quantity} {quantity === 1 ? "unidad" : "unidades"} · {money(price)} c/u{v ? ` · ${v.name}` : ""}</p>
      <fieldset className="product-offers"><legend>ELIGE TU OPCIÓN</legend>
        {[1, 2, 3].map((count) => <label key={count} className={quantity === count ? "selected" : ""}>
          <input type="radio" name={`quantity-${product.id}`} checked={quantity === count} disabled={stock < count} onChange={() => {setQuantity(count); setMessage("");}} />
          <span className="offer-description"><strong>{count === 1 ? "Individual · 1 unidad" : count === 2 ? "Combo pareja · 2 unidades" : "Combo familiar · 3 unidades"}</strong><small>Envío gratis{previousPrice > 0 && <em> · Ahorras {money((previousPrice - price) * count)}</em>}</small></span>
          <span className="offer-price"><b>{money(price * count)}</b>{count > 1 && <small>{money(price)} c/u</small>}{previousPrice > 0 && <del>{money(previousPrice * count)}</del>}</span>
          {quantity === count && <span className="offer-badge"><Check size={12} /> SELECCIONADO</span>}
        </label>)}
      </fieldset>
      {product.variants.length > 0 && (
        <fieldset className="product-variants"><legend>VARIANTE <span>— {v?.name || "Elige tu opción"}</span></legend>
          {product.variants.map((variant) => <button type="button" key={variant.id} aria-pressed={variantId === variant.id} disabled={variant.stock < 1} onClick={() => { setVariantId(variant.id); setQuantity(1); setMessage(""); }}>{variant.name}{variant.stock < 1 ? " · Agotado" : ""}</button>)}
        </fieldset>
      )}
      <div className="purchase-delivery-note"><Truck size={19} /><span>Envío gratis a Colombia <strong>· Pagas al recibir</strong></span></div>
      <label className="purchase-custom-quantity">Cantidad<input type="number" aria-label="Cantidad" value={quantity} min={1} max={Math.min(stock, 20)} onChange={(e) => {setQuantity(Math.max(1, Math.min(20, Math.trunc(Number(e.target.value)) || 1))); setMessage("");}} /></label>
      <div className="buy-actions">
        <button
          className="button"
          onClick={add}
          disabled={price <= 0 || stock < quantity || Boolean(product.variants.length && !v)}
        >
          <ShoppingBag size={18} />{" "}
          <span>{stock < 1 ? "Agotado" : "COMPRAR AHORA"}<small>{product.demo ? "Prueba el carrito" : "Pago contraentrega · Envío gratis"}</small></span>
        </button>
      </div>
      <p className="shipping-note">
        <Check size={15} /> Revisa tu selección en el siguiente paso
      </p>
      <p role="status">{message}</p>
    </div>
  );
}
