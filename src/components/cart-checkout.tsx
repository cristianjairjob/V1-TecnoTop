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
import { useCart, type CartLine } from "./cart-provider";
import { money } from "@/lib/catalog-format";
import { bogotaToday, formatDeliveryDate } from "@/lib/delivery";
import { checkoutSchema } from "@/lib/validation";
import { departments, citiesForDepartment } from "@/lib/colombia-locations";
import { directCheckoutUrl } from "@/lib/direct-checkout";
type Quote = {
  lines: { productId: string; variantId?: string; quantity: number; lineTotal: number; effectiveTotal: number; pairBestSeller: boolean; offers: { quantity: number; total: number; available: boolean }[] }[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
};
export function CartCheckout({
  checkout = false,
  enabled = false,
  directItems,
}: {
  checkout?: boolean;
  enabled?: boolean;
  directItems?: CartLine[];
}) {
  const cart = useCart();
  const [purchaseItems, setPurchaseItems] = useState(directItems ?? []);
  const items = directItems ? purchaseItems : cart.items;
  const router = useRouter();
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [quoting, setQuoting] = useState(true);
  const [requestedDate, setRequestedDate] = useState("");
  const [department, setDepartment] = useState("");
  const [city, setCity] = useState("");
  const cities = citiesForDepartment(department);
  function setItems(nextItems: CartLine[]) {
    if (JSON.stringify(nextItems) !== JSON.stringify(items)) setQuoting(true);
    if (directItems) {
      setPurchaseItems(nextItems);
      const selected = nextItems[0];
      if (selected) window.history.replaceState(null, "", directCheckoutUrl(selected.productId, selected.quantity, selected.variantId));
    } else cart.setItems(nextItems);
  }
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
        if (e.name !== "AbortError") { setError(e.message); setQuote(null); }
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
      const validation = checkoutSchema.safeParse({ ...body, idempotencyKey: key });
      if (!validation.success) throw new Error(validation.error.issues[0].message);
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
              <label>
                Nombres *
                <input
                  name="firstName"
                  autoComplete="given-name"
                  required
                  maxLength={80}
                />
              </label>
              <label>
                Apellidos *
                <input name="lastName" autoComplete="family-name" required maxLength={80} />
              </label>
              <label>
                Celular *
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
                Correo electrónico (opcional)
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={180}
                />
              </label>
              <label>
                Departamento *
                <select name="state" autoComplete="address-level1" required value={department} onChange={(event) => { setDepartment(event.target.value); setCity(""); }}>
                  <option value="">Selecciona tu departamento</option>
                  {departments.map((item) => <option key={item.code} value={item.name}>{item.name}</option>)}
                </select>
              </label>
              <label>
                Ciudad / municipio *
                <select name="city" autoComplete="address-level2" required disabled={!department} value={city} onChange={(event) => setCity(event.target.value)}>
                  <option value="">{department ? "Selecciona tu ciudad o municipio" : "Primero selecciona un departamento"}</option>
                  {cities.map((item) => <option key={item.code} value={item.name}>{item.name}</option>)}
                </select>
              </label>
              <figure className="span-two checkout-address-guide">
                <a href="/checkout/address-guide.png" target="_blank" rel="noopener noreferrer" aria-label="Ampliar guía para escribir la dirección">
                  <img src="/checkout/address-guide.png" alt="Cómo enviar la dirección correctamente. Ejemplo: Carrera 3 # 45 - 07. Indica la vía, el cruce y el número de tu casa." width={1672} height={941} />
                </a>
                <figcaption>Ejemplo: <strong>Carrera 3 # 45 - 07</strong>. <a href="/checkout/address-guide.png" target="_blank" rel="noopener noreferrer">Ver guía ampliada ↗</a></figcaption>
              </figure>
              <label className="span-two">
                Dirección exacta (con nomenclatura) *
                <input
                  name="address"
                  placeholder="Ej: Calle 12 # 15 - 30 o Reclamo en oficina."
                  autoComplete="street-address"
                  required
                  minLength={8}
                  maxLength={200}
                />
              </label>
              <label className="span-two">
                Información adicional para la transportadora *
                <input
                  name="complement"
                  placeholder="Ej: Barrio/casa/apartamento/Edificio/local"
                  required
                  maxLength={200}
                />
              </label>
            </div>
            <h3>INFORMACIÓN ADICIONAL DE ENTREGA</h3>
            <p className="small">Completa estos datos para que el proveedor pueda preparar la entrega.</p>
            <div className="form-grid">
              <label className="span-two">
                Nombre del local o establecimiento
                <input name="establishment" required maxLength={160}
                  placeholder="Nombre del negocio, conjunto o Casa particular" />
              </label>
              <label className="span-two">
                Referencia para encontrar la dirección
                <input name="reference" required maxLength={300}
                  placeholder="Al lado de la tienda D1, frente al parque…" />
              </label>
              <label className="span-two">
                Fecha solicitada de entrega
                <input name="requestedDate" type="date" lang="es-CO" required
                  min={bogotaToday()} max="9999-12-31" value={requestedDate}
                  onChange={(event) => setRequestedDate(event.target.value)}
                  aria-describedby="delivery-date-help delivery-date-preview" />
                <span id="delivery-date-preview" aria-live="polite">
                  {requestedDate ? `Fecha solicitada: ${formatDeliveryDate(requestedDate)}` : "Formato: DD/MM/YYYY"}
                </span>
              </label>
            </div>
            <p id="delivery-date-help">La fecha solicitada está sujeta a disponibilidad y confirmación de la transportadora.</p>
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
                . *
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
                  <p>{quoting ? "Actualizando precio…" : quote ? `${money(quote.lines.find((line) => line.productId === i.productId && (line.variantId || undefined) === i.variantId)?.effectiveTotal ?? 0)} · Total por ${i.quantity} ${i.quantity === 1 ? "unidad" : "unidades"}` : "Precio pendiente de validar"}</p>
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
        {checkout && items.map((item, index) => {
          const line = quote?.lines.find((l) => l.productId === item.productId && (l.variantId || undefined) === item.variantId);
          return <div className="checkout-product-choice" key={`${item.productId}:${item.variantId}`}>
            <div className="checkout-product-heading"><img src={item.image || "/brand/tecnotop-original.png"} alt="" /><strong>{item.name}</strong></div>
            <p className="summary-product"><span>{item.quantity} {item.quantity === 1 ? "unidad" : "unidades"}</span><span>{quoting ? "Actualizando…" : line ? money(line.effectiveTotal) : "Por validar"}</span></p>
            {line && <fieldset className="checkout-offers"><legend>Elige tu promoción</legend>
              {line.offers.map((offer) => <label key={offer.quantity} className={`${item.quantity === offer.quantity ? "selected" : ""} ${offer.quantity === 2 ? "pair" : ""}`}>
                <input type="radio" name={`checkout-offer-${item.productId}-${item.variantId || "base"}`} checked={item.quantity === offer.quantity} disabled={!offer.available || busy} onChange={() => setItems(items.map((current, n) => n === index ? { ...current, quantity: offer.quantity } : current))} />
                <span><strong>{offer.quantity === 1 ? "Individual · 1 unidad" : offer.quantity === 2 ? "Combo pareja · 2 unidades" : "Combo familiar · 3 unidades"}</strong><small>ENVÍO GRATIS</small>{offer.quantity === 2 && line.pairBestSeller && <em>EL MÁS COMPRADO</em>}</span>
                <b>{money(offer.total)}</b>
              </label>)}
            </fieldset>}
          </div>;
        })}
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
            <dd>{quoting ? "Actualizando…" : quote ? money(quote.subtotal) : "Por validar"}</dd>
          </div>
          <div>
            <dt>Descuento</dt>
            <dd>{quoting ? "—" : quote ? money(quote.discount) : "—"}</dd>
          </div>
          <div>
            <dt>Envío</dt>
            <dd className="free">GRATIS</dd>
          </div>
          <div className="summary-total">
            <dt>Total</dt>
            <dd aria-live="polite">{quoting ? "Actualizando…" : quote ? money(quote.total) : "Por validar"}</dd>
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
