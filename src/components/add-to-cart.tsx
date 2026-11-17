"use client";
import { useState } from "react";
import { ShoppingBag, Check } from "lucide-react";
import { useCart } from "./cart-provider";
import { money } from "@/lib/catalog-format";
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
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const v = product.variants.find((v) => v.id === variantId);
  const stock = v?.stock ?? product.stock;
  const price = v?.price ?? product.price;
  function add() {
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
            i === existing ? { ...i, quantity: i.quantity + quantity } : i,
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
  }
  return (
    <div className="buy-panel">
      <strong className="detail-price">{money(price)}</strong>
      {product.variants.length > 0 && (
        <label>
          Elige tu variante
          <select
            value={variantId}
            onChange={(e) => {
              setVariantId(e.target.value);
              setMessage("");
            }}
          >
            <option value="">Seleccionar</option>
            {product.variants.map((v) => (
              <option value={v.id} key={v.id} disabled={v.stock < 1}>
                {v.name}
                {v.stock < 1 ? " — Agotado" : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="buy-actions">
        <input
          type="number"
          aria-label="Cantidad"
          value={quantity}
          min={1}
          max={Math.min(stock, 20)}
          onChange={(e) =>
            setQuantity(Math.max(1, Math.min(20, Number(e.target.value))))
          }
        />
        <button
          className="button"
          onClick={add}
          disabled={stock < quantity || Boolean(product.variants.length && !v)}
        >
          <ShoppingBag size={18} />{" "}
          {stock < 1 ? "Agotado" : "Agregar al carrito"}
        </button>
      </div>
      <p className="shipping-note">
        <Check size={15} /> Envío gratis · Pagas al recibir
      </p>
      <p role="status">{message}</p>
    </div>
  );
}
