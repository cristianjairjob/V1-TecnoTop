"use client";
import Link from "next/link";
import { LocationCombobox } from "./location-combobox";
import { isBusinessDay } from "@/lib/business-days";
import { CheckoutTimer } from "./checkout-timer";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { metaConsent, metaContext, subscribeMetaConsent, trackMetaAction } from "@/lib/meta-browser";
import { useRouter } from "next/navigation";
import {
  Trash2,
  ArrowRight,
  LockKeyhole,
  ShoppingBag,
} from "lucide-react";
import { useCart, type CartLine } from "./cart-provider";
import { money } from "@/lib/catalog-format";
import { minimumDeliveryDate, formatDeliveryDate } from "@/lib/delivery";
import { checkoutSchema } from "@/lib/validation";
import { departments, citiesForDepartment } from "@/lib/colombia-locations";
import { directCheckoutUrl } from "@/lib/direct-checkout";
type Quote = {
  lines: { productId: string; variantId?: string; quantity: number; lineTotal: number; effectiveTotal: number; pairBestSeller: boolean; colors: { name: string; hex: string }[]; offers: { quantity: number; total: number; available: boolean }[] }[];
  baseSubtotal: number;
  savings: number;
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
  const advertisingConsent = useSyncExternalStore(subscribeMetaConsent, metaConsent, () => "");
  const initiationId = useRef<string | null>(null);
  useEffect(() => {
    if (!checkout || !enabled || !quote || quoting || advertisingConsent !== "accepted" || initiationId.current) return;
    initiationId.current = crypto.randomUUID();
    void trackMetaAction("InitiateCheckout", initiationId.current);
  }, [checkout, enabled, quote, quoting, advertisingConsent]);
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
    items.map(({ productId, variantId, quantity, unitColors }) => ({
      productId,
      unitColors,
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
      const paymentEventId = saved?.signature === signature && saved.paymentEventId ? saved.paymentEventId : crypto.randomUUID();
      sessionStorage.setItem(
        "tecnotop-checkout",
        JSON.stringify({ signature, key, paymentEventId }),
      );
      void trackMetaAction("AddPaymentInfo", paymentEventId, { person: {
        firstName: validation.data.firstName, lastName: validation.data.lastName,
        phone: validation.data.phone, email: validation.data.email,
      } });
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, idempotencyKey: key, meta: metaContext(key) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      if (j.meta) void trackMetaAction("Purchase", j.meta.eventId, { receipt: j.meta.receipt, value: j.meta.value });
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
            <CheckoutTimer />
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
                Correo electrónico
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={180}
                />
              </label>
              <LocationCombobox label="Departamento *" name="state" options={departments} value={department} onChange={value => { setDepartment(value); setCity(""); }} placeholder="Escribe tu departamento" />
              <LocationCombobox key={department} label="Ciudad / municipio *" name="city" options={cities} value={city} onChange={setCity} disabled={!department} placeholder={department ? "Escribe tu ciudad o municipio" : "Primero selecciona un departamento"} />
              <figure className="span-two checkout-address-guide">
                  <img src="/checkout/address-guide.png" alt="Cómo enviar la dirección correctamente. Ejemplo: Carrera 3 # 45 - 07. Indica la vía, el cruce y el número de tu casa." width={1672} height={941} />

                <figcaption>Ejemplo: <strong>Carrera 3 # 45 - 07</strong>.</figcaption>
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
            <div className="form-grid">
              <label className="span-two">
                Notas adicionales (opcional)
                <textarea name="additionalNotes" maxLength={1000} rows={3} placeholder="Escribe aquí cualquier indicación adicional para la entrega." />
              </label>
              <label className="span-two delivery-date-box">
                Fecha solicitada de entrega (opcional)
                <span>Este es el día que tengas disponible para recibir el pedido.</span>
                <input name="requestedDate" type="date" lang="es-CO"
                  min={minimumDeliveryDate()} max="9999-12-31" value={requestedDate}
                  onChange={(event) => { const value=event.target.value; if(value && (!isBusinessDay(value) || value < minimumDeliveryDate())) { event.target.setCustomValidity("Elige un día hábil a partir de la fecha mínima, sin sábados, domingos ni festivos."); } else event.target.setCustomValidity(""); setRequestedDate(value); }}
                  aria-describedby="delivery-date-help delivery-date-preview" />
                <span id="delivery-date-preview" aria-live="polite">
                  {requestedDate ? "Fecha solicitada: " + formatDeliveryDate(requestedDate) : "Formato: DD/MM/YYYY"}
                </span>
                <span id="delivery-date-help">Puedes elegir una fecha a partir de {formatDeliveryDate(minimumDeliveryDate())}, después de 5 días hábiles (sin sábados, domingos ni festivos), debido al tiempo de entrega de la transportadora. La fecha solicitada está sujeta a disponibilidad y confirmación de la transportadora.</span>
              </label>
            </div>
            <h3>Método de envío y pago</h3>
            <div className="selected-method checkout-shipping-highlight">
              <strong>¡ENVÍO GRATIS Y PAGO CONTRAENTREGA!</strong>
            </div>
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
                <input type="radio" name={`checkout-offer-${item.productId}-${item.variantId || "base"}`} checked={item.quantity === offer.quantity} disabled={!offer.available || busy} onChange={() => setItems(items.map((current, n) => n === index ? { ...current, quantity: offer.quantity, unitColors: Array.from({length:offer.quantity},(_,i)=>current.unitColors?.[i]??"") } : current))} />
                <span><strong>{offer.quantity === 1 ? "Individual · 1 unidad" : offer.quantity === 2 ? "Combo pareja · 2 unidades" : "Combo familiar · 3 unidades"}</strong><small>ENVÍO GRATIS · PAGO CONTRAENTREGA</small>{offer.quantity === 2 && line.pairBestSeller && <em>EL MÁS COMPRADO</em>}</span>
                <b>{money(offer.total)}</b>
              </label>)}
            </fieldset>}
            {line && line.colors.length>0 && <fieldset className="checkout-unit-colors"><legend>Elige el color de cada unidad</legend>{Array.from({length:item.quantity},(_,unit)=><label key={unit}>Unidad {unit+1}<select required form="checkout-form" value={item.unitColors?.[unit]??""} onChange={e=>setItems(items.map((current,n)=>n===index?{...current,unitColors:Array.from({length:item.quantity},(_,i)=>i===unit?e.target.value:current.unitColors?.[i]??"")}:current))}><option value="">Selecciona un color</option>{line.colors.map(c=><option key={c.name} value={c.name}>{c.name}</option>)}</select></label>)}</fieldset>}
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
            <dt>Subtotal antes de descuentos</dt>
            <dd><del>{quoting ? "Actualizando…" : quote ? money(quote.baseSubtotal + items.reduce((sum,item)=>sum+item.quantity,0)*30000) : "Por validar"}</del></dd>
          </div>
          <div>
            <dt>Descuento <small>(incluye ahorro de envío)</small></dt>
            <dd className="summary-discount">{quoting ? "—" : quote ? money(quote.savings + items.reduce((sum,item)=>sum+item.quantity,0)*30000) : "—"}</dd>
          </div>
          <div>
            <dt>Envío</dt>
            <dd className="free"><del className="shipping-previous">{money(items.reduce((sum,item)=>sum+item.quantity,0)*30000)}</del> GRATIS</dd>
          </div>
          <div className="summary-total">
            <dt>Total</dt>
            <dd aria-live="polite">{quoting ? "Actualizando…" : quote ? money(quote.total) : "Por validar"}</dd>
          </div>
        </dl>
        {checkout && <label className="checkbox checkout-consent">
          <input type="checkbox" name="consent" form="checkout-form" required />
          <span>He leído y acepto las <Link href="/politicas" target="_blank">condiciones de compra y tratamiento de datos</Link>. *</span>
        </label>}
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
                  ? "Comprar"
                  : "Compras aún no habilitadas"}{" "}
              <ArrowRight size={17} />
            </button>
         </>
        ) : (
          <Link href="/checkout" className="button full">
            Continuar con mi compra <ArrowRight size={17} />
          </Link>
        )}
        <p className="summary-security">
          <LockKeyhole size={14} /> Tus datos se envían de forma cifrada.
        </p>
        {!checkout && <Link className="text-link" href="/catalogo">Seguir explorando</Link>}
      </aside>
    </div>
  );
}
