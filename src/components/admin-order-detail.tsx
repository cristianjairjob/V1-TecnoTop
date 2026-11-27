"use client";
import { useEffect, useRef, useState } from "react";
import { Copy, Check, Truck, Trash2 } from "lucide-react";
import { money } from "@/lib/catalog-format";
import { formatDeliveryDate } from "@/lib/delivery";
import { whatsappUrl } from "@/lib/whatsapp";
import type { Order } from "./admin-orders";
import styles from "./admin-order-detail.module.css";

function fullName(order: Order) {
  return [order.address.buyer?.firstName, order.address.buyer?.lastName].filter(Boolean).join(" ").trim() || order.customer.name;
}
export function shippingCopy(order: Order) {
  const delivery = order.address.delivery;
  return [
    `Nombre: ${fullName(order)}`,
    `Teléfono: ${order.customer.phone}`,
    `Ciudad: ${[order.address.city, order.address.state].filter(Boolean).join(", ")}`,
    `Dirección: ${[order.address.address, order.address.complement].filter(Boolean).join(", ")}`,
    `Referencia: ${[delivery?.establishment, delivery?.reference].filter(Boolean).join(" · ") || "No especificada"}`,
    ...(delivery?.additionalNotes ? [`Notas: ${delivery.additionalNotes}`] : []),
    ...(delivery?.requestedDate ? [`Fecha solicitada: ${formatDeliveryDate(delivery.requestedDate)} (sujeta a confirmación)`] : []),
  ].join("\n");
}
export function summaryCopy(order: Order) {
  return [
    `Pedido: ${order.number}`,
    ...(order.pricingSnapshot?.isTest ? ["PRUEBA · No despachar"] : []),
    ...order.items.map(item => [
      `${item.quantity} × ${item.name}`,
      ...(item.snapshot?.variant ? [`Variante: ${item.snapshot.variant}`] : []),
      ...(item.snapshot?.colors?.length ? [`Color: ${item.snapshot.colors.join(", ")}`] : []),
      `Precio unitario: ${money(Number(item.unitPrice))}`,
    ].join(" · ")),
    `Total: ${money(Number(order.total))}`,
  ].join("\n");
}
function label(value: string) { return value.replaceAll("_", " ").toLowerCase().replace(/^./, s => s.toUpperCase()); }

export function AdminOrderDetail({ order, disabled, onAction }: { order: Order; disabled: boolean; onAction: (order: Order, remove?: boolean) => Promise<void> }) {
  const [copied, setCopied] = useState("");
  const [copyError, setCopyError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  async function copy(key: string, value: string) {
    setCopyError("");
    try {
      await navigator.clipboard.writeText(value);
      if (timer.current) clearTimeout(timer.current);
      setCopied(key);
      timer.current = setTimeout(() => setCopied(""), 2200);
    } catch { setCopyError("No se pudo copiar. Selecciona el texto y cópialo manualmente."); }
  }
  function copyButton(key: string, value: string, text: string) {
    return <button className={styles.copy} type="button" onClick={() => void copy(key, value)} aria-label={copied === key ? `${text}: copiado` : text}>{copied === key ? <Check size={14} /> : <Copy size={14} />}{copied === key ? "Copiado" : text}</button>;
  }
  const delivery = order.address.delivery;
  const reference = [delivery?.establishment, delivery?.reference].filter(Boolean).join(" · ");
  const whatsapp = whatsappUrl(order.customer.phone);
  return <div className={styles.detail}>
    <span className={styles.srOnly} role="status" aria-live="polite">{copied ? "Copiado al portapapeles" : ""}</span>
    {copyError && <p role="alert" className={styles.error}>{copyError}</p>}
    <section className={`${styles.card} ${styles.header}`} aria-label="Encabezado del pedido">
      <div><span className={styles.eyebrow}>PEDIDO</span><div className={styles.code}><h2>{order.number}</h2>{copyButton("code", order.number, "Copiar código")}</div><p className={styles.date}>{new Date(order.createdAt).toLocaleString("es-CO", { timeZone: "America/Bogota" })} · Hora Colombia</p></div>
      <div className={styles.badges}><span className={`${styles.badge} ${order.status === "PENDIENTE" ? styles.pending : order.status === "DESPACHADO" ? styles.dispatched : styles.neutral}`}>{label(order.status)}</span><span className={`${styles.badge} ${styles.payment}`}>{label(order.paymentMethod)}</span>{order.pricingSnapshot?.isTest && <span className={`${styles.badge} ${styles.test}`}>PRUEBA · No despachar</span>}</div>
      <div className={styles.actions}><button type="button" disabled={disabled} onClick={() => void onAction(order)}><Truck size={16} />{order.status === "DESPACHADO" ? "Volver a pendiente" : "Marcar como despachado"}</button><button type="button" className={styles.danger} disabled={disabled} onClick={() => void onAction(order, true)}><Trash2 size={16} />Eliminar pedido</button></div>
    </section>
    <div className={styles.columns}>
      <section className={styles.card} aria-labelledby="order-shipping-title">
        <div className={styles.heading}><h2 id="order-shipping-title">Cliente y envío</h2>{copyButton("shipping", shippingCopy(order), "Copiar datos de envío")}</div>
        <dl className={styles.fields}>
          <div><dt>Nombre completo</dt><dd>{fullName(order)}</dd></div>
          <div><dt>Teléfono</dt><dd className={styles.inline}>{order.customer.phone}{copyButton("phone", order.customer.phone, "Copiar teléfono")}</dd></div>
          <div><dt>Correo electrónico</dt><dd>{order.customer.email || "No indicado"}</dd></div>
          <div><dt>Ciudad / departamento</dt><dd>{order.address.city}<span>{order.address.state}</span></dd></div>
          <div><dt>Dirección completa</dt><dd>{order.address.address}{order.address.complement && <span>{order.address.complement}</span>}</dd></div>
          <div><dt>Referencia</dt><dd>{reference || "No especificada"}</dd></div>
          <div><dt>Notas adicionales</dt><dd className={styles.notes}>{delivery?.additionalNotes || "Sin notas adicionales"}</dd></div>
          <div><dt>Fecha solicitada de entrega</dt><dd>{delivery?.requestedDate ? formatDeliveryDate(delivery.requestedDate) : "No especificada"}<span>Sujeta a confirmación.</span></dd></div>
        </dl>
        {whatsapp && <a className={styles.whatsapp} href={whatsapp} target="_blank" rel="noopener noreferrer">Abrir WhatsApp ↗</a>}
      </section>
      <section className={styles.card} aria-labelledby="order-products-title">
        <div className={styles.heading}><h2 id="order-products-title">Productos y resumen</h2>{copyButton("summary", summaryCopy(order), "Copiar resumen del pedido")}</div>
        <ul className={styles.items}>{order.items.map(item => <li key={item.id}>
          <strong>{item.quantity} × {item.name}</strong>
          <p>Variante: {item.snapshot?.variant || "Única"}</p>
          <p>Color: {item.snapshot?.colors?.join(", ") || "No aplica"}</p>
          {item.snapshot?.offer && <p>{item.snapshot.offer}</p>}
          <div className={styles.itemPrice}><span>{money(Number(item.unitPrice))} / unidad</span><strong>{money(Number(item.unitPrice) * item.quantity)}</strong></div>
        </li>)}</ul>
        <dl className={styles.totals}>
          <div><dt>Subtotal</dt><dd>{money(Number(order.subtotal))}</dd></div>
          <div><dt>Descuento{order.promotionCode ? ` (${order.promotionCode})` : ""}</dt><dd>−{money(Number(order.discount))}</dd></div>
          <div><dt>Envío</dt><dd>{Number(order.shipping) === 0 ? "Gratis" : money(Number(order.shipping))}</dd></div>
          <div className={styles.total}><dt>Total</dt><dd>{money(Number(order.total))}</dd></div>
        </dl>
        <p className={styles.paymentNote}>Método de pago: {label(order.paymentMethod)}</p>
      </section>
    </div>
  </div>;
}
