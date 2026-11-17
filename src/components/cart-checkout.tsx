"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Trash2,
  ArrowRight,
  Truck,
  LockKeyhole,
  ShoppingBag,
} from "lucide-react";
import { useCart } from "./cart-provider";
import { money } from "@/lib/catalog-format";
type Quote = {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
};
export function CartCheckout({
  checkout = false,
  enabled = false,
}: {
  checkout?: boolean;
  enabled?: boolean;
}) {
  const { items, setItems } = useCart();
  const router = useRouter();
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [quoting, setQuoting] = useState(true);
  const serialized = JSON.stringify(
    items.map(({ productId, variantId, quantity }) => ({
      productId,
      variantId,
      quantity,
    })),
  );
  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve().then(() => {
      setQuoting(true);
      setQuote(null);
    });
    if (serialized === "[]") {
      Promise.resolve().then(() => setQuoting(false));
      return () => controller.abort();
    }
    fetch("/api/cart/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: JSON.parse(serialized),
        promotionCode: applied,
      }),
      signal: controller.signal,
    })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setQuote(j);
        setError("");
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setQuoting(false);
      });
    return () => controller.abort();
  }, [serialized, applied]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !quote || quoting) return;
    setBusy(true);
    setError("");
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const body = {
      ...fields,
      items: JSON.parse(serialized),
      promotionCode: applied,
      consent: fields.consent === "on",
    };
    const signature = JSON.stringify(body);
    let key = crypto.randomUUID();
    try {
      const saved = JSON.parse(
        sessionStorage.getItem("tecnotop-checkout") || "null",
      );
      if (saved?.signature === signature) key = saved.key;
      sessionStorage.setItem(
        "tecnotop-checkout",
        JSON.stringify({ signature, key }),
      );
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, idempotencyKey: key }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      sessionStorage.setItem("tecnotop-confirmation", JSON.stringify(j));
      sessionStorage.removeItem("tecnotop-checkout");
      setItems([]);
      router.push("/confirmacion");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible confirmar.");
    } finally {
      setBusy(false);
    }
  }
  if (!items.length)
    return (
      <div className="empty-state">
        <ShoppingBag size={40} strokeWidth={1.3} />
        <h2>Tu próxima conexión empieza aquí</h2>
        <p>Tu carrito todavía está vacío.</p>
        <Link className="button" href="/catalogo">
          Explorar catálogo <ArrowRight size={17} />
        </Link>
      </div>
    );
  return (
    <div className="checkout-grid">
      <div>
        {checkout ? (
          <form id="checkout-form" className="checkout-form" onSubmit={submit}>
            <h2>¿Dónde recibes tu pedido?</h2>
            <p>Completa tus datos. Solo pagarás cuando recibas la compra.</p>
            <div className="form-grid">
              <label className="span-two">
                Nombre completo
                <input
                  name="name"
                  autoComplete="name"
                  required
                  minLength={3}
                  maxLength={120}
                />
              </label>
              <label>
                Celular
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="300 123 4567"
                  required
                />
              </label>
              <label>
                Correo electrónico
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={180}
                />
              </label>
              <label>
                Departamento
                <input
                  name="state"
                  autoComplete="address-level1"
                  required
                  minLength={2}
                  maxLength={80}
                />
              </label>
              <label>
                Ciudad
                <input
                  name="city"
                  autoComplete="address-level2"
                  required
                  minLength={2}
                  maxLength={80}
                />
              </label>
              <label className="span-two">
                Dirección
                <input
                  name="address"
                  autoComplete="street-address"
                  required
                  minLength={8}
                  maxLength={200}
                />
              </label>
              <label className="span-two">
                Barrio y complemento
                <input
                  name="complement"
                  placeholder="Barrio, edificio, apartamento o indicaciones"
                  maxLength={200}
                />
              </label>
            </div>
            <h3>Método de envío y pago</h3>
            <div className="selected-method">
              <Truck size={22} />
              <div>
                <strong>Envío estándar · Gratis</strong>
                <p>
                  Pago contraentrega. La disponibilidad se valida al confirmar.
                </p>
              </div>
              <span>✓</span>
            </div>
            <label className="checkbox">
              <input type="checkbox" name="consent" required />{" "}
              <span>
                He leído y acepto las{" "}
                <Link href="/politicas" target="_blank">
                  condiciones de compra y tratamiento de datos
                </Link>
                .
              </span>
            </label>
          </form>
        ) : (
          <div className="cart-items">
            {items.map((i, index) => (
              <article
                className="cart-item"
                key={`${i.productId}:${i.variantId}`}
              >
                <img
                  src={i.image || "/brand/tecnotop-original.png"}
                  alt={i.name}
                />
                <div>
                  <h3>{i.name}</h3>
                  <p>{money(i.price)}</p>
                  <label>
                    Cantidad{" "}
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={i.quantity}
                      onChange={(e) =>
                        setItems(
                          items.map((x, n) =>
                            n === index
                              ? {
                                  ...x,
                                  quantity: Math.max(
                                    1,
                                    Math.min(20, Number(e.target.value) || 1),
                                  ),
                                }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                </div>
                <button
                  aria-label={`Eliminar ${i.name}`}
                  className="icon-button"
                  onClick={() => setItems(items.filter((_, n) => n !== index))}
                >
                  <Trash2 size={18} />
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
      <aside className="order-summary">
        <span className="eyebrow">TU PRÓXIMA CONEXIÓN</span>
        <h2>Resumen del pedido</h2>
        {checkout &&
          items.map((i) => (
            <p
              key={`${i.productId}:${i.variantId}`}
              className="summary-product"
            >
              <span>
                {i.quantity} × {i.name}
              </span>
              <span>{money(i.price * i.quantity)}</span>
            </p>
          ))}
        <label>
          Código de descuento
          <div className="coupon">
            <input
              value={coupon}
              onChange={(e) => setCoupon(e.target.value)}
              maxLength={50}
              placeholder="Tu código"
            />
            <button
              onClick={() => setApplied(coupon.trim().toUpperCase())}
              type="button"
            >
              Aplicar
            </button>
          </div>
        </label>
        <dl>
          <div>
            <dt>Subtotal</dt>
            <dd>{quote ? money(quote.subtotal) : "Por validar"}</dd>
          </div>
          <div>
            <dt>Descuento</dt>
            <dd>{quote ? money(quote.discount) : "—"}</dd>
          </div>
          <div>
            <dt>Envío</dt>
            <dd className="free">GRATIS</dd>
          </div>
          <div className="summary-total">
            <dt>Total</dt>
            <dd>{quote ? money(quote.total) : "Por validar"}</dd>
          </div>
        </dl>
        {quoting && <p role="status">Validando precios e inventario…</p>}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {checkout ? (
          <>
            <button
              className="button full"
              form="checkout-form"
              disabled={!enabled || busy || quoting || !quote}
            >
              {busy
                ? "Confirmando…"
                : enabled
                  ? "Confirmar pedido"
                  : "Compras aún no habilitadas"}{" "}
              <ArrowRight size={17} />
            </button>
            <p className="small muted">
              {enabled
                ? "El pedido se valida en nuestro servidor antes de confirmarlo."
                : "Estamos preparando la tienda. No se enviarán pedidos de prueba a Dropi."}
            </p>
          </>
        ) : (
          <Link href="/checkout" className="button full">
            Continuar con mi compra <ArrowRight size={17} />
          </Link>
        )}
        <p className="summary-security">
          <LockKeyhole size={14} /> Tus datos se envían de forma cifrada.
        </p>
        <Link className="text-link" href="/catalogo">
          Seguir explorando
        </Link>
      </aside>
    </div>
  );
}
