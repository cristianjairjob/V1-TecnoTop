"use client";
import { useState } from "react";
import { ShoppingBag, Check } from "lucide-react";
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
    <div className="buy-panel">
      <div className="product-unit-price"><strong>{money(price)}</strong><span>por unidad · Envío gratis</span></div>
      {product.variants.length > 0 && (
        <fieldset className="product-variants"><legend>Variante: <span>Elige tu opción</span></legend>
          {product.variants.map((variant) => <button type="button" key={variant.id} aria-pressed={variantId === variant.id} disabled={variant.stock < 1} onClick={() => { setVariantId(variant.id); setQuantity(1); setMessage(""); }}>{variant.name}{variant.stock < 1 ? " · Agotado" : ""}</button>)}
        </fieldset>
      )}
      <fieldset className="product-offers"><legend>ELIGE TU CANTIDAD</legend>
        {[1, 2, 3].map((count) => <label key={count} className={quantity === count ? "selected" : ""}>
          <input type="radio" name={`quantity-${product.id}`} checked={quantity === count} disabled={stock < count} onChange={() => {setQuantity(count); setMessage("");}} />
          <span><strong>Compra {count}</strong><small>{count === 1 ? "Precio por unidad" : `${count} unidades · Envío gratis`}</small></span>
          <b>{money(price * count)}</b>
        </label>)}
      </fieldset>
      <div className="buy-actions">
        <input
          type="number"
          aria-label="Cantidad"
          value={quantity}
          min={1}
          max={Math.min(stock, 20)}
          onChange={(e) =>
            setQuantity(Math.max(1, Math.min(20, Math.trunc(Number(e.target.value)) || 1)))
          }
        />
        <button
          className="button"
          onClick={add}
          disabled={price <= 0 || stock < quantity || Boolean(product.variants.length && !v)}
        >
          <ShoppingBag size={18} />{" "}
          {stock < 1 ? "Agotado" : "¡Compra ya!"}
        </button>
      </div>
      <p className="shipping-note">
        <Check size={15} /> Envío gratis · Pagas al recibir
      </p>
      <p role="status">{message}</p>
    </div>
  );
}
